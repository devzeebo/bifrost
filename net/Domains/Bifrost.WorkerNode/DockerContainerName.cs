namespace Bifrost.WorkerNode;

public static class DockerContainerName
{
    public static string ForRun(Guid runId) => $"bifrost-run-{runId:D}";

    public static string? TryReadFromArguments(IReadOnlyList<string>? arguments)
    {
        if (arguments is null)
        {
            return null;
        }

        for (var i = 0; i < arguments.Count - 1; i++)
        {
            if (arguments[i] == "--name")
            {
                var name = arguments[i + 1];
                return string.IsNullOrWhiteSpace(name) ? null : name;
            }
        }

        return null;
    }

    public static bool IsDockerExecutable(string? fileName)
    {
        if (string.IsNullOrWhiteSpace(fileName))
        {
            return false;
        }

        var leaf = Path.GetFileNameWithoutExtension(fileName);
        return string.Equals(leaf, "docker", StringComparison.OrdinalIgnoreCase);
    }
}
