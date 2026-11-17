using System.Collections.Concurrent;
using System.Text.Json.Nodes;
using Bifrost.MessageBus;
using Bifrost.WorkItems.Contracts;

namespace Bifrost.Tests.Support;

/// <summary>
/// Test stand-in for the work-items ledger used by orchestrator mirror and workflow calls.
/// </summary>
public sealed class InMemoryWorkItemLedger
{
    readonly ConcurrentDictionary<Guid, Entry> _items = new();
    readonly ConcurrentDictionary<Guid, RelationshipType> _relationshipTypes = new();
    readonly ConcurrentDictionary<Guid, byte> _getFailures = new();

    /// <summary>Force <see cref="Get"/> to throw NotFound for the given id (classification failure tests).</summary>
    public void FailNextGet(Guid id) => _getFailures[id] = 0;

    public void ClearGetFailure(Guid id) => _getFailures.TryRemove(id, out _);

    public IReadOnlyCollection<string> AppliedRequestKeysOf(Guid id) =>
        _items.TryGetValue(id, out var entry) ? entry.AppliedRequestKeys : [];

    public void Seed(
        Guid id,
        string status = "pending",
        JsonNode? data = null,
        JsonObject? metadata = null
    ) =>
        _items[id] = new Entry(
            status.Trim().ToLowerInvariant(),
            data?.DeepClone() ?? new JsonObject(),
            metadata?.DeepClone()?.AsObject() ?? [],
            [],
            new HashSet<string>(StringComparer.Ordinal),
            []
        );

    public string? StatusOf(Guid id) => _items.TryGetValue(id, out var entry) ? entry.Status : null;

    public JsonObject? MetadataOf(Guid id) =>
        _items.TryGetValue(id, out var entry) ? entry.Metadata.DeepClone().AsObject() : null;

    public IReadOnlyList<HistoryEntry> HistoryOf(Guid id) =>
        _items.TryGetValue(id, out var entry) ? entry.History : [];

    public GetWorkItemApi.Response Get(Guid id)
    {
        if (_getFailures.TryRemove(id, out _))
        {
            throw new BusException(
                new BusError
                {
                    Code = BusErrorCodes.Internal,
                    Message = $"Simulated get failure for work item {id}.",
                }
            );
        }

        if (!_items.TryGetValue(id, out var entry))
        {
            throw new BusException(
                new BusError { Code = BusErrorCodes.NotFound, Message = $"Work item {id} not found." }
            );
        }

        return new GetWorkItemApi.Response
        {
            Id = id,
            Data = entry.Data.DeepClone()!,
            Status = entry.Status,
            Metadata = entry.Metadata.DeepClone().AsObject(),
            Relationships = entry
                .Relationships.Select(r => new GetWorkItemApi.Response.Relationship
                {
                    RelationshipTypeId = r.RelationshipTypeId,
                    Word = r.Word,
                    Direction = r.Direction,
                    RelatedWorkItemId = r.RelatedWorkItemId,
                })
                .ToList(),
        };
    }

    public void Apply(ChangeWorkItemStatusApi.Command command)
    {
        if (!_items.TryGetValue(command.Id, out var entry))
        {
            throw new BusException(
                new BusError
                {
                    Code = BusErrorCodes.Validation,
                    Message = "Work item no longer matches the expected state.",
                }
            );
        }

        if (command.RequestKey is { Length: > 0 } key && entry.AppliedRequestKeys.Contains(key))
        {
            return;
        }

        if (command.Expected is { Count: > 0 })
        {
            var expectedStatus = command.Expected["status"]?.GetValue<string>();
            if (
                expectedStatus is not null
                && !string.Equals(expectedStatus, entry.Status, StringComparison.Ordinal)
            )
            {
                throw new BusException(
                    new BusError
                    {
                        Code = BusErrorCodes.Validation,
                        Message =
                            $"Work item no longer matches the expected state (expected status '{expectedStatus}', actual '{entry.Status}').",
                    }
                );
            }
        }

        var next = ((string)command.Status).Trim().ToLowerInvariant();
        var history = entry.History.ToList();
        history.Add(new HistoryEntry(next, command.Actor, command.Reason));
        var keys = new HashSet<string>(entry.AppliedRequestKeys, StringComparer.Ordinal);
        if (command.RequestKey is { Length: > 0 } applied)
        {
            keys.Add(applied);
        }

        _items[command.Id] = entry with
        {
            Status = next,
            History = history,
            AppliedRequestKeys = keys,
        };
    }

    public void Create(CreateWorkItemApi.Command command)
    {
        if (!_items.TryAdd(
                command.Id,
                new Entry(
                    ((string)command.Status).Trim().ToLowerInvariant(),
                    command.Data.DeepClone()!,
                    command.Metadata?.DeepClone()?.AsObject() ?? [],
                    [],
                    new HashSet<string>(StringComparer.Ordinal),
                    []
                )
            ))
        {
            throw new BusException(
                new BusError
                {
                    Code = BusErrorCodes.Validation,
                    Message = $"Work item {command.Id} already exists.",
                }
            );
        }
    }

