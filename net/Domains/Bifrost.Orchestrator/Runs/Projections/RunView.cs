using System.Text.Json.Nodes;
using Bifrost.Orchestrator.Contracts;
using Bifrost.Runs.Events;
using Marten.Events.Aggregation;

namespace Bifrost.Runs.Projections;

public class RunView : SingleStreamProjection<RunView.Model, Guid>
{
    public sealed record Model
    {
        public Guid Id { get; init; }
        public Guid WorkItemId { get; init; }
        public RunOutcome? Outcome { get; init; }
        public required JsonNode Data { get; init; }
        public required JsonObject Metadata { get; init; }
    }

    public Model Create(RunCreated e) =>
        new()
        {
            Id = e.Id,
            WorkItemId = e.WorkItemId,
            Outcome = null,
            Data = e.Data.DeepClone()!,
            Metadata = (JsonObject)e.Metadata.DeepClone()!,
        };

    public Model Apply(RunSucceeded _, Model view) =>
        view with
        {
            Outcome = RunOutcome.Succeeded,
        };

    public Model Apply(RunFailed _, Model view) =>
        view with
        {
            Outcome = RunOutcome.Failed,
        };

    public Model Apply(RunAbandoned _, Model view) =>
        view with
        {
            Outcome = RunOutcome.Abandoned,
        };

    public Model Apply(RunDataReplaced e, Model view) =>
        view with
        {
            Data = e.Data.DeepClone()!,
        };

    public Model Apply(RunMetadataReplaced e, Model view) =>
        view with
        {
            Metadata = (JsonObject)e.Metadata.DeepClone()!,
        };
}
