using Bifrost.Skills.Contracts;

namespace Bifrost.Capabilities.Evals;

public sealed class EvalSuiteRunDocument
{
    public Guid Id { get; set; }
    public Guid CapabilityId { get; set; }
    public Guid? SkillVersionId { get; set; }
    public string Status { get; set; } = EvalSuiteRunStatuses.Running;
    public bool CancelRequested { get; set; }
    public List<Guid> EvalIds { get; set; } = [];
    public List<Guid> CaseRunIds { get; set; } = [];
    public SuiteEvalSummary Summary { get; set; } = new();
    public DateTimeOffset StartedAt { get; set; }
    public DateTimeOffset? CompletedAt { get; set; }
}
