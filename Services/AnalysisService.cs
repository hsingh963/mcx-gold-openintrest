using GoldInrOpenIntrest.Api.Models;

namespace GoldInrOpenIntrest.Api.Services;

public sealed class AnalysisService
{
    public OIAnalysisResult Analyze(IReadOnlyList<OptionData> input)
    {
        var data = input
            .Where(x => x.CallOI != 0 || x.PutOI != 0)
            .OrderBy(x => x.StrikePrice)
            .ToArray();

        if (data.Length == 0)
        {
            return new OIAnalysisResult
            {
                TopSupports = [],
                TopResistances = []
            };
        }

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

        var totalCallOi = data.Sum(x => x.CallOI);
        var totalPutOi = data.Sum(x => x.PutOI);
        var pcr = totalCallOi == 0 ? 0m : totalPutOi / totalCallOi;

        var maxPain = CalculateMaxPain(data);

        return new OIAnalysisResult
        {
            MaxPain = maxPain,
            StrongestSupport = strongestSupport,
            StrongestResistance = strongestResistance,
            TopSupports = topSupports,
            TopResistances = topResistances,
            PCR = pcr
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
