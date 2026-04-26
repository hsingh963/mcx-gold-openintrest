namespace GoldInrOpenIntrest.Api.Models;

public class OIAnalysisResult
{
    public decimal MaxPain { get; set; }
    public decimal StrongestSupport { get; set; }
    public decimal StrongestResistance { get; set; }
    public decimal Atm { get; set; }
    public decimal? CurrentPrice { get; set; }
    public string OiSignal { get; set; } = string.Empty;
    public MarketSentiment MarketSentiment { get; set; } = new();
    public List<decimal> TopSupports { get; set; } = [];
    public List<decimal> TopResistances { get; set; } = [];
    public decimal PCR { get; set; }
}
