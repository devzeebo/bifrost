using Bifrost.Skills.Contracts;

namespace Bifrost.Capabilities.Editor;

/// <summary>
/// Deterministic editor for tests and local development without an LLM.
/// Recognizes a small set of user phrases and returns structured proposals.
/// </summary>
public sealed class ScriptedCapabilityEditor : ICapabilityEditor
{
    public Task<EditorTurn> Compose(
        EditorContext context,
        string userMessage,
        CancellationToken ct
    ) => Task.FromResult(ComposeSync(context, userMessage));

    public Task<EditorTurn> Reread(
        EditorContext context,
        Proposal stale,
        CancellationToken ct
    )
    {
        if (stale.Effects.Count == 0)
        {
            return Task.FromResult(
                new EditorTurn
                {
                    AssistantText = "The prior proposal no longer applies.",
                    WithdrawNote = "Withdrawn after re-read: nothing left to apply.",
                }
            );
        }

        var rebuilt = RebuildEffects(context, stale.Effects);
        if (rebuilt is null)
        {
            return Task.FromResult(
                new EditorTurn
                {
                    AssistantText =
                        "I re-read the capability; the earlier proposal no longer fits and was withdrawn.",
                    WithdrawNote = "Withdrawn after re-read against current material.",
                }
            );
        }

        return Task.FromResult(
            new EditorTurn
            {
                AssistantText =
                    "The capability changed while I was working. Here is an updated proposal against the current material.",
                ProposalSummary = stale.Summary + " (re-read)",
                Effects = rebuilt,
            }
        );
    }

    static EditorTurn ComposeSync(EditorContext context, string userMessage)
    {
        var text = userMessage.Trim();
        if (text.StartsWith("add criterion:", StringComparison.OrdinalIgnoreCase))
        {
            var statement = text["add criterion:".Length..].Trim();
            var criterionId = Guid.NewGuid();
            return new EditorTurn
            {
                AssistantText = "Proposed adding a criterion.",
                ProposalSummary = "Add criterion",
                Effects =
                [
                    new ProposalEffect
                    {
                        Kind = ProposalEffectKinds.AddCriterion,
                        Description = "Add criterion",
                        CriterionId = criterionId,
                        Statement = statement,
                    },
                ],
            };
        }

        if (text.StartsWith("sharpen ", StringComparison.OrdinalIgnoreCase))
        {
            return Sharpen(context, text["sharpen ".Length..].Trim());
        }

        if (text.StartsWith("split ", StringComparison.OrdinalIgnoreCase))
        {
            return Split(context, text["split ".Length..].Trim());
        }

        if (text.StartsWith("retire eval ", StringComparison.OrdinalIgnoreCase))
        {
            return RetireEval(context, text["retire eval ".Length..].Trim());
        }

        if (text.StartsWith("retire ", StringComparison.OrdinalIgnoreCase))
        {
            return Retire(context, text["retire ".Length..].Trim());
        }

        if (text.StartsWith("add eval ", StringComparison.OrdinalIgnoreCase))
        {
            return AddEval(context, text["add eval ".Length..].Trim());
        }

        if (text.StartsWith("duplicate eval ", StringComparison.OrdinalIgnoreCase))
        {
            return DuplicateEval(context, text["duplicate eval ".Length..].Trim());
        }

        if (text.StartsWith("amend eval ", StringComparison.OrdinalIgnoreCase))
        {
            return AmendEval(context, text["amend eval ".Length..].Trim());
        }

        if (text.StartsWith("reword ask:", StringComparison.OrdinalIgnoreCase))
        {
            var ask = text["reword ask:".Length..].Trim();
            return new EditorTurn
            {
                AssistantText = "Proposed a rewording of the ask.",
                ProposalSummary = "Amend ask",
                Effects =
                [
                    new ProposalEffect
                    {
                        Kind = ProposalEffectKinds.AmendAsk,
                        Description = "Reword the ask",
                        Ask = ask,
                    },
                ],
            };
        }

        if (text.StartsWith("replace skill:", StringComparison.OrdinalIgnoreCase))
        {
            var markdown = text["replace skill:".Length..].Trim();
            return new EditorTurn
            {
                AssistantText = "Proposed a skill draft replacement.",
                ProposalSummary = "Replace derived skill",
                Effects =
                [
                    new ProposalEffect
                    {
                        Kind = ProposalEffectKinds.ReplaceSkill,
                        Description = "Replace skill markdown",
                        Markdown = markdown,
                        ServedCriterionIds = [.. context.Criteria.Select(c => c.Id)],
                    },
                ],
            };
        }

        if (text.StartsWith("bundle:", StringComparison.OrdinalIgnoreCase))
        {
            return Bundle(context, text["bundle:".Length..].Trim());
        }

        if (text.Equals("withdraw-on-reread", StringComparison.OrdinalIgnoreCase))
        {
            return new EditorTurn
            {
                AssistantText = "I have nothing to propose.",
                ProposalSummary = "Placeholder that withdraws on re-read",
                Effects = [],
            };
        }

        return new EditorTurn
        {
            AssistantText =
                "I can help edit this capability. Try: add criterion: …, sharpen <criterion-id>:<statement>, split <criterion-id>, retire <criterion-id>, add eval <criterion-id>:<scenario>, amend eval <eval-id>:<scenario>, duplicate eval <eval-id>, retire eval <eval-id>, reword ask: …, replace skill: …, or bundle: …",
        };
    }

