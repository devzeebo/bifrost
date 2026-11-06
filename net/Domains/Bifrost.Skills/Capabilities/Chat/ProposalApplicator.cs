using Bifrost.Capabilities.Editor;
using Bifrost.Skills.Contracts;

namespace Bifrost.Capabilities.Chat;

public static class ProposalApplicator
{
    public static (
        CapabilityVersionSnapshot Capability,
        string? SkillMarkdown,
        bool CapabilityChanged,
        bool SkillChanged
    ) Apply(CapabilityVersionSnapshot current, string currentSkillMarkdown, Proposal proposal)
    {
        var ask = current.Ask;
        var criteria = current.Criteria.ToList();
        var evals = current.Evals.ToList();
        string? skillMarkdown = null;
        var capabilityTouched = false;
        var skillTouched = false;

        foreach (var effect in proposal.Effects)
        {
            switch (effect.Kind)
            {
                case ProposalEffectKinds.AmendAsk:
                    if (string.IsNullOrWhiteSpace(effect.Ask))
                    {
                        throw new CommandValidationException("AmendAsk requires Ask.");
                    }

                    ask = effect.Ask.Trim();
                    capabilityTouched = true;
                    break;

                case ProposalEffectKinds.AddCriterion:
                    if (effect.CriterionId is null || string.IsNullOrWhiteSpace(effect.Statement))
                    {
                        throw new CommandValidationException(
                            "AddCriterion requires CriterionId and Statement."
                        );
                    }

                    if (criteria.Any(c => c.Id == effect.CriterionId))
                    {
                        throw new CommandValidationException(
                            $"Criterion {effect.CriterionId} already exists."
                        );
                    }

                    criteria.Add(
                        new CriterionSnapshot
                        {
                            Id = effect.CriterionId.Value,
                            Statement = effect.Statement.Trim(),
                        }
                    );
                    capabilityTouched = true;
                    break;

                case ProposalEffectKinds.SharpenCriterion:
                    if (effect.CriterionId is null || string.IsNullOrWhiteSpace(effect.Statement))
                    {
                        throw new CommandValidationException(
                            "SharpenCriterion requires CriterionId and Statement."
                        );
                    }

                    var sharpenIndex = criteria.FindIndex(c => c.Id == effect.CriterionId);
                    if (sharpenIndex < 0)
                    {
                        throw new CommandValidationException(
                            $"Criterion {effect.CriterionId} not found."
                        );
                    }

                    criteria[sharpenIndex] = new CriterionSnapshot
                    {
                        Id = effect.CriterionId.Value,
                        Statement = effect.Statement.Trim(),
                    };
                    capabilityTouched = true;
                    break;

                case ProposalEffectKinds.SplitCriterion:
                    if (
                        effect.CriterionId is null
                        || effect.NewCriteria is null
                        || effect.NewCriteria.Count != 2
                    )
                    {
                        throw new CommandValidationException(
                            "SplitCriterion requires CriterionId and exactly two NewCriteria."
                        );
                    }

                    if (criteria.All(c => c.Id != effect.CriterionId))
                    {
                        throw new CommandValidationException(
                            $"Criterion {effect.CriterionId} not found."
                        );
                    }

                    EnsureEvalsRetired(
                        proposal.Effects,
                        evals,
                        effect.CriterionId.Value,
                        "SplitCriterion"
                    );

                    criteria.RemoveAll(c => c.Id == effect.CriterionId);
                    foreach (var created in effect.NewCriteria)
                    {
                        if (string.IsNullOrWhiteSpace(created.Statement))
                        {
                            throw new CommandValidationException(
                                "SplitCriterion replacements require a Statement."
                            );
                        }

                        if (created.Id == effect.CriterionId)
                        {
                            throw new CommandValidationException(
                                "SplitCriterion replacements cannot reuse the source CriterionId."
                            );
                        }

                        if (criteria.Any(c => c.Id == created.Id))
                        {
                            throw new CommandValidationException(
                                $"Criterion {created.Id} already exists."
                            );
                        }

                        criteria.Add(
                            new CriterionSnapshot
                            {
                                Id = created.Id,
                                Statement = created.Statement.Trim(),
                            }
                        );
                    }

                    capabilityTouched = true;
                    break;

                case ProposalEffectKinds.RetireCriterion:
                    if (effect.CriterionId is null)
                    {
                        throw new CommandValidationException("RetireCriterion requires CriterionId.");
                    }

                    if (criteria.All(c => c.Id != effect.CriterionId))
                    {
                        throw new CommandValidationException(
                            $"Criterion {effect.CriterionId} not found."
                        );
                    }

                    EnsureEvalsRetired(
                        proposal.Effects,
                        evals,
                        effect.CriterionId.Value,
                        "RetireCriterion"
                    );

                    criteria.RemoveAll(c => c.Id == effect.CriterionId);
                    capabilityTouched = true;
                    break;

                case ProposalEffectKinds.AddEval:
                    if (
                        effect.EvalId is null
                        || effect.CriterionId is null
                        || string.IsNullOrWhiteSpace(effect.Scenario)
                    )
                    {
                        throw new CommandValidationException(
                            "AddEval requires EvalId, CriterionId, and Scenario."
                        );
                    }

                    if (criteria.All(c => c.Id != effect.CriterionId))
                    {
                        throw new CommandValidationException(
                            $"Criterion {effect.CriterionId} not found."
                        );
                    }

                    if (evals.Any(e => e.Id == effect.EvalId))
                    {
                        throw new CommandValidationException($"Eval {effect.EvalId} already exists.");
                    }

                    var addChecks = NormalizeChecks(effect.Checks);
                    RequireAtLeastOneCheck(addChecks, "AddEval");

                    evals.Add(
                        new EvalSnapshot
                        {
                            Id = effect.EvalId.Value,
                            CriterionId = effect.CriterionId.Value,
                            Scenario = effect.Scenario.Trim(),
                            Prompt = (effect.Prompt ?? "").Trim(),
                            Context = (effect.Context ?? "").Trim(),
                            Checks = addChecks,
                        }
                    );
                    capabilityTouched = true;
                    break;

                case ProposalEffectKinds.AmendEval:
                    if (effect.EvalId is null || string.IsNullOrWhiteSpace(effect.Scenario))
                    {
                        throw new CommandValidationException(
                            "AmendEval requires EvalId and Scenario."
                        );
                    }

                    var evalIndex = evals.FindIndex(e => e.Id == effect.EvalId);
                    if (evalIndex < 0)
                    {
                        throw new CommandValidationException($"Eval {effect.EvalId} not found.");
                    }

                    var existing = evals[evalIndex];
                    var criterionId = effect.CriterionId ?? existing.CriterionId;
                    if (criteria.All(c => c.Id != criterionId))
                    {
                        throw new CommandValidationException($"Criterion {criterionId} not found.");
                    }

                    IReadOnlyList<CheckSnapshot> amendChecks;
                    if (effect.Checks is null)
                    {
                        amendChecks = existing.Checks.ToArray();
                    }
                    else
                    {
                        amendChecks = NormalizeChecks(effect.Checks);
                        RequireAtLeastOneCheck(amendChecks, "AmendEval");
                    }

                    evals[evalIndex] = new EvalSnapshot
                    {
                        Id = effect.EvalId.Value,
                        CriterionId = criterionId,
                        Scenario = effect.Scenario.Trim(),
                        Prompt = effect.Prompt is null ? existing.Prompt : effect.Prompt.Trim(),
                        Context = effect.Context is null ? existing.Context : effect.Context.Trim(),
                        Checks = amendChecks,
                    };
                    capabilityTouched = true;
                    break;

                case ProposalEffectKinds.DuplicateEval:
                    if (effect.EvalId is null || effect.SourceEvalId is null)
                    {
                        throw new CommandValidationException(
                            "DuplicateEval requires EvalId and SourceEvalId."
                        );
                    }

                    var source =
                        evals.FirstOrDefault(e => e.Id == effect.SourceEvalId)
                        ?? throw new CommandValidationException(
                            $"Eval {effect.SourceEvalId} not found."
                        );

                    if (evals.Any(e => e.Id == effect.EvalId))
                    {
                        throw new CommandValidationException($"Eval {effect.EvalId} already exists.");
                    }

                    evals.Add(
                        new EvalSnapshot
                        {
                            Id = effect.EvalId.Value,
                            CriterionId = source.CriterionId,
                            Scenario = source.Scenario,
                            Prompt = source.Prompt,
                            Context = source.Context,
                            Checks =
                            [
                                .. source.Checks.Select(check => new CheckSnapshot
                                {
                                    Id = Guid.NewGuid(),
                                    Statement = check.Statement,
                                    Kind = check.Kind,
                                    Script = check.Script,
                                }),
                            ],
                        }
                    );
                    capabilityTouched = true;
                    break;

                case ProposalEffectKinds.RetireEval:
                    if (effect.EvalId is null)
                    {
                        throw new CommandValidationException("RetireEval requires EvalId.");
                    }

                    if (evals.All(e => e.Id != effect.EvalId))
                    {
                        throw new CommandValidationException($"Eval {effect.EvalId} not found.");
                    }

                    evals.RemoveAll(e => e.Id == effect.EvalId);
                    capabilityTouched = true;
                    break;

                case ProposalEffectKinds.ReplaceSkill:
                    if (effect.Markdown is null)
                    {
                        throw new CommandValidationException("ReplaceSkill requires Markdown.");
                    }

                    skillMarkdown = effect.Markdown;
                    skillTouched = true;
                    break;

                default:
                    throw new CommandValidationException($"Unknown proposal effect kind '{effect.Kind}'.");
            }
        }

        var capabilitySnapshot = new CapabilityVersionSnapshot
        {
            Ask = ask,
            Criteria = criteria,
            Evals = evals,
        };

        var capabilityChanged =
            capabilityTouched
            && (
                capabilitySnapshot.Ask != current.Ask
                || !SameCriteria(capabilitySnapshot.Criteria, current.Criteria)
                || !SameEvals(capabilitySnapshot.Evals, current.Evals)
            );

        var skillChanged =
            skillTouched && !string.Equals(skillMarkdown, currentSkillMarkdown, StringComparison.Ordinal);

        return (capabilitySnapshot, skillMarkdown, capabilityChanged, skillChanged);
    }

