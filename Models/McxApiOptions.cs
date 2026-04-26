namespace GoldInrOpenIntrest.Api.Models;

public sealed class McxApiOptions
{
    public const string SectionName = "McxApi";

    public string BaseUrl { get; set; } = "https://www.mcxindia.com";
    public string Referer { get; set; } = "https://www.mcxindia.com/market-data/option-chain";
    public string Accept { get; set; } = "application/json, text/javascript, */*; q=0.01";
    public string UserAgent { get; set; } = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36";
    public int TimeoutSeconds { get; set; } = 30;
}
