namespace Bifrost.Domain;

public sealed class CommandValidationException(string detail) : Exception(detail);
