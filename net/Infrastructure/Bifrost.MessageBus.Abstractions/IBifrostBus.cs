namespace Bifrost.MessageBus;

/// <summary>App-facing message bus used by a bounded-context host.</summary>
public interface IBifrostBus
{
    Task<TResponse> Request<TRequest, TResponse>(
        TRequest request,
        CancellationToken cancellationToken = default
    );

    Task Publish<TEvent>(TEvent @event, CancellationToken cancellationToken = default);
}
