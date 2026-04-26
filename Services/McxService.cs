using System.Globalization;
using System.Net;
using System.Text;
using System.Text.Json;
using GoldInrOpenIntrest.Api.Models;
using Microsoft.AspNetCore.Mvc;
using Microsoft.Extensions.Caching.Memory;
using Microsoft.Extensions.Options;

namespace GoldInrOpenIntrest.Api.Services;

public interface IMcxService
{
    Task<IReadOnlyList<OptionData>> GetGoldOptionsAsync(string expiry, CancellationToken cancellationToken);
}

public sealed class McxService : IMcxService
{
    private const string OptionChainPath = "/backpage.aspx/GetOptionChain";
    private const int CacheMinutes = 2;

    private readonly HttpClient _httpClient;
    private readonly IMemoryCache _cache;
    private readonly McxApiOptions _options;
    private readonly ILogger<McxService> _logger;

    public McxService(
        HttpClient httpClient,
        IMemoryCache cache,
        IOptions<McxApiOptions> options,
        ILogger<McxService> logger)
    {
        _httpClient = httpClient;
        _cache = cache;
        _options = options.Value;
        _logger = logger;
    }

    public Task<IReadOnlyList<OptionData>> GetGoldOptionsAsync(string expiry, CancellationToken cancellationToken)
    {
        if (!TryNormalizeExpiry(expiry, out var normalizedExpiry, out _))
        {
            return Task.FromResult<IReadOnlyList<OptionData>>(Array.Empty<OptionData>());
        }

        var cacheKey = $"mcx:gold:{normalizedExpiry}";
        return _cache.GetOrCreateAsync<IReadOnlyList<OptionData>>(cacheKey, async entry =>
        {
            entry.AbsoluteExpirationRelativeToNow = TimeSpan.FromMinutes(CacheMinutes);
            entry.Priority = CacheItemPriority.High;
            return await FetchGoldOptionsAsync(normalizedExpiry, cancellationToken);
        })!;
    }

    public static bool TryNormalizeExpiry(string? expiry, out string normalized, out ProblemDetails problem)
    {
        normalized = string.Empty;
        problem = new ProblemDetails
        {
            Title = "Invalid expiry format",
            Detail = "Expiry must be in MCX format like 27MAY2026.",
            Status = StatusCodes.Status400BadRequest
        };

        if (string.IsNullOrWhiteSpace(expiry))
        {
            return false;
        }

        var candidate = expiry.Trim().ToUpperInvariant();
        if (!DateTime.TryParseExact(candidate, "ddMMMyyyy", CultureInfo.InvariantCulture, DateTimeStyles.None, out _))
        {
            return false;
        }

        normalized = candidate;
        return true;
    }

    private async Task<IReadOnlyList<OptionData>> FetchGoldOptionsAsync(string expiry, CancellationToken cancellationToken)
    {
        var payload = JsonSerializer.Serialize(new
        {
            Commodity = "GOLD",
            Expiry = expiry
        });

        using var request = new HttpRequestMessage(HttpMethod.Post, OptionChainPath);
        request.Headers.Accept.ParseAdd(_options.Accept);
        request.Headers.Referrer = new Uri(_options.Referer, UriKind.Absolute);
        request.Headers.TryAddWithoutValidation("X-Requested-With", "XMLHttpRequest");
        request.Content = new StringContent(payload, Encoding.UTF8, "application/json");

        _logger.LogInformation("Fetching MCX GOLD option chain for expiry {Expiry}", expiry);

        using var response = await _httpClient.SendAsync(request, HttpCompletionOption.ResponseHeadersRead, cancellationToken);
        var body = await response.Content.ReadAsStringAsync(cancellationToken);

        if (!response.IsSuccessStatusCode)
        {
            _logger.LogWarning("MCX returned non-success status {StatusCode} for expiry {Expiry}", (int)response.StatusCode, expiry);
            throw new McxUpstreamException(
                $"MCX returned {(int)response.StatusCode} {response.ReasonPhrase} for GOLD expiry {expiry}.",
                response.StatusCode);
        }

        var options = ParseResponse(body);
        _logger.LogInformation("Parsed {Count} GOLD option rows for expiry {Expiry}", options.Count, expiry);
        return options;
    }

