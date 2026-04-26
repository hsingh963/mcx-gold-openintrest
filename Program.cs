using GoldInrOpenIntrest.Api.Models;
using GoldInrOpenIntrest.Api.Services;
using Microsoft.AspNetCore.HttpLogging;
using Microsoft.Extensions.Options;
using System.Net;

var builder = WebApplication.CreateBuilder(args);

builder.Services.AddControllers();
builder.Services.AddMemoryCache();
builder.Services.AddEndpointsApiExplorer();
builder.Services.AddHttpLogging(logging =>
{
    logging.LoggingFields = HttpLoggingFields.RequestPropertiesAndHeaders |
                            HttpLoggingFields.ResponsePropertiesAndHeaders;
});

builder.Services.Configure<McxApiOptions>(builder.Configuration.GetSection(McxApiOptions.SectionName));

builder.Services.AddHttpClient<IMcxService, McxService>((sp, client) =>
{
    var options = sp.GetRequiredService<IOptions<McxApiOptions>>().Value;

    client.BaseAddress = new Uri(options.BaseUrl, UriKind.Absolute);
    client.Timeout = TimeSpan.FromSeconds(options.TimeoutSeconds);
    client.DefaultRequestHeaders.UserAgent.ParseAdd(options.UserAgent);
    client.DefaultRequestHeaders.Accept.ParseAdd(options.Accept);
    client.DefaultRequestHeaders.Referrer = new Uri(options.Referer, UriKind.Absolute);
    client.DefaultRequestHeaders.AcceptLanguage.ParseAdd("en-US,en;q=0.9");
    client.DefaultRequestHeaders.TryAddWithoutValidation("X-Requested-With", "XMLHttpRequest");
})
.ConfigurePrimaryHttpMessageHandler(() =>
{
    return new SocketsHttpHandler
    {
        AutomaticDecompression = DecompressionMethods.All,
        UseCookies = true,
        CookieContainer = new CookieContainer(),
        PooledConnectionLifetime = TimeSpan.FromMinutes(10),
        ConnectTimeout = TimeSpan.FromSeconds(15)
    };
});

builder.Services.AddSingleton<GraphService>();
builder.Services.AddSingleton<AnalysisService>();
builder.Services.AddSingleton<ExpiryService>();

var app = builder.Build();

app.UseExceptionHandler("/error");
app.UseHttpLogging();
app.UseDefaultFiles();
app.UseStaticFiles();

app.Map("/error", (HttpContext context) =>
{
    var problem = Results.Problem(
        title: "Unexpected server error",
        detail: "An unhandled exception occurred while processing the request.",
        statusCode: StatusCodes.Status500InternalServerError);

    return problem;
});

app.MapControllers();

app.MapGet("/", () => Results.Redirect("/index.html"));

app.Run();
