namespace GoldInrOpenIntrest.Api.Models;

public class OptionData
{
    public decimal StrikePrice { get; set; }
    public long CallOI { get; set; }
    public long PutOI { get; set; }
    public long CallOIChange { get; set; }
    public long PutOIChange { get; set; }
}
