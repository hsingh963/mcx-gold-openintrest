namespace GoldInrOpenIntrest.Api.Models;

public class OIAnalysisResult
{
    public decimal MaxPain { get; set; }
    public decimal StrongestSupport { get; set; }
    public decimal StrongestResistance { get; set; }
    public List<decimal> TopSupports { get; set; } = [];
    public List<decimal> TopResistances { get; set; } = [];
    public decimal PCR { get; set; }
}
