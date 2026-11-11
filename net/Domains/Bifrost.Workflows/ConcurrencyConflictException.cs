namespace Bifrost;

public sealed class ConcurrencyConflictException(string message) : Exception(message);
