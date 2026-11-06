namespace Bifrost.Capabilities.Evals;

public sealed class EvalLatestByEvalDocument
{
    public string Id { get; set; } = "";
    public Guid CapabilityId { get; set; }
    public Guid EvalId { get; set; }
    public Guid CriterionId { get; set; }
    public Guid CaseRunId { get; set; }
    public string Status { get; set; } = "";
    public Guid? CapabilityVersionId { get; set; }
    public Guid? SkillVersionId { get; set; }
    public DateTimeOffset RecordedAt { get; set; }

    public static string Key(Guid capabilityId, Guid evalId) => $"{capabilityId:N}:{evalId:N}";
}
