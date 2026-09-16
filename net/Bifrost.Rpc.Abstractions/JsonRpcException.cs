namespace Bifrost.Rpc;

public sealed class JsonRpcException : Exception
{
    public int Code { get; }

    public JsonRpcException(int code, string message)
        : base(message)
    {
        Code = code;
    }
}

public static class JsonRpcErrorCodes
{
    public const int ParseError = -32700;
    public const int InvalidRequest = -32600;
    public const int MethodNotFound = -32601;
    public const int InvalidParams = -32602;
    public const int InternalError = -32603;

    public const int PrimaryUnavailable = -32001;
    public const int NotReady = -32002;
    public const int ProcessFailed = -32003;
}