    static EditorTurn Sharpen(EditorContext context, string rest)
    {
        var parts = rest.Split(':', 2, StringSplitOptions.TrimEntries);
        if (
            parts.Length != 2
            || !Guid.TryParse(parts[0], out var criterionId)
            || context.Criteria.All(c => c.Id != criterionId)
        )
        {
            return new EditorTurn
            {
                AssistantText = "Sharpen needs an existing criterion id and new statement: sharpen <id>:<statement>",
            };
        }

        return new EditorTurn
        {
            AssistantText = "Proposed sharpening a criterion in place.",
            ProposalSummary = "Sharpen criterion",
            Effects =
            [
                new ProposalEffect
                {
                    Kind = ProposalEffectKinds.SharpenCriterion,
                    Description = "Sharpen criterion wording",
                    CriterionId = criterionId,
                    Statement = parts[1],
                },
            ],
        };
    }

    static EditorTurn Split(EditorContext context, string rest)
    {
        if (
            !Guid.TryParse(rest, out var criterionId)
            || context.Criteria.FirstOrDefault(c => c.Id == criterionId) is not { } source
        )
        {
            return new EditorTurn
            {
                AssistantText = "Split needs an existing criterion id: split <id>",
            };
        }

        var leftId = Guid.NewGuid();
        var rightId = Guid.NewGuid();
        var effects = RetireEvalsForCriterion(context, criterionId);
        effects.Add(
            new ProposalEffect
            {
                Kind = ProposalEffectKinds.SplitCriterion,
                Description = $"Split criterion {criterionId}",
                CriterionId = criterionId,
                NewCriteria =
                [
                    new CriterionSnapshot
                    {
                        Id = leftId,
                        Statement = source.Statement + " (part A)",
                    },
                    new CriterionSnapshot
                    {
                        Id = rightId,
                        Statement = source.Statement + " (part B)",
                    },
                ],
            }
        );
        return new EditorTurn
        {
            AssistantText = "Proposed splitting a criterion into two.",
            ProposalSummary = "Split criterion",
            Effects = effects,
        };
    }

    static EditorTurn Retire(EditorContext context, string rest)
    {
        if (
            !Guid.TryParse(rest, out var criterionId)
            || context.Criteria.All(c => c.Id != criterionId)
        )
        {
            return new EditorTurn
            {
                AssistantText = "Retire needs an existing criterion id: retire <id>",
            };
        }

        var effects = RetireEvalsForCriterion(context, criterionId);
        effects.Add(
            new ProposalEffect
            {
                Kind = ProposalEffectKinds.RetireCriterion,
                Description = $"Retire criterion {criterionId}",
                CriterionId = criterionId,
            }
        );
        return new EditorTurn
        {
            AssistantText = "Proposed retiring a criterion.",
            ProposalSummary = "Retire criterion",
            Effects = effects,
        };
    }

    static List<ProposalEffect> RetireEvalsForCriterion(EditorContext context, Guid criterionId) =>
        [
            .. context
                .Evals.Where(e => e.CriterionId == criterionId)
                .Select(e => new ProposalEffect
                {
                    Kind = ProposalEffectKinds.RetireEval,
                    Description = $"Retire eval for criterion {criterionId}",
                    EvalId = e.Id,
                    CriterionId = e.CriterionId,
                    Scenario = e.Scenario,
                }),
        ];

    static EditorTurn AddEval(EditorContext context, string rest)
    {
        var parts = rest.Split(':', 2, StringSplitOptions.TrimEntries);
        if (
            parts.Length != 2
            || !Guid.TryParse(parts[0], out var criterionId)
            || context.Criteria.All(c => c.Id != criterionId)
        )
        {
            return new EditorTurn
            {
                AssistantText = "Add eval needs criterion id and scenario: add eval <id>:<scenario>",
            };
        }

        var scenario = parts[1];
        return new EditorTurn
        {
            AssistantText = "Proposed adding an eval.",
            ProposalSummary = "Add eval",
            Effects =
            [
                new ProposalEffect
                {
                    Kind = ProposalEffectKinds.AddEval,
                    Description = "Add eval scenario",
                    EvalId = Guid.NewGuid(),
                    CriterionId = criterionId,
                    Scenario = scenario,
                    Prompt = scenario,
                    Context = "",
                    Checks =
                    [
                        new CheckSnapshot
                        {
                            Id = Guid.NewGuid(),
                            Statement = $"The work satisfies: {scenario}",
                        },
                    ],
                },
            ],
        };
    }

