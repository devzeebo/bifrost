using System.Security.Cryptography;
using System.Text;

namespace Bifrost.Configuration;

public static class MartenApplyChangesLock
{
    public static int ForSchema(string schemaName)
    {
        ArgumentException.ThrowIfNullOrWhiteSpace(schemaName);
        var hash = MD5.HashData(Encoding.UTF8.GetBytes(schemaName));
        return BitConverter.ToInt32(hash);
    }
}
