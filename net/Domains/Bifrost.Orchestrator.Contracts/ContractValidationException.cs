namespace Bifrost.Orchestrator.Contracts;

public sealed class ContractValidationException(string detail) : Exception(detail);
