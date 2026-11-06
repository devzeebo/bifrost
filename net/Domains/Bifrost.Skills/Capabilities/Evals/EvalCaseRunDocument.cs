using Bifrost.Skills.Contracts;

namespace Bifrost.Capabilities.Evals;

public sealed class EvalCaseRunDocument
{
    public Guid Id { get; set; }
    public Guid CapabilityId { get; set; }
    public Guid EvalId { get; set; }
    public Guid CriterionId { get; set; }
    public Guid? SuiteRunId { get; set; }
    public Guid? SkillVersionId { get; set; }
    public Guid? CapabilityVersionId { get; set; }
    public string SkillMarkdown { get; set; } = "";
    public bool IsEval { get; set; } = true;
    public string Status { get; set; } = EvalCaseRunStatuses.Running;
    public string? Outcome { get; set; }
    public List<TranscriptLine> Transcript { get; set; } = [];
    public EvalSpend? Spend { get; set; }
    public List<EvalCheckVerdict> Checks { get; set; } = [];
    public DateTimeOffset StartedAt { get; set; }
    public DateTimeOffset? CompletedAt { get; set; }
}