    static EditorTurn AmendEval(EditorContext context, string rest)
    {
        var parts = rest.Split(':', 2, StringSplitOptions.TrimEntries);
        if (
            parts.Length != 2
            || !Guid.TryParse(parts[0], out var evalId)
            || context.Evals.FirstOrDefault(e => e.Id == evalId) is not { } existing
        )
        {
            return new EditorTurn
            {
                AssistantText = "Amend eval needs an existing eval id and scenario: amend eval <id>:<scenario>",
            };
        }

        var scenario = parts[1];
        return new EditorTurn
        {
            AssistantText = "Proposed amending an eval in place.",
            ProposalSummary = "Amend eval",
            Effects =
            [
                new ProposalEffect
                {
                    Kind = ProposalEffectKinds.AmendEval,
                    Description = "Amend eval scenario",
                    EvalId = evalId,
                    CriterionId = existing.CriterionId,
                    Scenario = scenario,
                    Prompt = scenario,
                    Context = existing.Context,
                    Checks =
                    [
                        new CheckSnapshot
                        {
                            Id = existing.Checks.FirstOrDefault()?.Id ?? Guid.NewGuid(),
                            Statement = $"The work satisfies: {scenario}",
                        },
                    ],
                },
            ],
        };
    }

    static EditorTurn DuplicateEval(EditorContext context, string rest)
    {
        if (
            !Guid.TryParse(rest, out var sourceEvalId)
            || context.Evals.All(e => e.Id != sourceEvalId)
        )
        {
            return new EditorTurn
            {
                AssistantText = "Duplicate eval needs an existing eval id: duplicate eval <id>",
            };
        }

        return new EditorTurn
        {
            AssistantText = "Proposed duplicating an eval.",
            ProposalSummary = "Duplicate eval",
            Effects =
            [
                new ProposalEffect
                {
                    Kind = ProposalEffectKinds.DuplicateEval,
                    Description = "Duplicate eval",
                    SourceEvalId = sourceEvalId,
                    EvalId = Guid.NewGuid(),
                },
            ],
        };
    }

    static EditorTurn RetireEval(EditorContext context, string rest)
    {
        if (
            !Guid.TryParse(rest, out var evalId)
            || context.Evals.FirstOrDefault(e => e.Id == evalId) is not { } existing
        )
        {
            return new EditorTurn
            {
                AssistantText = "Retire eval needs an existing eval id: retire eval <id>",
            };
        }

        var remaining = context.Evals.Count(e => e.CriterionId == existing.CriterionId);
        var callout =
            remaining == 1
                ? " This is the last eval behind its criterion; retiring it leaves the criterion uncovered."
                : "";

        return new EditorTurn
        {
            AssistantText = $"Proposed retiring an eval.{callout}",
            ProposalSummary = remaining == 1 ? "Retire last eval for criterion" : "Retire eval",
            Effects =
            [
                new ProposalEffect
                {
                    Kind = ProposalEffectKinds.RetireEval,
                    Description =
                        remaining == 1
                            ? "Retire last eval — criterion will be uncovered"
                            : "Retire eval",
                    EvalId = evalId,
                    CriterionId = existing.CriterionId,
                    Scenario = existing.Scenario,
                },
            ],
        };
    }

    static EditorTurn Bundle(EditorContext context, string rest)
    {
        var ask = rest;
        var criterionId = Guid.NewGuid();
        var evalId = Guid.NewGuid();
        const string scenario = "Given the ask, the work succeeds";
        return new EditorTurn
        {
            AssistantText = "Proposed a multi-layer bundle: ask, criterion, eval, and skill.",
            ProposalSummary = "Bundle ask, criterion, eval, and skill",
            Effects =
            [
                new ProposalEffect
                {
                    Kind = ProposalEffectKinds.AmendAsk,
                    Description = "Amend ask",
                    Ask = ask,
                },
                new ProposalEffect
                {
                    Kind = ProposalEffectKinds.AddCriterion,
                    Description = "Add first criterion",
                    CriterionId = criterionId,
                    Statement = "Capability does what the ask requires",
                },
                new ProposalEffect
                {
                    Kind = ProposalEffectKinds.AddEval,
                    Description = "Add proving eval",
                    EvalId = evalId,
                    CriterionId = criterionId,
                    Scenario = scenario,
                    Prompt = scenario,
                    Context = "",
                    Checks =
                    [
                        new CheckSnapshot
                        {
                            Id = Guid.NewGuid(),
                            Statement = $"The work satisfies: {scenario}",
                        },
                    ],
                },
                new ProposalEffect
                {
                    Kind = ProposalEffectKinds.ReplaceSkill,
                    Description = "Seed skill draft",
                    Markdown = $"# Skill\n\nServes criterion {criterionId:N}\n\n{ask}",
                    ServedCriterionIds = [criterionId],
                },
            ],
        };
    }

