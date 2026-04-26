namespace GoldInrOpenIntrest.Api.Models;

public sealed class GoldAnalysisResponse
{
    public List<OptionData> Data { get; set; } = [];
    public OIAnalysisResult Analysis { get; set; } = new();
}
