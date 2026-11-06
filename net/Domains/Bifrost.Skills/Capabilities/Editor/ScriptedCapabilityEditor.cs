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

        if (text.StartsWith("retire ", StringComparison.OrdinalIgnoreCase))
        {
            return Retire(context, text["retire ".Length..].Trim());
        }

        if (text.StartsWith("add eval ", StringComparison.OrdinalIgnoreCase))
        {
            return AddEval(context, text["add eval ".Length..].Trim());
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
                "I can help edit this capability. Try: add criterion: …, sharpen <criterion-id>:<statement>, split <criterion-id>, retire <criterion-id>, add eval <criterion-id>:<scenario>, reword ask: …, replace skill: …, or bundle: …",
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
        return new EditorTurn
        {
            AssistantText = "Proposed splitting a criterion into two.",
            ProposalSummary = "Split criterion",
            Effects =
            [
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
                },
            ],
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

        return new EditorTurn
        {
            AssistantText = "Proposed retiring a criterion.",
            ProposalSummary = "Retire criterion",
            Effects =
            [
                new ProposalEffect
                {
                    Kind = ProposalEffectKinds.RetireCriterion,
                    Description = $"Retire criterion {criterionId}",
                    CriterionId = criterionId,
                },
            ],
        };
    }

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
                    Scenario = parts[1],
                },
            ],
        };
    }

    static EditorTurn Bundle(EditorContext context, string rest)
    {
        var ask = rest;
        var criterionId = Guid.NewGuid();
        var evalId = Guid.NewGuid();
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
                    Scenario = "Given the ask, the work succeeds",
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
        var rebuilt = new List<ProposalEffect>();
        foreach (var effect in effects)
        {
            switch (effect.Kind)
            {
                case ProposalEffectKinds.AmendAsk:
                case ProposalEffectKinds.ReplaceSkill:
                case ProposalEffectKinds.AddCriterion:
                case ProposalEffectKinds.AmendEval:
                case ProposalEffectKinds.RetireEval:
                    rebuilt.Add(effect);
                    break;
                case ProposalEffectKinds.AddEval:
                    if (
                        effect.CriterionId is { } evalCriterionId
                        && (
                            context.Criteria.Any(c => c.Id == evalCriterionId)
                            || effects.Any(e =>
                                e.Kind == ProposalEffectKinds.AddCriterion
                                && e.CriterionId == evalCriterionId
                            )
                        )
                    )
                    {
                        rebuilt.Add(effect);
                        break;
                    }

                    return null;
                case ProposalEffectKinds.SharpenCriterion:
                case ProposalEffectKinds.SplitCriterion:
                case ProposalEffectKinds.RetireCriterion:
                    if (
                        effect.CriterionId is { } criterionId
                        && context.Criteria.Any(c => c.Id == criterionId)
                    )
                    {
                        rebuilt.Add(effect);
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
    public const string RetireEval = "RetireEval";
    public const string ReplaceSkill = "ReplaceSkill";
}
