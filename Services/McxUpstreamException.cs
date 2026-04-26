using System.Net;

namespace GoldInrOpenIntrest.Api.Services;

public sealed class McxUpstreamException : Exception
{
    public McxUpstreamException(string message, HttpStatusCode statusCode, Exception? innerException = null)
        : base(message, innerException)
    {
        StatusCode = statusCode;
    }

    public HttpStatusCode StatusCode { get; }
}

