namespace Bifrost.Rpc;

/// <summary>
/// Well-known env / argv keys for peer processes launched by the host.
/// Shared by host (launch) and peer (connect).
/// </summary>
public static class RpcConnectionKeys
{
    public static string? GetArgValue(string[] args, string name)
    {
        for (var i = 0; i < args.Length - 1; i++)
        {
            if (string.Equals(args[i], name, StringComparison.Ordinal))
            {
                return args[i + 1];
            }
        }

        return null;
    }

    public const string SocketEnv = "BIFROST_SOCKET";
    public const string InstanceIdEnv = "BIFROST_INSTANCE_ID";
    public const string RoleEnv = "BIFROST_ROLE";

    public const string SocketArg = "--bifrost-socket";
    public const string InstanceIdArg = "--bifrost-instance-id";
    public const string RoleArg = "--bifrost-role";
}