    public void ReplaceMetadata(ReplaceWorkItemMetadataApi.Command command)
    {
        if (!_items.TryGetValue(command.Id, out var entry))
        {
            throw new BusException(
                new BusError
                {
                    Code = BusErrorCodes.NotFound,
                    Message = $"Work item {command.Id} not found.",
                }
            );
        }

        _items[command.Id] = entry with { Metadata = command.Metadata.DeepClone().AsObject() };
    }

    public void DefineRelationshipType(DefineRelationshipTypeApi.Command command)
    {
        var forward = ((string)command.ForwardWord).Trim().ToLowerInvariant();
        var inverse = ((string)command.InverseWord).Trim().ToLowerInvariant();
        if (
            _relationshipTypes.Values.Any(t =>
                t.ForwardWord == forward || t.InverseWord == forward || t.ForwardWord == inverse
            )
        )
        {
            throw new BusException(
                new BusError
                {
                    Code = BusErrorCodes.Validation,
                    Message = "Relationship type words must be unique.",
                }
            );
        }

        if (!_relationshipTypes.TryAdd(
                command.Id,
                new RelationshipType(command.Id, forward, inverse, true)
            ))
        {
            throw new BusException(
                new BusError
                {
                    Code = BusErrorCodes.Validation,
                    Message = $"Relationship type {command.Id} already exists.",
                }
            );
        }
    }

    public ListRelationshipTypesApi.Response ListRelationshipTypes() =>
        new()
        {
            Items =
            [
                .. _relationshipTypes.Values.Select(t => new ListRelationshipTypesApi.Response.Item
                {
                    Id = t.Id,
                    ForwardWord = t.ForwardWord,
                    InverseWord = t.InverseWord,
                    IsActive = t.IsActive,
                }),
            ],
        };

    public void AddRelationship(AddRelationshipApi.Command command)
    {
        if (!_items.TryGetValue(command.WorkItemId, out var source))
        {
            throw new BusException(
                new BusError
                {
                    Code = BusErrorCodes.NotFound,
                    Message = $"Work item {command.WorkItemId} not found.",
                }
            );
        }

        if (!_items.TryGetValue(command.RelatedWorkItemId, out var target))
        {
            throw new BusException(
                new BusError
                {
                    Code = BusErrorCodes.NotFound,
                    Message = $"Work item {command.RelatedWorkItemId} not found.",
                }
            );
        }

        var word = command.Word.Trim().ToLowerInvariant();
        var type =
            _relationshipTypes.Values.FirstOrDefault(t =>
                t.IsActive && (t.ForwardWord == word || t.InverseWord == word)
            )
            ?? throw new BusException(
                new BusError
                {
                    Code = BusErrorCodes.Validation,
                    Message = $"Unknown relationship word '{command.Word}'.",
                }
            );

        var forward = type.ForwardWord == word;
        var inverseWord = forward ? type.InverseWord : type.ForwardWord;
        var sourceRels = source.Relationships.ToList();
        sourceRels.Add(
            new RelationshipEdge(
                type.Id,
                word,
                RelationshipDirection.Forward,
                command.RelatedWorkItemId
            )
        );
        var targetRels = target.Relationships.ToList();
        targetRels.Add(
            new RelationshipEdge(
                type.Id,
                inverseWord,
                RelationshipDirection.Inverse,
                command.WorkItemId
            )
        );
        _items[command.WorkItemId] = source with { Relationships = sourceRels };
        _items[command.RelatedWorkItemId] = target with { Relationships = targetRels };
    }

    public ListWorkItemsApi.Response List(ListWorkItemsApi.Query query)
    {
        var list = _items.Select(pair => (pair.Key, pair.Value)).AsEnumerable();
        if (!string.IsNullOrWhiteSpace(query.Status))
        {
            var status = query.Status.Trim().ToLowerInvariant();
            list = list.Where(x => x.Value.Status == status);
        }

        if (query.Metadata is { Count: > 0 } metadata)
        {
            list = list.Where(x => MatchesPartial(x.Value.Metadata, metadata));
        }

        return new ListWorkItemsApi.Response
        {
            Items =
            [
                .. list.Select(x => new ListWorkItemsApi.Response.Item
                {
                    Id = x.Key,
                    Status = x.Value.Status,
                    IsDeleted = false,
                }),
            ],
        };
    }

    static bool MatchesPartial(JsonObject actual, JsonObject expected)
    {
        foreach (var property in expected)
        {
            if (
                !actual.TryGetPropertyValue(property.Key, out var value)
                || value?.ToJsonString() != property.Value?.ToJsonString()
            )
            {
                return false;
            }
        }

        return true;
    }

    sealed record Entry(
        string Status,
        JsonNode Data,
        JsonObject Metadata,
        List<HistoryEntry> History,
        HashSet<string> AppliedRequestKeys,
        List<RelationshipEdge> Relationships
    );

    sealed record RelationshipEdge(
        Guid RelationshipTypeId,
        string Word,
        RelationshipDirection Direction,
        Guid RelatedWorkItemId
    );

    sealed record RelationshipType(Guid Id, string ForwardWord, string InverseWord, bool IsActive);

    public sealed record HistoryEntry(string Status, string Actor, string Reason);
}
