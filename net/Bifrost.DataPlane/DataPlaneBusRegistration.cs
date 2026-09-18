using Bifrost.Contracts;
using Bifrost.MessageBus;
using Bifrost.Rpc;
using Microsoft.Extensions.DependencyInjection;
using Wolverine;

namespace Bifrost;

/// <summary>
/// Registers plane handlers that deserialize <see cref="BusMessage"/> payloads into Api contracts
/// and invoke them through Wolverine.
/// </summary>
public static class DataPlaneBusRegistration
{
    public static void AddHandlers(IServiceCollection services)
    {
        // Commands — empty reply
        Command<CreateWorkItemApi.Command>(services);
        Command<ReplaceWorkItemDataApi.Command>(services);
        Command<ChangeWorkItemStatusApi.Command>(services);
        Command<DeleteWorkItemApi.Command>(services);
        Command<AddRelationshipApi.Command>(services);
        Command<RemoveRelationshipApi.Command>(services);
        Command<DefineRelationshipTypeApi.Command>(services);
        Command<ChangeRelationshipTypeWordsApi.Command>(services);
        Command<RetireRelationshipTypeApi.Command>(services);

        // Queries
        Query<ListWorkItemsApi.Query, ListWorkItemsApi.Response>(services);
        Query<GetWorkItemApi.Query, GetWorkItemApi.Response>(services);
        Query<ListRelationshipTypesApi.Query, ListRelationshipTypesApi.Response>(services);
        Query<GetRelationshipTypeApi.Query, GetRelationshipTypeApi.Response>(services);
        Query<ListCommandsApi.Query, ListCommandsApi.Response>(services);
    }

    static void Command<TCommand>(IServiceCollection services)
        where TCommand : class
    {
        services.AddMessageBusHandler<TCommand>(
            async (sp, command, ct) =>
            {
                await using var scope = sp.CreateAsyncScope();
                try
                {
                    await scope
                        .ServiceProvider.GetRequiredService<IMessageBus>()
                        .InvokeAsync(command, ct);
                }
                catch (CommandValidationException ex)
                {
                    throw new BusException(
                        new BusError { Code = BusErrorCodes.Validation, Message = ex.Message }
                    );
                }
                catch (ContractValidationException ex)
                {
                    throw new BusException(
                        new BusError { Code = BusErrorCodes.Validation, Message = ex.Message }
                    );
                }
            }
        );
    }

    static void Query<TQuery, TResponse>(IServiceCollection services)
        where TQuery : class
    {
        services.AddMessageBusHandler<TQuery, TResponse>(
            async (sp, query, ct) =>
            {
                await using var scope = sp.CreateAsyncScope();
                try
                {
                    return await scope
                        .ServiceProvider.GetRequiredService<IMessageBus>()
                        .InvokeAsync<TResponse>(query, ct);
                }
                catch (CommandValidationException ex)
                {
                    throw new BusException(
                        new BusError { Code = BusErrorCodes.Validation, Message = ex.Message }
                    );
                }
                catch (ContractValidationException ex)
                {
                    throw new BusException(
                        new BusError { Code = BusErrorCodes.Validation, Message = ex.Message }
                    );
                }
            }
        );
    }
}
