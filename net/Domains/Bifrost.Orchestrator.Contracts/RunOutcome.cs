using System.Text.Json;
using System.Text.Json.Serialization;

namespace Bifrost.Orchestrator.Contracts;

[JsonConverter(typeof(RunOutcomeJsonConverter))]
public enum RunOutcome
{
    Succeeded = 0,
    Failed = 1,
    Abandoned = 2,
}

public sealed class RunOutcomeJsonConverter : JsonStringEnumConverter
{
    public RunOutcomeJsonConverter()
        : base(JsonNamingPolicy.CamelCase) { }
}