    public static bool IsFresh(
        Proposal proposal,
        Guid? currentCapabilityVersionId,
        CapabilityVersionSnapshot currentCapability,
        string skillMarkdown
    ) =>
        proposal.ExpectedCapabilityVersionId == currentCapabilityVersionId
        && proposal.ExpectedSkillMarkdown == skillMarkdown
        && (
            proposal.ExpectedCapabilitySnapshot is null
            || SameCapability(proposal.ExpectedCapabilitySnapshot, currentCapability)
        );

    public static void ValidateEffects(
        CapabilityVersionSnapshot current,
        string currentSkillMarkdown,
        IReadOnlyList<ProposalEffect> effects
    )
    {
        var probe = new Proposal
        {
            Id = Guid.Empty,
            CreatedAt = DateTimeOffset.UnixEpoch,
            Summary = "validation",
            ExpectedSkillMarkdown = currentSkillMarkdown,
            Effects = effects,
        };
        _ = Apply(current, currentSkillMarkdown, probe);
    }

    static void EnsureEvalsRetired(
        IReadOnlyList<ProposalEffect> effects,
        IReadOnlyList<EvalSnapshot> evals,
        Guid criterionId,
        string kind
    )
    {
        var remaining = evals.Where(e => e.CriterionId == criterionId).ToList();
        if (remaining.Count == 0)
        {
            return;
        }

        var retired = effects
            .Where(e => e.Kind == ProposalEffectKinds.RetireEval && e.EvalId is not null)
            .Select(e => e.EvalId!.Value)
            .ToHashSet();

        var missing = remaining.Where(e => !retired.Contains(e.Id)).Select(e => e.Id).ToList();
        if (missing.Count > 0)
        {
            throw new CommandValidationException(
                $"{kind} requires RetireEval effects for evals {string.Join(", ", missing)} before removing criterion {criterionId}."
            );
        }
    }

