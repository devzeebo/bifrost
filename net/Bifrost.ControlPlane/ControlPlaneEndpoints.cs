using Bifrost.Contracts;
using Bifrost.MessageBus;
using Bifrost.Rpc;
using Microsoft.AspNetCore.Mvc;

namespace Bifrost.ControlPlane;

public static class ControlPlaneEndpoints
{
    public static void Map(WebApplication app)
    {
        app.MapPost(
            "/create-work-item",
            async (
                CreateWorkItemApi.Command command,
                IBifrostBus bifrostBus,
                CancellationToken ct
            ) =>
            {
                await bifrostBus.Request<CreateWorkItemApi.Command, Unit>(command, ct);
                return Results.NoContent();
            }
        );

        app.MapPost(
            "/replace-work-item-data",
            async (
                ReplaceWorkItemDataApi.Command command,
                IBifrostBus bifrostBus,
                CancellationToken ct
            ) =>
            {
                await bifrostBus.Request<ReplaceWorkItemDataApi.Command, Unit>(command, ct);
                return Results.NoContent();
            }
        );

        app.MapPost(
            "/change-work-item-status",
            async (
                ChangeWorkItemStatusApi.Command command,
                IBifrostBus bifrostBus,
                CancellationToken ct
            ) =>
            {
                await bifrostBus.Request<ChangeWorkItemStatusApi.Command, Unit>(command, ct);
                return Results.NoContent();
            }
        );

        app.MapPost(
            "/delete-work-item",
            async (
                DeleteWorkItemApi.Command command,
                IBifrostBus bifrostBus,
                CancellationToken ct
            ) =>
            {
                await bifrostBus.Request<DeleteWorkItemApi.Command, Unit>(command, ct);
                return Results.NoContent();
            }
        );

        app.MapPost(
            "/add-relationship",
            async (
                AddRelationshipApi.Command command,
                IBifrostBus bifrostBus,
                CancellationToken ct
            ) =>
            {
                await bifrostBus.Request<AddRelationshipApi.Command, Unit>(command, ct);
                return Results.NoContent();
            }
        );

        app.MapPost(
            "/remove-relationship",
            async (
                RemoveRelationshipApi.Command command,
                IBifrostBus bifrostBus,
                CancellationToken ct
            ) =>
            {
                await bifrostBus.Request<RemoveRelationshipApi.Command, Unit>(command, ct);
                return Results.NoContent();
            }
        );

        app.MapPost(
            "/define-relationship-type",
            async (
                DefineRelationshipTypeApi.Command command,
                IBifrostBus bifrostBus,
                CancellationToken ct
            ) =>
            {
                await bifrostBus.Request<DefineRelationshipTypeApi.Command, Unit>(command, ct);
                return Results.NoContent();
            }
        );

        app.MapPost(
            "/change-relationship-type-words",
            async (
                ChangeRelationshipTypeWordsApi.Command command,
                IBifrostBus bifrostBus,
                CancellationToken ct
            ) =>
            {
                await bifrostBus.Request<ChangeRelationshipTypeWordsApi.Command, Unit>(command, ct);
                return Results.NoContent();
            }
        );

        app.MapPost(
            "/retire-relationship-type",
            async (
                RetireRelationshipTypeApi.Command command,
                IBifrostBus bifrostBus,
                CancellationToken ct
            ) =>
            {
                await bifrostBus.Request<RetireRelationshipTypeApi.Command, Unit>(command, ct);
                return Results.NoContent();
            }
        );

        app.MapMethods(
            "/list-work-items",
            ["QUERY"],
            async (
                [FromBody] ListWorkItemsApi.Query? query,
                IBifrostBus bifrostBus,
                CancellationToken ct
            ) =>
            {
                query ??= new ListWorkItemsApi.Query();
                var response = await bifrostBus.Request<
                    ListWorkItemsApi.Query,
                    ListWorkItemsApi.Response
                >(query, ct);
                return Results.Ok(response.Items);
            }
        );

        app.MapMethods(
            "/get-work-item/{id:guid}",
            ["QUERY"],
            async (Guid id, IBifrostBus bifrostBus, CancellationToken ct) =>
                Results.Ok(
                    await bifrostBus.Request<GetWorkItemApi.Query, GetWorkItemApi.Response>(
                        new GetWorkItemApi.Query { Id = id },
                        ct
                    )
                )
        );

        app.MapMethods(
            "/list-relationship-types",
            ["QUERY"],
            async (IBifrostBus bifrostBus, CancellationToken ct) =>
            {
                var response = await bifrostBus.Request<
                    ListRelationshipTypesApi.Query,
                    ListRelationshipTypesApi.Response
                >(new ListRelationshipTypesApi.Query(), ct);
                return Results.Ok(response.Items);
            }
        );

        app.MapMethods(
            "/get-relationship-type/{id:guid}",
            ["QUERY"],
            async (Guid id, IBifrostBus bifrostBus, CancellationToken ct) =>
                Results.Ok(
                    await bifrostBus.Request<
                        GetRelationshipTypeApi.Query,
                        GetRelationshipTypeApi.Response
                    >(new GetRelationshipTypeApi.Query { Id = id }, ct)
                )
        );

        app.MapMethods(
            "/commands",
            ["QUERY"],
            async (IBifrostBus bifrostBus, CancellationToken ct) =>
                Results.Ok(
                    await bifrostBus.Request<ListCommandsApi.Query, ListCommandsApi.Response>(
                        new ListCommandsApi.Query(),
                        ct
                    )
                )
        );
    }
}
