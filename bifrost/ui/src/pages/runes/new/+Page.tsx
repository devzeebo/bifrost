"use client";

import { useEffect, useState } from "react";
import { Button } from "@base-ui/react/button";
import { navigate } from "@/lib/router";
import { useAuth } from "../../../lib/auth";
import { useRealm } from "../../../lib/realm";
import { ApiError, api } from "../../../lib/api";
import { useToast } from "../../../lib/toast";
import { RealmSelector } from "../../../components/RealmSelector/RealmSelector";
import { RuneForm } from "./RuneForm";
import { PrioritySelector } from "./PrioritySelector";
import { StatusSelector } from "./StatusSelector";
import { Relationships } from "./Relationships";
import type { CreateRuneRequest, RuneListItem } from "../../../types/rune";

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

const Page = () => {
  const { realms, isAuthenticated, loading: authLoading } = useAuth();
  const { currentRealm, setCurrentRealm, availableRealms, isLoading: realmLoading } = useRealm();
  const { showToast } = useToast();
  const visibleRealms =
    availableRealms.length > 0 ? availableRealms : realms.filter((realmId) => realmId !== "_admin");
  const selectedRealm =
    currentRealm && visibleRealms.includes(currentRealm)
      ? currentRealm
      : (visibleRealms[0] ?? null);

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

  const updateForm = <FieldKey extends keyof FormData>(
    field: FieldKey,
    value: FormData[FieldKey],
  ) => {
    setForm((prev) => ({ ...prev, [field]: value }));
  };

  const canSubmit =
    form.title.trim().length >= 3 &&
    form.priority >= 1 &&
    form.priority <= 4 &&
    (form.status === "draft" || form.status === "open");

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
    setSelectedRelationships((prev) =>
      prev.filter((relationship) => relationship.targetId !== targetId),
    );
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
        description: form.description.trim() || "",
        priority: form.priority,
        branch: form.branch.trim(),
      };

      const rune = await api.createRune(request, selectedRealm);

      const relationshipRequests = selectedRelationships.map((relationship) =>
        api.addDependency(
          {
            rune_id: rune.id,
            target_id: relationship.targetId,
            relationship: relationship.direction === "depends_on" ? "blocked_by" : "blocks",
          },
          selectedRealm,
        ),
      );

      const linkResults = await Promise.allSettled(relationshipRequests);
      const failedLinkCount = linkResults.filter((result) => result.status === "rejected").length;

      showToast("Rune Created", `"${rune.title}" has been created`, "success");
      if (failedLinkCount > 0) {
        showToast(
          "Relationship Warning",
          `${failedLinkCount} relationship link${failedLinkCount > 1 ? "s" : ""} failed to save`,
          "warning",
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
            <RuneForm form={form} updateForm={updateForm} />
          </div>

          <div className="space-y-6">
            <div>
              <label
                htmlFor="realm-select"
                className="text-xs uppercase tracking-wider block mb-3 font-bold"
              >
                Realm
              </label>
              <RealmSelector />
            </div>

            <PrioritySelector
              priority={form.priority}
              onPriorityChange={(nextPriority) => updateForm("priority", nextPriority)}
            />
            <StatusSelector
              status={form.status}
              onStatusChange={(nextStatus) => updateForm("status", nextStatus)}
            />

            <Relationships
              existingRunes={existingRunes}
              selectedRelationships={selectedRelationships}
              relationshipDirection={relationshipDirection}
              relationshipFilter={relationshipFilter}
              relationshipTargetId={relationshipTargetId}
              onRelationshipDirectionChange={setRelationshipDirection}
              onRelationshipFilterChange={setRelationshipFilter}
              onRelationshipTargetIdChange={setRelationshipTargetId}
              onAddRelationship={addRelationship}
              onRemoveRelationship={removeRelationship}
            />
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
};

export { Page };
