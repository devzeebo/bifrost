namespace Bifrost;

public sealed class CommandValidationException(string detail) : Exception(detail);
