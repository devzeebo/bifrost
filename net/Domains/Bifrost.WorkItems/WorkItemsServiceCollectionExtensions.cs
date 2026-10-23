using Bifrost.WorkItems.Contracts;
using Bifrost.MessageBus;
using Bifrost.Rpc;
using Microsoft.Extensions.DependencyInjection;
using Wolverine;

namespace Bifrost;

public static class WorkItemsServiceCollectionExtensions
{
    extension(IServiceCollection services)
    {
        /// <summary>
        /// Registers work-item handlers that deserialize <see cref="BusMessage"/> payloads into Api contracts
        /// and invoke them through Wolverine.
        /// </summary>
        public IServiceCollection AddWorkItemHandlers()
        {
            ArgumentNullException.ThrowIfNull(services);

            // Commands — empty reply
            services.Command<CreateWorkItemApi.Command>();
            services.Command<ReplaceWorkItemDataApi.Command>();
            services.Command<ChangeWorkItemStatusApi.Command>();
            services.Command<DeleteWorkItemApi.Command>();
            services.Command<AddRelationshipApi.Command>();
            services.Command<RemoveRelationshipApi.Command>();
            services.Command<DefineRelationshipTypeApi.Command>();
            services.Command<ChangeRelationshipTypeWordsApi.Command>();
            services.Command<RetireRelationshipTypeApi.Command>();

            // Queries
            services.Query<ListWorkItemsApi.Query, IReadOnlyList<ListWorkItemsApi.Response.Item>>();
            services.Query<GetWorkItemApi.Query, GetWorkItemApi.Response>();
            services.Query<
                ListRelationshipTypesApi.Query,
                IReadOnlyList<ListRelationshipTypesApi.Response.Item>
            >();
            services.Query<GetRelationshipTypeApi.Query, GetRelationshipTypeApi.Response>();
            services.Query<ListCommandsApi.Query, ListCommandsApi.Response>();
            return services;
        }

        void Command<TCommand>()
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

        void Query<TQuery, TResponse>()
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
}