    static bool SameCapability(
        CapabilityVersionSnapshot left,
        CapabilityVersionSnapshot right
    ) =>
        left.Ask == right.Ask
        && SameCriteria(left.Criteria, right.Criteria)
        && SameEvals(left.Evals, right.Evals);

    static bool SameCriteria(
        IReadOnlyList<CriterionSnapshot> left,
        IReadOnlyList<CriterionSnapshot> right
    )
    {
        if (left.Count != right.Count)
        {
            return false;
        }

        for (var i = 0; i < left.Count; i++)
        {
            if (left[i].Id != right[i].Id || left[i].Statement != right[i].Statement)
            {
                return false;
            }
        }

        return true;
    }

    public static IReadOnlyList<CriterionSnapshot> CriteriaLeftUncoveredByRetire(
        IReadOnlyList<EvalSnapshot> before,
        IReadOnlyList<EvalSnapshot> after,
        IReadOnlyList<CriterionSnapshot> survivingCriteria,
        IReadOnlyList<ProposalEffect> effects
    )
    {
        var retiredIds = effects
            .Where(e => e.Kind == ProposalEffectKinds.RetireEval && e.EvalId is not null)
            .Select(e => e.EvalId!.Value)
            .ToHashSet();

        if (retiredIds.Count == 0)
        {
            return [];
        }

        var survivingById = survivingCriteria.ToDictionary(c => c.Id);
        var criterionIds = before
            .Where(e => retiredIds.Contains(e.Id))
            .Select(e => e.CriterionId)
            .Distinct()
            .ToList();

        return
        [
            .. criterionIds
                .Where(criterionId =>
                    survivingById.ContainsKey(criterionId)
                    && after.All(e => e.CriterionId != criterionId)
                )
                .Select(criterionId => survivingById[criterionId]),
        ];
    }

