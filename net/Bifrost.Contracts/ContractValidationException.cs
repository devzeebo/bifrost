namespace Bifrost.Contracts;

/// <summary>Thrown by contract value objects when input is invalid.</summary>
public sealed class ContractValidationException(string detail) : Exception(detail);
