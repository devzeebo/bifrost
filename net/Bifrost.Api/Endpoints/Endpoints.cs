using Bifrost.Domain.RelationshipTypes.Commands;
using Bifrost.Domain.RelationshipTypes.Projections;
using Bifrost.Domain.WorkItems.Commands;
using Bifrost.Domain.WorkItems.Projections;
using Marten;
using Wolverine;
using Wolverine.Http;

namespace Bifrost.Api.Endpoints;

public sealed record ListRelationshipTypesQuery;

public sealed record GetRelationshipTypeQuery
{
    public required Guid Id { get; init; }
}

public sealed record ListWorkItemsQuery;

public sealed record GetWorkItemQuery
{
    public required Guid Id { get; init; }
}

public static class CommandEndpoints
{
    [WolverinePost("/define-relationship-type"), EmptyResponse]
    public static async Task Define(DefineRelationshipTypeHandler.Command command, IMessageBus bus)
    {
        await bus.InvokeAsync(command);
    }

    [WolverinePost("/change-relationship-type-words"), EmptyResponse]
    public static Task ChangeWords(
        ChangeRelationshipTypeWordsHandler.Command command,
        IMessageBus bus
    ) => bus.InvokeAsync(command);

    [WolverinePost("/retire-relationship-type"), EmptyResponse]
    public static Task Retire(RetireRelationshipTypeHandler.Command command, IMessageBus bus) =>
        bus.InvokeAsync(command);

    [WolverinePost("/create-work-item"), EmptyResponse]
    public static Task Create(CreateWorkItemHandler.Command command, IMessageBus bus) =>
        bus.InvokeAsync(command);

    [WolverinePost("/replace-work-item-data"), EmptyResponse]
    public static Task ReplaceData(ReplaceWorkItemDataHandler.Command command, IMessageBus bus) =>
        bus.InvokeAsync(command);

    [WolverinePost("/add-relationship"), EmptyResponse]
    public static Task AddRelationship(AddRelationshipHandler.Command command, IMessageBus bus) =>
        bus.InvokeAsync(command);

    [WolverinePost("/remove-relationship"), EmptyResponse]
    public static Task RemoveRelationship(
        RemoveRelationshipHandler.Command command,
        IMessageBus bus
    ) => bus.InvokeAsync(command);

    [WolverinePost("/delete-work-item"), EmptyResponse]
    public static Task Delete(DeleteWorkItemHandler.Command command, IMessageBus bus) =>
        bus.InvokeAsync(command);
}

public static class QueryEndpoints
{
    [WolverineQuery("/list-relationship-types")]
    public static async Task<IReadOnlyList<RelationshipTypeView.Model>> ListRelationshipTypes(
        ListRelationshipTypesQuery _,
        IQuerySession session
    ) => await session.Query<RelationshipTypeView.Model>().ToListAsync();

    [WolverineQuery("/get-relationship-type")]
    public static async Task<RelationshipTypeView.Model?> GetRelationshipType(
        GetRelationshipTypeQuery query,
        IQuerySession session
    ) => await session.LoadAsync<RelationshipTypeView.Model>(query.Id);

    [WolverineQuery("/list-work-items")]
    public static async Task<IReadOnlyList<WorkItemIndex.Model>> ListWorkItems(
        ListWorkItemsQuery _,
        IQuerySession session
    ) => await session.Query<WorkItemIndex.Model>().Where(x => !x.IsDeleted).ToListAsync();

    [WolverineQuery("/get-work-item")]
    public static async Task<WorkItemView.Model?> GetWorkItem(
        GetWorkItemQuery query,
        IQuerySession session
    ) => await session.LoadAsync<WorkItemView.Model>(query.Id);

    [WolverineQuery("/commands")]
    public static object ListCommands(Dictionary<string, object?> _) =>
        new
        {
            commands = new[]
            {
                "POST /define-relationship-type",
                "POST /change-relationship-type-words",
                "POST /retire-relationship-type",
                "POST /create-work-item",
                "POST /replace-work-item-data",
                "POST /add-relationship",
                "POST /remove-relationship",
                "POST /delete-work-item",
            },
            queries = new[]
            {
                "QUERY /list-relationship-types",
                "QUERY /get-relationship-type",
                "QUERY /list-work-items",
                "QUERY /get-work-item",
                "QUERY /commands",
            },
        };
}
