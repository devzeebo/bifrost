using Bifrost.MessageBus;
using Bifrost.Tests.Support;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.DependencyInjection.Extensions;

namespace Bifrost.Tests;

static class TestMessageBusExtensions
{
    /// <summary>
    /// Registers a test-local <see cref="LoopbackBifrostBus"/> as <see cref="IBifrostBus"/>.
    /// Prefer registering handlers via <c>AddMessageBusHandler</c> first so the Abstractions
    /// router factory can wire them; if none are present, installs an empty router.
    /// </summary>
    public static IServiceCollection AddLoopbackBifrostBus(this IServiceCollection services)
    {
        ArgumentNullException.ThrowIfNull(services);

        if (!services.Any(d => d.ServiceType == typeof(MessageBusRouter)))
        {
            services.AddSingleton(new MessageBusRouter());
        }

        services.TryAddSingleton<IBifrostBus, LoopbackBifrostBus>();
        return services;
    }
}
