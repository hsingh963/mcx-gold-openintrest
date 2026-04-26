using GoldInrOpenIntrest.Api.Models;
using GoldInrOpenIntrest.Api.Services;
using Microsoft.AspNetCore.Mvc;

namespace GoldInrOpenIntrest.Api.Controllers;

[ApiController]
[Route("api/options")]
public sealed class OptionsController : ControllerBase
{
    private readonly IMcxService _mcxService;
    private readonly AnalysisService _analysisService;
    private readonly ExpiryService _expiryService;
    private readonly ILogger<OptionsController> _logger;

    public OptionsController(
        IMcxService mcxService,
        AnalysisService analysisService,
        ExpiryService expiryService,
        ILogger<OptionsController> logger)
    {
        _mcxService = mcxService;
        _analysisService = analysisService;
        _expiryService = expiryService;
        _logger = logger;
    }

    [HttpGet("/api/options/expiries")]
    [ProducesResponseType(typeof(List<string>), StatusCodes.Status200OK)]
    public async Task<IActionResult> GetExpiries(CancellationToken cancellationToken)
    {
        var expiries = await _expiryService.GetExpiriesAsync(cancellationToken);
        return Ok(expiries);
    }

    [HttpGet("gold")]
    [ProducesResponseType(typeof(IEnumerable<OptionData>), StatusCodes.Status200OK)]
    [ProducesResponseType(typeof(ProblemDetails), StatusCodes.Status404NotFound)]
    [ProducesResponseType(typeof(ProblemDetails), StatusCodes.Status502BadGateway)]
    public async Task<IActionResult> GetGold([FromQuery] string expiry, CancellationToken cancellationToken)
    {
        if (!McxService.TryNormalizeExpiry(expiry, out var normalizedExpiry, out var validationProblem))
        {
            return BadRequest(validationProblem);
        }

        try
        {
            var options = await _mcxService.GetGoldOptionsAsync(normalizedExpiry, cancellationToken);
            if (options.Count == 0)
            {
                return NotFound(new ProblemDetails
                {
                    Title = "No option chain data returned",
                    Detail = $"MCX returned no rows for GOLD expiry {normalizedExpiry}.",
                    Status = StatusCodes.Status404NotFound
                });
            }

            return Ok(options);
        }
        catch (McxUpstreamException ex)
        {
            _logger.LogWarning(ex, "Failed to fetch GOLD option chain for expiry {Expiry}", expiry);
            return StatusCode((int)ex.StatusCode, new ProblemDetails
            {
                Title = "MCX upstream request failed",
                Detail = ex.Message,
                Status = (int)ex.StatusCode
            });
        }
    }

    [HttpGet("gold/analysis")]
    [ProducesResponseType(typeof(GoldAnalysisResponse), StatusCodes.Status200OK)]
    [ProducesResponseType(typeof(ProblemDetails), StatusCodes.Status400BadRequest)]
    [ProducesResponseType(typeof(ProblemDetails), StatusCodes.Status404NotFound)]
    [ProducesResponseType(typeof(ProblemDetails), StatusCodes.Status502BadGateway)]
    public async Task<IActionResult> GetGoldAnalysis([FromQuery] string expiry, CancellationToken cancellationToken)
    {
        if (!McxService.TryNormalizeExpiry(expiry, out var normalizedExpiry, out var validationProblem))
        {
            return BadRequest(validationProblem);
        }

        try
        {
            var options = await _mcxService.GetGoldOptionsAsync(normalizedExpiry, cancellationToken);
            if (options.Count == 0)
            {
                return NotFound(new ProblemDetails
                {
                    Title = "No option chain data returned",
                    Detail = $"MCX returned no rows for GOLD expiry {normalizedExpiry}.",
                    Status = StatusCodes.Status404NotFound
                });
            }

            var sanitized = options
                .Where(x => x.CallOI != 0 || x.PutOI != 0)
                .OrderBy(x => x.StrikePrice)
                .ToList();

            var analysis = _analysisService.Analyze(sanitized);
            return Ok(new GoldAnalysisResponse
            {
                Data = sanitized,
                Analysis = analysis
            });
        }
        catch (McxUpstreamException ex)
        {
            _logger.LogWarning(ex, "Failed to analyze GOLD option chain for expiry {Expiry}", normalizedExpiry);
            return StatusCode((int)ex.StatusCode, new ProblemDetails
            {
                Title = "MCX upstream request failed",
                Detail = ex.Message,
                Status = (int)ex.StatusCode
            });
        }
    }
}
