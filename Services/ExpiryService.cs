using System.Text.Json;
using Microsoft.Extensions.Caching.Memory;

namespace GoldInrOpenIntrest.Api.Services;

public sealed class ExpiryService
{
    private const string CachePrefix = "mcx:expiries:";

    private readonly IMemoryCache _cache;
    private readonly IHostEnvironment _environment;
    private readonly ILogger<ExpiryService> _logger;

    public ExpiryService(IMemoryCache cache, IHostEnvironment environment, ILogger<ExpiryService> logger)
    {
        _cache = cache;
        _environment = environment;
        _logger = logger;
    }

    public Task<IReadOnlyList<string>> GetExpiriesAsync(string commodity, CancellationToken cancellationToken)
    {
        var normalizedCommodity = NormalizeCommodity(commodity);
        var cacheKey = $"{CachePrefix}{normalizedCommodity}";

        return _cache.GetOrCreateAsync<IReadOnlyList<string>>(cacheKey, async entry =>
        {
            entry.AbsoluteExpirationRelativeToNow = TimeSpan.FromMinutes(2);
            entry.Priority = CacheItemPriority.Normal;
            return await LoadExpiriesAsync(normalizedCommodity, cancellationToken);
        })!;
    }

    private async Task<IReadOnlyList<string>> LoadExpiriesAsync(string commodity, CancellationToken cancellationToken)
    {
        var filePath = Path.Combine(_environment.ContentRootPath, "expiries.json");
        if (!File.Exists(filePath))
        {
            _logger.LogWarning("Expiry file not found at {Path}", filePath);
            return Array.Empty<string>();
        }

        await using var stream = File.OpenRead(filePath);
        var expiries = await JsonSerializer.DeserializeAsync<Dictionary<string, List<string>>>(
            stream,
            new JsonSerializerOptions
            {
                PropertyNameCaseInsensitive = true
            },
            cancellationToken);

        if (expiries is null || expiries.Count == 0)
        {
            return Array.Empty<string>();
        }

        if (!expiries.TryGetValue(commodity, out var values) || values is null)
        {
            return Array.Empty<string>();
        }

        return values
            .Where(x => !string.IsNullOrWhiteSpace(x))
            .Select(x => x.Trim().ToUpperInvariant())
            .Distinct()
            .OrderBy(x => x)
            .ToArray();
    }

    private static string NormalizeCommodity(string? commodity)
    {
        var normalized = (commodity ?? string.Empty).Trim().ToUpperInvariant();
        return normalized is "GOLD" or "GOLDM" ? normalized : "GOLD";
    }
}
