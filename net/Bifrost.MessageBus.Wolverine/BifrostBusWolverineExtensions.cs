using Microsoft.Extensions.DependencyInjection;
using Wolverine;

namespace Bifrost.MessageBus;

public static class BifrostBusWolverineExtensions
{
    extension(WolverineOptions opts)
    {
        /// <summary>
        /// Registers the Wolverine transport that sends through <see cref="IBifrostBus"/>
        /// and can listen by turning bus deliveries into Wolverine handler calls.
        /// </summary>
        public BifrostBusConfiguration UseBifrostBus()
        {
            ArgumentNullException.ThrowIfNull(opts);
            opts.Transports.Add(new BifrostBusTransport());
            return new BifrostBusConfiguration(opts);
        }
    }
}

public sealed class BifrostBusConfiguration
{
    readonly WolverineOptions _opts;

    internal BifrostBusConfiguration(WolverineOptions opts) => _opts = opts;

    /// <summary>
    /// Delivers this bus message type into a local <c>Handle</c> method.
    /// Register this before <see cref="MessageBusRouter"/> is built.
    /// </summary>
    public BifrostBusConfiguration ListenFor<T>()
        where T : class
    {
        _opts.Services.AddMessageBusSubscriber<T>(
            async (sp, message, ct) =>
            {
                await using var scope = sp.CreateAsyncScope();
                await scope
                    .ServiceProvider.GetRequiredService<IMessageBus>()
                    .InvokeAsync(message, ct);
            }
        );
        return this;
    }
}
