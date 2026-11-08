namespace Bifrost.Gateway;

public sealed class VirtualKeyQuotaException : Exception
{
    public int StatusCode { get; }

    public VirtualKeyQuotaException(string message, int statusCode)
        : base(message)
    {
        StatusCode = statusCode;
    }

    public VirtualKeyQuotaException(string message, int statusCode, Exception innerException)
        : base(message, innerException)
    {
        StatusCode = statusCode;
    }
}
