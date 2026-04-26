using GoldInrOpenIntrest.Api.Models;
using GoldInrOpenIntrest.Api.Services;
using Microsoft.AspNetCore.Mvc;

namespace GoldInrOpenIntrest.Api.Controllers;

[ApiController]
[Route("api/options")]
public sealed class OptionsController : ControllerBase
{
    private readonly IMcxService _mcxService;
    private readonly GraphService _graphService;
    private readonly AnalysisService _analysisService;
    private readonly ExpiryService _expiryService;
    private readonly ILogger<OptionsController> _logger;

    public OptionsController(
        IMcxService mcxService,
        GraphService graphService,
        AnalysisService analysisService,
        ExpiryService expiryService,
        ILogger<OptionsController> logger)
    {
        _mcxService = mcxService;
        _graphService = graphService;
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

    [HttpGet("gold/graph")]
    [Produces("image/png")]
    [ProducesResponseType(typeof(ProblemDetails), StatusCodes.Status404NotFound)]
    [ProducesResponseType(typeof(ProblemDetails), StatusCodes.Status502BadGateway)]
    public async Task<IActionResult> GetGoldGraph([FromQuery] string expiry, CancellationToken cancellationToken)
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

            var png = _graphService.BuildGoldOptionChart(options, normalizedExpiry);
            return File(png, "image/png", $"gold-option-chain-{normalizedExpiry}.png");
        }
        catch (McxUpstreamException ex)
        {
            _logger.LogWarning(ex, "Failed to build GOLD option graph for expiry {Expiry}", normalizedExpiry);
            return StatusCode((int)ex.StatusCode, new ProblemDetails
            {
                Title = "MCX upstream request failed",
                Detail = ex.Message,
                Status = (int)ex.StatusCode
            });
        }
    }

    [HttpGet("gold/analysis")]
    [ProducesResponseType(typeof(OIAnalysisResult), StatusCodes.Status200OK)]
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

            var result = _analysisService.Analyze(options);
            return Ok(result);
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
