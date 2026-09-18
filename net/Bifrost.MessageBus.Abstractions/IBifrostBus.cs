namespace Bifrost.MessageBus;

/// <summary>App-facing message bus used by control and data planes.</summary>
public interface IBifrostBus
{
    Task<TResponse> Request<TRequest, TResponse>(
        TRequest request,
        CancellationToken cancellationToken = default
    );

    Task Publish<TEvent>(TEvent @event, CancellationToken cancellationToken = default);
}
