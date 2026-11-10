namespace Bifrost;

public sealed class NotFoundException(string detail) : Exception(detail);
