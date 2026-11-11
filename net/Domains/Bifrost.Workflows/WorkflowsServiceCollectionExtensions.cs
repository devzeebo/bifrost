using Bifrost.MessageBus;
using Bifrost.Rpc;
using Bifrost.Workflows.Contracts;
using Microsoft.Extensions.DependencyInjection;
using Wolverine;

namespace Bifrost;

public static class WorkflowsServiceCollectionExtensions
{
    extension(IServiceCollection services)
    {
        /// <summary>
        /// Registers workflow handlers that deserialize <see cref="BusMessage"/> payloads into Api contracts
        /// and invoke them through Wolverine.
        /// </summary>
        public IServiceCollection AddWorkflowHandlers()
        {
            ArgumentNullException.ThrowIfNull(services);

            services.Command<CreateWorkflowApi.Command>();
            services.Command<SaveWorkflowApi.Command>();

            services.Query<GetWorkflowApi.Query, GetWorkflowApi.Response>();
            services.Query<ListWorkflowsApi.Query, ListWorkflowsApi.Response>();
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
                    catch (NotFoundException ex)
                    {
                        throw new BusException(
                            new BusError { Code = BusErrorCodes.NotFound, Message = ex.Message }
                        );
                    }
                    catch (ConcurrencyConflictException ex)
                    {
                        throw new BusException(
                            new BusError { Code = BusErrorCodes.Conflict, Message = ex.Message }
                        );
                    }
                    catch (JasperFx.Events.EventStreamUnexpectedMaxEventIdException)
                    {
                        throw new BusException(
                            new BusError
                            {
                                Code = BusErrorCodes.Conflict,
                                Message = "Workflow changed since it was opened.",
                            }
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
                    catch (NotFoundException ex)
                    {
                        throw new BusException(
                            new BusError { Code = BusErrorCodes.NotFound, Message = ex.Message }
                        );
                    }
                    catch (ConcurrencyConflictException ex)
                    {
                        throw new BusException(
                            new BusError { Code = BusErrorCodes.Conflict, Message = ex.Message }
                        );
                    }
                }
            );
        }
    }
}
