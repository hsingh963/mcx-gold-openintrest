using GoldInrOpenIntrest.Api.Models;

namespace GoldInrOpenIntrest.Api.Services;

public sealed class AnalysisService
{
    private readonly ILogger<AnalysisService> _logger;

    public AnalysisService(ILogger<AnalysisService> logger)
    {
        _logger = logger;
    }

    public OIAnalysisResult Analyze(IReadOnlyList<OptionData> input)
    {
        var data = input
            .Where(x => x.CallOI > 0 || x.PutOI > 0)
            .OrderBy(x => x.StrikePrice)
            .ToList();

        if (data.Count == 0)
        {
            return new OIAnalysisResult
            {
                TopSupports = [],
                TopResistances = []
            };
        }

        decimal totalPutOi = data.Sum(x => (decimal)x.PutOI);
        decimal totalCallOi = data.Sum(x => (decimal)x.CallOI);
        decimal pcr = 0m;

        if (totalCallOi > 0)
        {
            pcr = totalPutOi / totalCallOi;
        }

        _logger.LogInformation("Total Put OI: {TotalPutOi}", totalPutOi);
        _logger.LogInformation("Total Call OI: {TotalCallOi}", totalCallOi);
        _logger.LogInformation("PCR: {PCR}", pcr);

        var strongestSupport = data
            .OrderByDescending(x => x.PutOI)
            .ThenBy(x => x.StrikePrice)
            .First()
            .StrikePrice;

        var strongestResistance = data
            .OrderByDescending(x => x.CallOI)
            .ThenBy(x => x.StrikePrice)
            .First()
            .StrikePrice;

        var topSupports = data
            .OrderByDescending(x => x.PutOI)
            .ThenBy(x => x.StrikePrice)
            .Take(3)
            .Select(x => x.StrikePrice)
            .ToList();

        var topResistances = data
            .OrderByDescending(x => x.CallOI)
            .ThenBy(x => x.StrikePrice)
            .Take(3)
            .Select(x => x.StrikePrice)
            .ToList();

        var atm = ResolveAtmStrike(data);
        var atmRow = GetAtmRow(data, atm);
        var oiSignal = BuildOiSignal(atmRow);
        var sentiment = BuildMarketSentiment(pcr, data, atmRow, strongestSupport, strongestResistance);
        var maxPain = CalculateMaxPain(data);

        return new OIAnalysisResult
        {
            MaxPain = maxPain,
            StrongestSupport = strongestSupport,
            StrongestResistance = strongestResistance,
            Atm = atm,
            OiSignal = oiSignal,
            MarketSentiment = sentiment,
            TopSupports = topSupports,
            TopResistances = topResistances,
            PCR = pcr
        };
    }

    private static decimal ResolveAtmStrike(IReadOnlyList<OptionData> data)
    {
        var strikes = data.Select(x => x.StrikePrice).Distinct().OrderBy(x => x).ToArray();
        if (strikes.Length == 0)
        {
            return 0m;
        }

        var candidate = TryResolveUnderlying(data, out var underlying)
            ? underlying
            : (strikes.First() + strikes.Last()) / 2m;

        return strikes.OrderBy(strike => Math.Abs(strike - candidate)).First();
    }

    private static bool TryResolveUnderlying(IReadOnlyList<OptionData> data, out decimal underlying)
    {
        underlying = 0m;
        return false;
    }

    private static OptionData GetAtmRow(IReadOnlyList<OptionData> data, decimal atm)
    {
        return data
            .OrderBy(x => Math.Abs(x.StrikePrice - atm))
            .ThenBy(x => x.StrikePrice)
            .First();
    }

    private static string BuildOiSignal(OptionData atmRow)
    {
        var callChange = atmRow.CallOIChange;
        var putChange = atmRow.PutOIChange;

        if (callChange > 0 && putChange > 0)
        {
            return "Long Buildup";
        }

        if (callChange < 0 && putChange < 0)
        {
            return "Long Unwinding";
        }

        if (callChange > 0 && putChange < 0)
        {
            return "Short Buildup";
        }

        if (callChange < 0 && putChange > 0)
        {
            return "Short Covering";
        }

        return "Neutral";
    }

    private static MarketSentiment BuildMarketSentiment(
        decimal pcr,
        IReadOnlyList<OptionData> data,
        OptionData atmRow,
        decimal strongestSupport,
        decimal strongestResistance)
    {
        var supportBias = strongestSupport <= atmRow.StrikePrice;
        var resistanceBias = strongestResistance >= atmRow.StrikePrice;
        var strongSupportAtm = atmRow.PutOI >= atmRow.CallOI;
        var strongResistanceAtm = atmRow.CallOI > atmRow.PutOI;

        if (pcr >= 1.4m)
        {
            return new MarketSentiment
            {
                Label = "Strong Bullish",
                Reason = "PCR is high and put-side participation is dominating near ATM."
            };
        }

        if (pcr > 1.0m && (supportBias || strongSupportAtm))
        {
            return new MarketSentiment
            {
                Label = "Bullish",
                Reason = "PCR above 1 with strong support near ATM."
            };
        }

        if (pcr <= 0.6m && (resistanceBias || strongResistanceAtm))
        {
            return new MarketSentiment
            {
                Label = "Strong Bearish",
                Reason = "PCR is weak and call-side resistance is dominant near ATM."
            };
        }

        if (pcr < 1.0m && strongResistanceAtm)
        {
            return new MarketSentiment
            {
                Label = "Bearish",
                Reason = "PCR below 1 with call OI dominating near ATM."
            };
        }

        return new MarketSentiment
        {
            Label = "Neutral",
            Reason = "PCR and OI distribution are balanced around ATM."
        };
    }

    private static decimal CalculateMaxPain(IReadOnlyList<OptionData> data)
    {
        var strikeCandidates = data.Select(x => x.StrikePrice).Distinct().OrderBy(x => x).ToArray();
        var bestStrike = strikeCandidates[0];
        decimal minLoss = decimal.MaxValue;

        foreach (var s in strikeCandidates)
        {
            decimal totalLoss = 0m;

            foreach (var row in data)
            {
                totalLoss += Math.Max(0m, row.StrikePrice - s) * row.CallOI;
                totalLoss += Math.Max(0m, s - row.StrikePrice) * row.PutOI;
            }

            if (totalLoss < minLoss || (totalLoss == minLoss && s < bestStrike))
            {
                minLoss = totalLoss;
                bestStrike = s;
            }
        }

        return bestStrike;
    }
}
