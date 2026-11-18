using Bifrost.MessageBus;
using Bifrost.Orchestrator.Contracts;
using Microsoft.Extensions.DependencyInjection;
using Wolverine;

namespace Bifrost.TrackedWorkItems;

public static class TrackedWorkItemBusExtensions
{
    extension(IServiceCollection services)
    {
        /// <summary>
        /// Exposes holder/status/run reads and lifecycle commands on the bus so workers and
        /// other domains (e.g. Workflows) can re-check and transition items.
        /// </summary>
        public IServiceCollection AddTrackedWorkItemBusQueries()
        {
            ArgumentNullException.ThrowIfNull(services);

            services.Query<GetTrackedWorkItemApi.Query, GetTrackedWorkItemApi.Response>();
            services.Query<
                ListTrackedWorkItemsHeldByWorkerApi.Query,
                ListTrackedWorkItemsHeldByWorkerApi.Response
            >();
            services.Query<GetRunApi.Query, GetRunApi.Response>();
            services.Command<StartTrackedWorkItemApi.Command>();
            services.Command<CreateTrackedWorkItemApi.Command>();
            services.Command<BeginExecutingTrackedWorkItemApi.Command>();
            services.Command<SucceedExecutingTrackedWorkItemApi.Command>();
            services.Command<FailExecutingTrackedWorkItemApi.Command>();
            services.Command<CancelTrackedWorkItemApi.Command>();
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
                            new BusError
                            {
                                Code = BusErrorCodes.Validation,
                                Message = ex.Message,
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
                            new BusError
                            {
                                Code = BusErrorCodes.Validation,
                                Message = ex.Message,
                            }
                        );
                    }
                }
            );
        }
    }
}
