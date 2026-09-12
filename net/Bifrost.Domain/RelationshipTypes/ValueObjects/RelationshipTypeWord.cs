namespace Bifrost.Domain.RelationshipTypes;

public readonly record struct RelationshipTypeWord
{
    public string Value { get; }

    public RelationshipTypeWord(string value)
    {
        if (string.IsNullOrWhiteSpace(value))
        {
            throw new CommandValidationException("ForwardWord and InverseWord are required.");
        }

        Value = (value ?? string.Empty).Trim().ToLowerInvariant();
    }

    public bool IsEmpty => Value.Length == 0;

    public static implicit operator string(RelationshipTypeWord word) => word.Value;

    public static implicit operator RelationshipTypeWord(string value) => new(value);

    public override string ToString() => Value;
}
