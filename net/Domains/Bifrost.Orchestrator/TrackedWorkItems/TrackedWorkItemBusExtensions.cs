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
        /// Exposes holder/status reads on the bus so workers can re-check at handoff accept.
        /// </summary>
        public IServiceCollection AddTrackedWorkItemBusQueries()
        {
            ArgumentNullException.ThrowIfNull(services);

            services.AddMessageBusHandler<
                GetTrackedWorkItemApi.Query,
                GetTrackedWorkItemApi.Response
            >(
                async (sp, query, ct) =>
                {
                    await using var scope = sp.CreateAsyncScope();
                    try
                    {
                        return await scope
                            .ServiceProvider.GetRequiredService<IMessageBus>()
                            .InvokeAsync<GetTrackedWorkItemApi.Response>(query, ct);
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
            return services;
        }
    }
}
