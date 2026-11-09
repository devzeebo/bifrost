using Microsoft.Data.Sqlite;

namespace Bifrost.WorkerNode;

public enum HarnessAcceptState
{
    Accepted,
    Running,
    Concluded,
}

public interface IHarnessAcceptStore
{
    /// <summary>
    /// Returns true when this (work item, run) pair was newly accepted.
    /// </summary>
    bool TryAccept(Guid workItemId, Guid runId);

    bool TryBeginRunning(Guid workItemId, Guid runId);

    void MarkConcluded(Guid workItemId, Guid runId);

    HarnessAcceptState? GetState(Guid workItemId, Guid runId);
}

public sealed class HarnessAcceptStore : IHarnessAcceptStore, IDisposable
{
    readonly SqliteConnection _connection;
    readonly object _gate = new();

    public HarnessAcceptStore(string databasePath)
    {
        var directory = Path.GetDirectoryName(databasePath);
        if (!string.IsNullOrEmpty(directory))
        {
            Directory.CreateDirectory(directory);
        }

        _connection = new SqliteConnection($"Data Source={databasePath}");
        _connection.Open();
        using var cmd = _connection.CreateCommand();
        cmd.CommandText = """
            CREATE TABLE IF NOT EXISTS harness_accepts (
                work_item_id TEXT NOT NULL,
                run_id TEXT NOT NULL,
                state TEXT NOT NULL,
                PRIMARY KEY (work_item_id, run_id)
            );
            """;
        cmd.ExecuteNonQuery();
    }

    public bool TryAccept(Guid workItemId, Guid runId)
    {
        lock (_gate)
        {
            var existing = GetStateLocked(workItemId, runId);
            if (existing is not null)
            {
                return false;
            }

            using var cmd = _connection.CreateCommand();
            cmd.CommandText = """
                INSERT INTO harness_accepts (work_item_id, run_id, state)
                VALUES ($workItemId, $runId, $state);
                """;
            cmd.Parameters.AddWithValue("$workItemId", workItemId.ToString("D"));
            cmd.Parameters.AddWithValue("$runId", runId.ToString("D"));
            cmd.Parameters.AddWithValue("$state", nameof(HarnessAcceptState.Accepted));
            cmd.ExecuteNonQuery();
            return true;
        }
    }

    public bool TryBeginRunning(Guid workItemId, Guid runId)
    {
        lock (_gate)
        {
            var existing = GetStateLocked(workItemId, runId);
            if (existing is HarnessAcceptState.Concluded)
            {
                return false;
            }

            if (existing is HarnessAcceptState.Running)
            {
                return true;
            }

            if (existing is null)
            {
                return false;
            }

            using var cmd = _connection.CreateCommand();
            cmd.CommandText = """
                UPDATE harness_accepts
                SET state = $state
                WHERE work_item_id = $workItemId AND run_id = $runId;
                """;
            cmd.Parameters.AddWithValue("$state", nameof(HarnessAcceptState.Running));
            cmd.Parameters.AddWithValue("$workItemId", workItemId.ToString("D"));
            cmd.Parameters.AddWithValue("$runId", runId.ToString("D"));
            cmd.ExecuteNonQuery();
            return true;
        }
    }

    public void MarkConcluded(Guid workItemId, Guid runId)
    {
        lock (_gate)
        {
            using var cmd = _connection.CreateCommand();
            cmd.CommandText = """
                INSERT INTO harness_accepts (work_item_id, run_id, state)
                VALUES ($workItemId, $runId, $state)
                ON CONFLICT(work_item_id, run_id) DO UPDATE SET state = $state;
                """;
            cmd.Parameters.AddWithValue("$workItemId", workItemId.ToString("D"));
            cmd.Parameters.AddWithValue("$runId", runId.ToString("D"));
            cmd.Parameters.AddWithValue("$state", nameof(HarnessAcceptState.Concluded));
            cmd.ExecuteNonQuery();
        }
    }

    public HarnessAcceptState? GetState(Guid workItemId, Guid runId)
    {
        lock (_gate)
        {
            return GetStateLocked(workItemId, runId);
        }
    }

    public void Dispose() => _connection.Dispose();

    HarnessAcceptState? GetStateLocked(Guid workItemId, Guid runId)
    {
        using var cmd = _connection.CreateCommand();
        cmd.CommandText = """
            SELECT state FROM harness_accepts
            WHERE work_item_id = $workItemId AND run_id = $runId;
            """;
        cmd.Parameters.AddWithValue("$workItemId", workItemId.ToString("D"));
        cmd.Parameters.AddWithValue("$runId", runId.ToString("D"));
        var value = cmd.ExecuteScalar() as string;
        return value is null ? null : Enum.Parse<HarnessAcceptState>(value);
    }
}
