"use client";

import { useEffect, useState } from "react";
import { Button } from "@base-ui/react/button";
import { Combobox } from "@base-ui/react/combobox";
import { Input } from "@base-ui/react/input";
import { ScrollArea } from "@base-ui/react/scroll-area";
import { Toggle } from "@base-ui/react/toggle";
import { ToggleGroup } from "@base-ui/react/toggle-group";
import { navigate } from "@/lib/router";
import { useAuth } from "../../../lib/auth";
import { useRealm } from "../../../lib/realm";
import { ApiError, api } from "../../../lib/api";
import { useToast } from "../../../lib/toast";
import { RealmSelector } from "../../../components/RealmSelector/RealmSelector";
import type { CreateRuneRequest, RuneListItem } from "../../../types/rune";

export { Page };

type FormData = {
  title: string;
  description: string;
  priority: number;
  status: "draft" | "open";
  branch: string;
};

type RelationshipDirection = "depends_on" | "depended_on_by";

type SelectedRelationship = {
  targetId: string;
  direction: RelationshipDirection;
};

const initialForm: FormData = {
  title: "",
  description: "",
  priority: 2,
  status: "draft",
  branch: "",
};

function Page() {
  const { realms, isAuthenticated, loading: authLoading } = useAuth();
  const { currentRealm, setCurrentRealm, availableRealms, isLoading: realmLoading } = useRealm();
  const { showToast } = useToast();
  const visibleRealms =
    availableRealms.length > 0 ? availableRealms : realms.filter((realmId) => realmId !== "_admin");
  const selectedRealm =
    currentRealm && visibleRealms.includes(currentRealm) ? currentRealm : (visibleRealms[0] ?? null);

  const [form, setForm] = useState<FormData>(initialForm);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [existingRunes, setExistingRunes] = useState<RuneListItem[]>([]);
  const [selectedRelationships, setSelectedRelationships] = useState<SelectedRelationship[]>([]);
  const [relationshipDirection, setRelationshipDirection] =
    useState<RelationshipDirection>("depends_on");
  const [relationshipFilter, setRelationshipFilter] = useState("");
  const [relationshipTargetId, setRelationshipTargetId] = useState("");
  const [queryRealmApplied, setQueryRealmApplied] = useState(false);

  useEffect(() => {
    if (queryRealmApplied || realmLoading) {
      return;
    }

    const search = typeof window !== "undefined" ? window.location.search : "";
    const requestedRealm = new URLSearchParams(search).get("realm");
    if (requestedRealm && visibleRealms.includes(requestedRealm)) {
      setCurrentRealm(requestedRealm);
    }
    setQueryRealmApplied(true);
  }, [queryRealmApplied, realmLoading, setCurrentRealm, visibleRealms]);

  useEffect(() => {
    if (authLoading || realmLoading || !isAuthenticated || !selectedRealm) {
      return;
    }

    const loadRunes = async () => {
      try {
        const runes = await api.getRunes(selectedRealm);
        setExistingRunes(runes);
      } catch {
        setExistingRunes([]);
      }
    };

    void loadRunes();
  }, [authLoading, isAuthenticated, realmLoading, selectedRealm]);

  if (authLoading || realmLoading) {
    return (
      <div className="min-h-[calc(100vh-56px)] flex items-center justify-center">
        <div
          className="px-8 py-4 text-lg font-bold uppercase tracking-wider"
          style={{
            backgroundColor: "var(--color-bg)",
            border: "2px solid var(--color-border)",
            boxShadow: "var(--shadow-soft)",
          }}
        >
          Loading...
        </div>
      </div>
    );
  }

  if (!isAuthenticated) {
    navigate("/login");
    return null;
  }

  if (visibleRealms.length === 0) {
    return (
      <div className="min-h-[calc(100vh-56px)] flex items-center justify-center p-6">
        <div
          className="p-8 text-center max-w-md"
          style={{
            backgroundColor: "var(--color-bg)",
            border: "2px solid var(--color-border)",
            boxShadow: "var(--shadow-soft)",
          }}
        >
          <h2 className="text-2xl font-bold mb-4 uppercase tracking-tight">No Realms Found</h2>
          <p className="text-sm" style={{ color: "var(--color-text-muted)" }}>
            You need access to a realm to create runes.
          </p>
        </div>
      </div>
    );
  }

  const updateForm = <K extends keyof FormData>(field: K, value: FormData[K]) => {
    setForm((prev) => ({ ...prev, [field]: value }));
  };

  const canSubmit =
    form.title.trim().length >= 3 &&
    form.priority >= 1 &&
    form.priority <= 4 &&
    (form.status === "draft" || form.status === "open");

  const runesById = new Map(existingRunes.map((rune) => [rune.id, rune]));
  const selectedRelationshipIds = new Set(selectedRelationships.map((relationship) => relationship.targetId));
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

  const addRelationship = () => {
    if (!relationshipTargetId) {
      return;
    }

    setSelectedRelationships((prev) => {
      const next = prev.filter((relationship) => relationship.targetId !== relationshipTargetId);
      return [...next, { targetId: relationshipTargetId, direction: relationshipDirection }];
    });
    setRelationshipTargetId("");
  };

  const removeRelationship = (targetId: string) => {
    setSelectedRelationships((prev) => prev.filter((relationship) => relationship.targetId !== targetId));
  };

  const handleSubmit = async () => {
    if (!canSubmit) {
      return;
    }

    if (!selectedRealm) {
      showToast("Error", "Select a realm before creating a rune", "error");
      return;
    }

    setIsSubmitting(true);

    try {
      const request: CreateRuneRequest = {
        title: form.title.trim(),
        description: form.description.trim() || undefined,
        priority: form.priority,
        branch: form.branch.trim(),
      };

      const rune = await api.createRune(request, selectedRealm);

      const relationshipRequests = selectedRelationships.map((relationship) =>
        api.addDependency({
          rune_id: rune.id,
          target_id: relationship.targetId,
          relationship: relationship.direction === "depends_on" ? "blocked_by" : "blocks",
        }, selectedRealm)
      );

      const linkResults = await Promise.allSettled(relationshipRequests);
      const failedLinkCount = linkResults.filter((result) => result.status === "rejected").length;

      showToast("Rune Created", `"${rune.title}" has been created`, "success");
      if (failedLinkCount > 0) {
        showToast(
          "Relationship Warning",
          `${failedLinkCount} relationship link${failedLinkCount > 1 ? "s" : ""} failed to save`,
          "warning"
        );
      }

      navigate(`/runes/${rune.id}`);
    } catch (error) {
      if (error instanceof ApiError) {
        const apiMessage =
          typeof error.data === "object" &&
          error.data !== null &&
          "error" in error.data &&
          typeof (error.data as { error?: unknown }).error === "string"
            ? (error.data as { error: string }).error
            : `Request failed (${error.status})`;
        showToast("Error", apiMessage, "error");
      } else {
        showToast("Error", "Failed to create rune", "error");
      }
      setIsSubmitting(false);
    }
  };

  return (
    <div className="min-h-[calc(100vh-56px)] p-6">
      <div className="mb-6">
        <Button
          onClick={() => navigate("/runes")}
          className="inline-flex items-center gap-2 text-sm font-bold uppercase tracking-wider transition-all duration-150 hover:translate-x-[-2px]"
          style={{ color: "var(--color-text-muted)" }}
        >
          <span>&larr;</span>
          <span>Back to Runes</span>
        </Button>
      </div>

      <div
        className="max-w-6xl mx-auto p-6"
        style={{
          backgroundColor: "var(--color-bg)",
          border: "2px solid var(--color-border)",
          boxShadow: "var(--shadow-soft)",
        }}
      >
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <div className="space-y-6">
            <div>
              <label htmlFor="new-rune-title" className="text-xs uppercase tracking-wider block mb-2 font-bold">
                Title
              </label>
              <Input
                id="new-rune-title"
                type="text"
                value={form.title}
                onChange={(e) => updateForm("title", e.target.value)}
                placeholder="Enter a descriptive title..."
                className="w-full px-4 py-3 text-lg outline-none"
                style={{
                  backgroundColor: "var(--color-surface)",
                  border: "2px solid var(--color-border)",
                  color: "var(--color-text)",
                }}
                autoFocus
              />
            </div>

            <div>
              <label htmlFor="new-rune-description" className="text-xs uppercase tracking-wider block mb-2 font-bold">
                Description
              </label>
              <textarea
                id="new-rune-description"
                value={form.description}
                onChange={(e) => updateForm("description", e.target.value)}
                placeholder="Add details about what this rune involves..."
                rows={6}
                className="w-full px-4 py-3 text-base outline-none resize-none"
                style={{
                  backgroundColor: "var(--color-surface)",
                  border: "2px solid var(--color-border)",
                  color: "var(--color-text)",
                }}
              />
            </div>

            <div>
              <label htmlFor="new-rune-branch" className="text-xs uppercase tracking-wider block mb-2 font-bold">
                Branch
              </label>
              <Input
                id="new-rune-branch"
                type="text"
                value={form.branch}
                onChange={(e) => updateForm("branch", e.target.value)}
                placeholder="e.g., feature/my-feature"
                className="w-full px-4 py-3 text-base font-mono outline-none"
                style={{
                  backgroundColor: "var(--color-surface)",
                  border: "2px solid var(--color-border)",
                  color: "var(--color-text)",
                }}
              />
            </div>
          </div>

          <div className="space-y-6">
            <div>
              <label htmlFor="realm-select" className="text-xs uppercase tracking-wider block mb-3 font-bold">
                Realm
              </label>
              <RealmSelector />
            </div>

            <div>
              <div className="text-xs uppercase tracking-wider block mb-3 font-bold">Priority</div>
              <ToggleGroup
                value={[String(form.priority)]}
                onValueChange={(values) => {
                  const nextPriority = Number(values[0]);
                  if (!Number.isNaN(nextPriority)) {
                    updateForm("priority", nextPriority);
                  }
                }}
                className="grid grid-cols-4 gap-2"
              >
                {[
                  { value: 4, label: "P1" },
                  { value: 3, label: "P2" },
                  { value: 2, label: "P3" },
                  { value: 1, label: "P4" },
                ].map((priority) => (
                  <Toggle
                    key={priority.value}
                    value={String(priority.value)}
                    className="px-3 py-2 text-sm font-bold uppercase tracking-wider"
                    style={{
                      backgroundColor:
                        form.priority === priority.value ? "var(--color-amber)" : "var(--color-bg)",
                      border: "2px solid var(--color-border)",
                      color: form.priority === priority.value ? "white" : "var(--color-text)",
                    }}
                  >
                    {priority.label}
                  </Toggle>
                ))}
              </ToggleGroup>
            </div>

            <div>
              <div className="text-xs uppercase tracking-wider block mb-3 font-bold">Status</div>
              <ToggleGroup
                value={[form.status]}
                onValueChange={(values) => {
                  const nextStatus = values[0];
                  if (nextStatus === "draft" || nextStatus === "open") {
                    updateForm("status", nextStatus);
                  }
                }}
                className="grid grid-cols-2 gap-2"
              >
                {["draft", "open"].map((status) => (
                  <Toggle
                    key={status}
                    value={status}
                    className="px-3 py-2 text-sm font-bold uppercase tracking-wider"
                    style={{
                      backgroundColor:
                        form.status === status ? "var(--color-amber)" : "var(--color-bg)",
                      border: "2px solid var(--color-border)",
                      color: form.status === status ? "white" : "var(--color-text)",
                    }}
                  >
                    {status}
                  </Toggle>
                ))}
              </ToggleGroup>
            </div>

            <div className="grid grid-cols-1 gap-4">
              <div
                className="p-4"
                style={{
                  backgroundColor: "var(--color-surface)",
                  border: "1px solid var(--color-border)",
                }}
              >
                <h3 className="text-xs uppercase tracking-wider font-bold mb-3">
                  Relationships
                </h3>
                <div className="grid grid-cols-2 gap-2 mb-3">
                  <button
                    type="button"
                    onClick={() => setRelationshipDirection("depends_on")}
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
                    onClick={() => setRelationshipDirection("depended_on_by")}
                    className="px-3 py-2 text-xs font-bold uppercase tracking-wider"
                    style={{
                      backgroundColor:
                        relationshipDirection === "depended_on_by" ? "var(--color-amber)" : "var(--color-bg)",
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
                        setRelationshipTargetId(value);
                      }
                    }}
                    onInputValueChange={setRelationshipFilter}
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
                          <Combobox.Empty className="px-3 py-2 text-sm" style={{ color: "var(--color-text-muted)" }}>
                            No matching runes.
                          </Combobox.Empty>
                        </Combobox.Popup>
                      </Combobox.Positioner>
                    </Combobox.Portal>
                  </Combobox.Root>
                  <Button
                    type="button"
                    onClick={addRelationship}
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

                <ScrollArea.Root className="mt-3 max-h-44" style={{ border: "1px solid var(--color-border)" }}>
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
                                onClick={() => removeRelationship(relationship.targetId)}
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
                    <ScrollArea.Thumb
                      className="w-2"
                      style={{ backgroundColor: "var(--color-border)" }}
                    />
                  </ScrollArea.Scrollbar>
                </ScrollArea.Root>
              </div>
            </div>
          </div>
        </div>

        <div className="mt-8 flex gap-3">
          <Button
            type="button"
            onClick={() => navigate("/runes")}
            className="px-6 py-3 text-sm font-bold uppercase tracking-wider"
            style={{
              backgroundColor: "var(--color-bg)",
              border: "2px solid var(--color-border)",
              color: "var(--color-text)",
            }}
          >
            Cancel
          </Button>
          <Button
            type="button"
            onClick={handleSubmit}
            disabled={!canSubmit || isSubmitting}
            className="px-6 py-3 text-sm font-bold uppercase tracking-wider disabled:opacity-50 disabled:cursor-not-allowed"
            style={{
              backgroundColor: "var(--color-amber)",
              border: "2px solid var(--color-border)",
              color: "white",
            }}
          >
            {isSubmitting ? "Creating..." : "Create Rune"}
          </Button>
        </div>
      </div>
    </div>
  );
}
