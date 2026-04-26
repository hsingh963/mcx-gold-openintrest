using Microsoft.Extensions.Caching.Memory;

namespace GoldInrOpenIntrest.Api.Services;

public sealed class ExpiryService
{
    private const string CacheKey = "mcx:expiries";

    private readonly IMemoryCache _cache;
    private readonly IHostEnvironment _environment;
    private readonly ILogger<ExpiryService> _logger;

    public ExpiryService(IMemoryCache cache, IHostEnvironment environment, ILogger<ExpiryService> logger)
    {
        _cache = cache;
        _environment = environment;
        _logger = logger;
    }

    public Task<IReadOnlyList<string>> GetExpiriesAsync(CancellationToken cancellationToken)
    {
        return _cache.GetOrCreateAsync<IReadOnlyList<string>>(CacheKey, async entry =>
        {
            entry.AbsoluteExpirationRelativeToNow = TimeSpan.FromMinutes(2);
            entry.Priority = CacheItemPriority.Normal;
            return await LoadExpiriesAsync(cancellationToken);
        })!;
    }

    private Task<IReadOnlyList<string>> LoadExpiriesAsync(CancellationToken cancellationToken)
    {
        var filePath = Path.Combine(_environment.ContentRootPath, "expiries.txt");
        if (!File.Exists(filePath))
        {
            _logger.LogWarning("Expiry file not found at {Path}", filePath);
            return Task.FromResult<IReadOnlyList<string>>(Array.Empty<string>());
        }

        var values = File.ReadAllLines(filePath)
            .Select(x => x.Trim().ToUpperInvariant())
            .Where(x => !string.IsNullOrWhiteSpace(x))
            .Distinct()
            .OrderBy(x => x)
            .ToArray();

        return Task.FromResult<IReadOnlyList<string>>(values);
    }
}
