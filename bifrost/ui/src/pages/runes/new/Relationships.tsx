"use client";

import { Button } from "@base-ui/react/button";
import { Combobox } from "@base-ui/react/combobox";
import { ScrollArea } from "@base-ui/react/scroll-area";
import type { RuneListItem, SelectedRelationship, RelationshipDirection } from "../+Page";

type RelationshipsProps = {
  existingRunes: RuneListItem[];
  selectedRelationships: SelectedRelationship[];
  relationshipDirection: RelationshipDirection;
  relationshipFilter: string;
  relationshipTargetId: string;
  onRelationshipDirectionChange: (direction: RelationshipDirection) => void;
  onRelationshipFilterChange: (filter: string) => void;
  onRelationshipTargetIdChange: (id: string) => void;
  onAddRelationship: () => void;
  onRemoveRelationship: (targetId: string) => void;
};

export const Relationships = ({
  existingRunes,
  selectedRelationships,
  relationshipDirection,
  relationshipFilter,
  relationshipTargetId,
  onRelationshipDirectionChange,
  onRelationshipFilterChange,
  onRelationshipTargetIdChange,
  onAddRelationship,
  onRemoveRelationship,
}: RelationshipsProps) => {
  const runesById = new Map(existingRunes.map((rune) => [rune.id, rune]));
  const selectedRelationshipIds = new Set(
    selectedRelationships.map((relationship) => relationship.targetId),
  );
  const filteredRunes = existingRunes.filter((rune) => {
    if (selectedRelationshipIds.has(rune.id)) {
      return false;
    }

    if (!relationshipFilter.trim()) {
      return true;
    }

    const query = relationshipFilter.trim().toLowerCase();
    return rune.title.toLowerCase().includes(query) || rune.id.toLowerCase().includes(query);
  });

  return (
    <div className="grid grid-cols-1 gap-4">
      <div
        className="p-4"
        style={{
          backgroundColor: "var(--color-surface)",
          border: "1px solid var(--color-border)",
        }}
      >
        <h3 className="text-xs uppercase tracking-wider font-bold mb-3">Relationships</h3>
        <div className="grid grid-cols-2 gap-2 mb-3">
          <button
            type="button"
            onClick={() => onRelationshipDirectionChange("depends_on")}
            className="px-3 py-2 text-xs font-bold uppercase tracking-wider"
            style={{
              backgroundColor:
                relationshipDirection === "depends_on" ? "var(--color-amber)" : "var(--color-bg)",
              border: "2px solid var(--color-border)",
              color: relationshipDirection === "depends_on" ? "white" : "var(--color-text)",
            }}
          >
            Depends On
          </button>
          <button
            type="button"
            onClick={() => onRelationshipDirectionChange("depended_on_by")}
            className="px-3 py-2 text-xs font-bold uppercase tracking-wider"
            style={{
              backgroundColor:
                relationshipDirection === "depended_on_by"
                  ? "var(--color-amber)"
                  : "var(--color-bg)",
              border: "2px solid var(--color-border)",
              color: relationshipDirection === "depended_on_by" ? "white" : "var(--color-text)",
            }}
          >
            Depended On By
          </button>
        </div>

        <div className="space-y-2">
          <Combobox.Root
            value={relationshipTargetId || null}
            onValueChange={(value) => {
              if (typeof value === "string") {
                onRelationshipTargetIdChange(value);
              }
            }}
            onInputValueChange={onRelationshipFilterChange}
          >
            <Combobox.Input
              placeholder="Filter runes by name or ID..."
              className="w-full px-3 py-2 text-sm outline-none"
              style={{
                backgroundColor: "var(--color-bg)",
                border: "1px solid var(--color-border)",
                color: "var(--color-text)",
              }}
            />
            <Combobox.Portal>
              <Combobox.Positioner sideOffset={8} align="start">
                <Combobox.Popup
                  className="max-h-52 overflow-auto"
                  style={{
                    backgroundColor: "var(--color-bg)",
                    border: "2px solid var(--color-border)",
                    boxShadow: "var(--shadow-soft)",
                  }}
                >
                  <Combobox.List>
                    {filteredRunes.map((rune) => (
                      <Combobox.Item
                        key={rune.id}
                        value={rune.id}
                        className="px-3 py-2 text-sm font-semibold cursor-pointer"
                      >
                        {rune.title} ({rune.id})
                      </Combobox.Item>
                    ))}
                  </Combobox.List>
                  <Combobox.Empty
                    className="px-3 py-2 text-sm"
                    style={{ color: "var(--color-text-muted)" }}
                  >
                    No matching runes.
                  </Combobox.Empty>
                </Combobox.Popup>
              </Combobox.Positioner>
            </Combobox.Portal>
          </Combobox.Root>
          <Button
            type="button"
            onClick={onAddRelationship}
            disabled={!relationshipTargetId}
            className="px-3 py-2 text-xs font-bold uppercase tracking-wider disabled:opacity-50 disabled:cursor-not-allowed"
            style={{
              backgroundColor: "var(--color-amber)",
              border: "2px solid var(--color-border)",
              color: "white",
            }}
          >
            Add Relationship
          </Button>
        </div>

        <ScrollArea.Root
          className="mt-3 max-h-44"
          style={{ border: "1px solid var(--color-border)" }}
        >
          <ScrollArea.Viewport className="max-h-44 overflow-auto">
            <ScrollArea.Content className="space-y-2 p-2">
              {selectedRelationships.length === 0 ? (
                <p className="text-sm" style={{ color: "var(--color-text-muted)" }}>
                  No relationships added.
                </p>
              ) : (
                selectedRelationships.map((relationship) => {
                  const target = runesById.get(relationship.targetId);
                  const targetName = target?.title ?? relationship.targetId;
                  const sentence =
                    relationship.direction === "depends_on"
                      ? `This rune depends on ${targetName} (${relationship.targetId}).`
                      : `${targetName} (${relationship.targetId}) depends on this rune.`;

                  return (
                    <div
                      key={`${relationship.direction}:${relationship.targetId}`}
                      className="flex items-start justify-between gap-3 p-2 text-sm"
                      style={{
                        backgroundColor: "var(--color-bg)",
                        border: "1px solid var(--color-border)",
                      }}
                    >
                      <span>{sentence}</span>
                      <Button
                        type="button"
                        onClick={() => onRemoveRelationship(relationship.targetId)}
                        className="text-xs font-bold uppercase tracking-wider"
                        style={{ color: "var(--color-red)" }}
                      >
                        Remove
                      </Button>
                    </div>
                  );
                })
              )}
            </ScrollArea.Content>
          </ScrollArea.Viewport>
          <ScrollArea.Scrollbar orientation="vertical" className="w-2">
            <ScrollArea.Thumb className="w-2" style={{ backgroundColor: "var(--color-border)" }} />
          </ScrollArea.Scrollbar>
        </ScrollArea.Root>
      </div>
    </div>
  );
};
