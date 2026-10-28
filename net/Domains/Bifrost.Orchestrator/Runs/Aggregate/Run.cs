using System.Text.Json;
using System.Text.Json.Nodes;
using Bifrost.Orchestrator.Contracts;
using Bifrost.Runs.Events;

namespace Bifrost.Runs.Aggregate;

public class Run
{
    public Guid Id { get; set; }
    public Guid WorkItemId { get; set; }
    public RunOutcome? Outcome { get; set; }
    public required JsonNode Data { get; set; }
    public JsonObject Metadata { get; set; } = new();

    public void Apply(RunCreated e)
    {
        Id = e.Id;
        WorkItemId = e.WorkItemId;
        Outcome = null;
        Data = e.Data.DeepClone()!;
        Metadata = (JsonObject)e.Metadata.DeepClone()!;
    }

    public void Apply(RunSucceeded _) => Outcome = RunOutcome.Succeeded;

    public void Apply(RunFailed _) => Outcome = RunOutcome.Failed;

    public void Apply(RunAbandoned _) => Outcome = RunOutcome.Abandoned;

    public void Apply(RunDataReplaced e) => Data = e.Data.DeepClone()!;

    public void Apply(RunMetadataReplaced e) => Metadata = (JsonObject)e.Metadata.DeepClone()!;

    public void EnsureExpected(JsonObject? expected)
    {
        if (expected is null || expected.Count == 0)
        {
            return;
        }

        var state = new JsonObject
        {
            ["outcome"] =
                Outcome is null
                    ? null
                    : JsonValue.Create(
                        JsonNamingPolicy.CamelCase.ConvertName(Outcome.Value.ToString())
                    ),
            ["data"] = Data.DeepClone(),
            ["metadata"] = Metadata.DeepClone(),
        };
        if (!state.MatchesPartial(expected))
        {
            throw new CommandValidationException("Run no longer matches the expected state.");
        }
    }

    public void EnsureCanEnd(JsonObject? expected)
    {
        EnsureExpected(expected);
        if (Outcome is not null && expected is { Count: > 0 })
        {
            throw new CommandValidationException("Run already has an outcome.");
        }
    }
}
