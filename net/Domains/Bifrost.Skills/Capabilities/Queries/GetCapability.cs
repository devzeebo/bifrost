using Bifrost.Capabilities.Projections;
using Marten;

namespace Bifrost.Capabilities.Queries;

public static class GetCapabilityHandler
{
    [WolverineQuery("/get-capability/{id}")]
    public static Task<GetCapabilityApi.Response> Get(Guid id, IQuerySession session) =>
        Handle(new GetCapabilityApi.Query { Id = id }, session);

    public static async Task<GetCapabilityApi.Response> Handle(
        GetCapabilityApi.Query query,
        IQuerySession session
    )
    {
        var item =
            await session.LoadAsync<CapabilityView.Model>(query.Id)
            ?? throw new CommandValidationException($"Capability {query.Id} not found.");

        var index = await session.LoadAsync<CapabilityIndex.Model>(query.Id);
        var (isSkillStale, staleLayers) = await SkillStaleness.Read(item, session);

        return new GetCapabilityApi.Response
        {
            Id = item.Id,
            Name = item.Name,
            Ask = item.Ask,
            Criteria =
            [
                .. item.Criteria.Select(c => new GetCapabilityApi.CriterionSummary
                {
                    Id = c.Id,
                    Statement = c.Statement,
                }),
            ],
            Evals =
            [
                .. item.Evals.Select(e => new GetCapabilityApi.EvalSummary
                {
                    Id = e.Id,
                    CriterionId = e.CriterionId,
                    Scenario = e.Scenario,
                    Prompt = e.Prompt,
                    Context = e.Context,
                    Checks =
                    [
                        .. e.Checks.Select(c => new GetCapabilityApi.CheckSummary
                        {
                            Id = c.Id,
                            Statement = c.Statement,
                            Kind = c.Kind,
                            Script = c.Script,
                        }),
                    ],
                }),
            ],
            HasPublishedSkill = index?.HasPublishedSkill ?? false,
            SkillMarkdown = item.SkillMarkdown,
            CurrentCapabilityVersionId = item.CurrentCapabilityVersionId,
            CurrentSkillVersionId = item.CurrentSkillVersionId,
            DerivedAgainstCapabilityVersionId = item.DerivedAgainstCapabilityVersionId,
            HasUnsavedCapabilityDraft = item.HasUnsavedCapabilityDraft,
            HasUnsavedSkillDraft = item.HasUnsavedSkillDraft,
            IsSkillStale = isSkillStale,
            SkillStaleLayers = new GetCapabilityApi.SkillStaleLayersSummary
            {
                AskChanged = staleLayers.AskChanged,
                CriteriaChanged = staleLayers.CriteriaChanged,
                EvalsChanged = staleLayers.EvalsChanged,
            },
        };
    }
}