    static IReadOnlyList<ProposalEffect>? RebuildEffects(
        EditorContext context,
        IReadOnlyList<ProposalEffect> effects
    )
    {
        var criteria = context.Criteria.Select(c => c.Id).ToHashSet();
        var evals = context.Evals.Select(e => e.Id).ToHashSet();
        var rebuilt = new List<ProposalEffect>();
        foreach (var effect in effects)
        {
            switch (effect.Kind)
            {
                case ProposalEffectKinds.AmendAsk:
                    if (
                        string.IsNullOrWhiteSpace(effect.Ask)
                        || string.Equals(effect.Ask.Trim(), context.Ask, StringComparison.Ordinal)
                    )
                    {
                        return null;
                    }

                    rebuilt.Add(effect);
                    break;
                case ProposalEffectKinds.ReplaceSkill:
                case ProposalEffectKinds.AddCriterion:
                    rebuilt.Add(effect);
                    if (
                        effect.Kind == ProposalEffectKinds.AddCriterion
                        && effect.CriterionId is { } addedCriterionId
                    )
                    {
                        criteria.Add(addedCriterionId);
                    }

                    break;
                case ProposalEffectKinds.AmendEval:
                    if (
                        effect.EvalId is not { } amendEvalId
                        || !evals.Contains(amendEvalId)
                        || string.IsNullOrWhiteSpace(effect.Scenario)
                    )
                    {
                        return null;
                    }

                    rebuilt.Add(effect);
                    break;
                case ProposalEffectKinds.DuplicateEval:
                    if (
                        effect.SourceEvalId is not { } sourceEvalId
                        || !evals.Contains(sourceEvalId)
                        || effect.EvalId is not { } duplicateEvalId
                        || evals.Contains(duplicateEvalId)
                    )
                    {
                        return null;
                    }

                    rebuilt.Add(effect);
                    evals.Add(duplicateEvalId);
                    break;
                case ProposalEffectKinds.RetireEval:
                    if (effect.EvalId is not { } retireEvalId || !evals.Contains(retireEvalId))
                    {
                        return null;
                    }

                    rebuilt.Add(effect);
                    evals.Remove(retireEvalId);
                    break;
                case ProposalEffectKinds.AddEval:
                    if (
                        effect.CriterionId is { } evalCriterionId
                        && (
                            criteria.Contains(evalCriterionId)
                            || effects.Any(e =>
                                e.Kind == ProposalEffectKinds.AddCriterion
                                && e.CriterionId == evalCriterionId
                            )
                        )
                    )
                    {
                        rebuilt.Add(effect);
                        if (effect.EvalId is { } addedEvalId)
                        {
                            evals.Add(addedEvalId);
                        }

                        break;
                    }

                    return null;
                case ProposalEffectKinds.SharpenCriterion:
                case ProposalEffectKinds.SplitCriterion:
                case ProposalEffectKinds.RetireCriterion:
                    if (
                        effect.CriterionId is { } criterionId
                        && criteria.Contains(criterionId)
                    )
                    {
                        rebuilt.Add(effect);
                        if (effect.Kind == ProposalEffectKinds.RetireCriterion)
                        {
                            criteria.Remove(criterionId);
                        }

                        if (effect.Kind == ProposalEffectKinds.SplitCriterion)
                        {
                            criteria.Remove(criterionId);
                            foreach (var created in effect.NewCriteria ?? [])
                            {
                                criteria.Add(created.Id);
                            }
                        }

                        break;
                    }

                    return null;
                default:
                    return null;
            }
        }

        return rebuilt.Count == 0 ? null : rebuilt;
    }
}

public static class ProposalEffectKinds
{
    public const string AmendAsk = "AmendAsk";
    public const string AddCriterion = "AddCriterion";
    public const string SharpenCriterion = "SharpenCriterion";
    public const string SplitCriterion = "SplitCriterion";
    public const string RetireCriterion = "RetireCriterion";
    public const string AddEval = "AddEval";
    public const string AmendEval = "AmendEval";
    public const string DuplicateEval = "DuplicateEval";
    public const string RetireEval = "RetireEval";
    public const string ReplaceSkill = "ReplaceSkill";
}
