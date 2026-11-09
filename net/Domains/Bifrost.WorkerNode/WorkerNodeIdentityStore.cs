namespace Bifrost.WorkerNode;

public static class WorkerNodeIdentityStore
{
    public static Guid Resolve(string outboxPath, string? configuredNodeId)
    {
        if (Guid.TryParse(configuredNodeId, out var configured) && configured != Guid.Empty)
        {
            return configured;
        }

        var path = IdentityPath(outboxPath);
        if (File.Exists(path) && Guid.TryParse(File.ReadAllText(path).Trim(), out var stored)
            && stored != Guid.Empty)
        {
            return stored;
        }

        var minted = Guid.NewGuid();
        var directory = Path.GetDirectoryName(path);
        if (!string.IsNullOrEmpty(directory))
        {
            Directory.CreateDirectory(directory);
        }

        File.WriteAllText(path, minted.ToString("D"));
        return minted;
    }

    static string IdentityPath(string outboxPath)
    {
        var directory = Path.GetDirectoryName(Path.GetFullPath(outboxPath));
        return Path.Combine(
            string.IsNullOrEmpty(directory) ? "." : directory,
            "worker-node-id"
        );
    }
}