    static IReadOnlyList<CheckSnapshot> NormalizeChecks(IReadOnlyList<CheckSnapshot>? checks)
    {
        if (checks is null || checks.Count == 0)
        {
            return [];
        }

        var normalized = new List<CheckSnapshot>(checks.Count);
        var seen = new HashSet<Guid>();
        foreach (var check in checks)
        {
            if (string.IsNullOrWhiteSpace(check.Statement))
            {
                throw new CommandValidationException("Each check requires a Statement.");
            }

            if (!seen.Add(check.Id))
            {
                throw new CommandValidationException($"Check {check.Id} is duplicated.");
            }

            string kind;
            try
            {
                kind = CheckDerivation.RequireKind(check.Kind);
            }
            catch (ArgumentException ex)
            {
                throw new CommandValidationException(ex.Message);
            }

            var statement = check.Statement.Trim();
            var script = string.IsNullOrWhiteSpace(check.Script) ? null : check.Script.Trim();
            if (kind == CheckKinds.Script && script is null)
            {
                // Legacy statement-only checks (and incomplete proposals): hydrate a body, keep id.
                script = CheckDerivation.HydrateScript(check.Id, statement);
            }

            if (kind == CheckKinds.HumanReview && script is not null)
            {
                throw new CommandValidationException(
                    "HumanReview checks must not carry a Script body."
                );
            }

            normalized.Add(
                new CheckSnapshot
                {
                    Id = check.Id,
                    Statement = statement,
                    Kind = kind,
                    Script = script,
                }
            );
        }

        return normalized;
    }

    static void RequireAtLeastOneCheck(IReadOnlyList<CheckSnapshot> checks, string kind)
    {
        if (checks.Count == 0)
        {
            throw new CommandValidationException($"{kind} requires at least one check.");
        }
    }

    static bool SameEvals(IReadOnlyList<EvalSnapshot> left, IReadOnlyList<EvalSnapshot> right)
    {
        if (left.Count != right.Count)
        {
            return false;
        }

        for (var i = 0; i < left.Count; i++)
        {
            if (
                left[i].Id != right[i].Id
                || left[i].CriterionId != right[i].CriterionId
                || left[i].Scenario != right[i].Scenario
                || left[i].Prompt != right[i].Prompt
                || left[i].Context != right[i].Context
                || !SameChecks(left[i].Checks, right[i].Checks)
            )
            {
                return false;
            }
        }

        return true;
    }

    static bool SameChecks(IReadOnlyList<CheckSnapshot> left, IReadOnlyList<CheckSnapshot> right)
    {
        if (left.Count != right.Count)
        {
            return false;
        }

        for (var i = 0; i < left.Count; i++)
        {
            if (
                left[i].Id != right[i].Id
                || left[i].Statement != right[i].Statement
                || !string.Equals(left[i].Kind, right[i].Kind, StringComparison.Ordinal)
                || !string.Equals(left[i].Script, right[i].Script, StringComparison.Ordinal)
            )
            {
                return false;
            }
        }

        return true;
    }
}
