using System.Text.Json.Nodes;

namespace Bifrost.Contracts;

public static class CreateWorkItemApi
{
    public sealed record Command
    {
        public required Guid Id { get; init; }
        public required JsonNode Data { get; init; }
        public required WorkItemStatus Status { get; init; }
    }
}

public static class ReplaceWorkItemDataApi
{
    public sealed record Command
    {
        public required Guid Id { get; init; }
        public required JsonNode Data { get; init; }
    }
}

public static class ChangeWorkItemStatusApi
{
    public sealed record Command
    {
        public required Guid Id { get; init; }
        public required WorkItemStatus Status { get; init; }
    }
}

public static class DeleteWorkItemApi
{
    public sealed record Command
    {
        public required Guid Id { get; init; }
    }
}

public static class AddRelationshipApi
{
    public sealed record Command
    {
        public required Guid WorkItemId { get; init; }
        public required string Word { get; init; }
        public required Guid RelatedWorkItemId { get; init; }
    }
}

public static class RemoveRelationshipApi
{
    public sealed record Command
    {
        public required Guid WorkItemId { get; init; }
        public required string Word { get; init; }
        public required Guid RelatedWorkItemId { get; init; }
    }
}

public static class ListWorkItemsApi
{
    public sealed record Query
    {
        public string? Status { get; init; }
    }

    public sealed record Response
    {
        public required IReadOnlyList<Item> Items { get; init; }

        public sealed record Item
        {
            public required Guid Id { get; init; }
            public required string Status { get; init; }
            public bool IsDeleted { get; init; }
        }
    }
}

public static class GetWorkItemApi
{
    public sealed record Query
    {
        public required Guid Id { get; init; }
    }

    public sealed record Response
    {
        public required Guid Id { get; init; }
        public required JsonNode Data { get; init; }
        public required string Status { get; init; }
        public required IReadOnlyList<Relationship> Relationships { get; init; }
        public bool IsDeleted { get; init; }

        public sealed record Relationship
        {
            public required Guid RelationshipTypeId { get; init; }
            public required string Word { get; init; }
            public required RelationshipDirection Direction { get; init; }
            public required Guid RelatedWorkItemId { get; init; }
        }
    }
}

public static class DefineRelationshipTypeApi
{
    public sealed record Command
    {
        public required Guid Id { get; init; }
        public required RelationshipTypeWord ForwardWord { get; init; }
        public required RelationshipTypeWord InverseWord { get; init; }
    }
}

public static class ChangeRelationshipTypeWordsApi
{
    public sealed record Command
    {
        public required Guid Id { get; init; }
        public required RelationshipTypeWord ForwardWord { get; init; }
        public required RelationshipTypeWord InverseWord { get; init; }
    }
}

public static class RetireRelationshipTypeApi
{
    public sealed record Command
    {
        public required Guid Id { get; init; }
    }
}

public static class ListRelationshipTypesApi
{
    public sealed record Query;

    public sealed record Response
    {
        public required IReadOnlyList<Item> Items { get; init; }

        public sealed record Item
        {
            public required Guid Id { get; init; }
            public required string ForwardWord { get; init; }
            public required string InverseWord { get; init; }
            public bool IsActive { get; init; }
        }
    }
}

public static class GetRelationshipTypeApi
{
    public sealed record Query
    {
        public required Guid Id { get; init; }
    }

    public sealed record Response
    {
        public required Guid Id { get; init; }
        public required string ForwardWord { get; init; }
        public required string InverseWord { get; init; }
        public bool IsActive { get; init; }
    }
}

public static class ListCommandsApi
{
    public sealed record Query;

    public sealed record Response
    {
        public required IReadOnlyList<string> Commands { get; init; }
        public required IReadOnlyList<string> Queries { get; init; }
    }
}