    private static IReadOnlyList<OptionData> ParseResponse(string json)
    {
        using var document = JsonDocument.Parse(json, new JsonDocumentOptions
        {
            AllowTrailingCommas = true,
            CommentHandling = JsonCommentHandling.Skip
        });

        var dataNode = TryGetPropertyIgnoreCase(document.RootElement, "d", out var wrapped)
            ? UnwrapD(wrapped)
            : document.RootElement;

        if (dataNode.ValueKind == JsonValueKind.String)
        {
            var innerJson = dataNode.GetString();
            if (!string.IsNullOrWhiteSpace(innerJson))
            {
                using var innerDocument = JsonDocument.Parse(innerJson, new JsonDocumentOptions
                {
                    AllowTrailingCommas = true,
                    CommentHandling = JsonCommentHandling.Skip
                });

                dataNode = innerDocument.RootElement;
            }
        }

        var rows = FindDataArray(dataNode);
        if (rows is null || rows.Value.ValueKind != JsonValueKind.Array)
        {
            return Array.Empty<OptionData>();
        }

        var results = new List<OptionData>();
        foreach (var row in rows.Value.EnumerateArray())
        {
            if (row.ValueKind != JsonValueKind.Object)
            {
                continue;
            }

            if (!TryReadDecimal(row, out var strike, "CE_StrikePrice"))
            {
                continue;
            }

            var call = TryReadLong(row, "CE_OpenInterest");
            var put = TryReadLong(row, "PE_OpenInterest");

            if (call == 0 && put == 0)
            {
                continue;
            }

            results.Add(new OptionData
            {
                StrikePrice = strike,
                CallOI = call,
                PutOI = put
            });
        }

        return results
            .OrderBy(x => x.StrikePrice)
            .ToArray();
    }

    private static JsonElement UnwrapD(JsonElement dNode)
    {
        if (dNode.ValueKind == JsonValueKind.Object && TryGetPropertyIgnoreCase(dNode, "Data", out var data))
        {
            return data;
        }

        return dNode;
    }

    private static JsonElement? FindDataArray(JsonElement element)
    {
        if (element.ValueKind == JsonValueKind.Array)
        {
            return element;
        }

        if (element.ValueKind != JsonValueKind.Object)
        {
            return null;
        }

        if (TryGetPropertyIgnoreCase(element, "Data", out var data))
        {
            if (data.ValueKind == JsonValueKind.Array)
            {
                return data;
            }

            var nested = FindDataArray(data);
            if (nested.HasValue)
            {
                return nested;
            }
        }

        foreach (var property in element.EnumerateObject())
        {
            if (property.Value.ValueKind is JsonValueKind.Object or JsonValueKind.Array)
            {
                var nested = FindDataArray(property.Value);
                if (nested.HasValue)
                {
                    return nested;
                }
            }
        }

        return null;
    }

    private static bool TryGetPropertyIgnoreCase(JsonElement element, string name, out JsonElement value)
    {
        foreach (var property in element.EnumerateObject())
        {
            if (string.Equals(property.Name, name, StringComparison.OrdinalIgnoreCase))
            {
                value = property.Value;
                return true;
            }
        }

        value = default;
        return false;
    }

    private static bool TryReadDecimal(JsonElement element, out decimal value, string propertyName)
    {
        value = default;
        if (!TryGetPropertyIgnoreCase(element, propertyName, out var property))
        {
            return false;
        }

        if (property.ValueKind == JsonValueKind.Number)
        {
            return property.TryGetDecimal(out value);
        }

        if (property.ValueKind == JsonValueKind.String)
        {
            return decimal.TryParse(property.GetString(), NumberStyles.Any, CultureInfo.InvariantCulture, out value);
        }

        return false;
    }

    private static long TryReadLong(JsonElement element, string propertyName)
    {
        if (!TryGetPropertyIgnoreCase(element, propertyName, out var property))
        {
            return 0;
        }

        if (property.ValueKind == JsonValueKind.Number && property.TryGetInt64(out var number))
        {
            return number;
        }

        if (property.ValueKind == JsonValueKind.String &&
            long.TryParse(property.GetString(), NumberStyles.Any, CultureInfo.InvariantCulture, out var parsed))
        {
            return parsed;
        }

        return 0;
    }
}
