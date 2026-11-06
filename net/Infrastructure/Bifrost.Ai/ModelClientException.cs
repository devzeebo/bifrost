namespace Bifrost.Ai;

public sealed class ModelClientException : Exception
{
    public ModelClientException(string message)
        : base(message) { }

    public ModelClientException(string message, Exception innerException)
        : base(message, innerException) { }

    public int? StatusCode { get; init; }
}
