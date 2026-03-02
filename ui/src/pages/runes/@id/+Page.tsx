"use client";

import { useCallback, useEffect, useState } from "react";
import { Button } from "@base-ui/react/button";
import { Combobox } from "@base-ui/react/combobox";
import { Dialog as BaseDialog } from "@base-ui/react/dialog";
import { Input } from "@base-ui/react/input";
import { navigate } from "@/lib/router";
import { usePageContext } from "vike-react/usePageContext";
import { useAuth } from "../../../lib/auth";
import { useRealm } from "../../../lib/realm";
import { useToast } from "../../../lib/toast";
import { api } from "../../../lib/api";
import { Dialog } from "../../../components/Dialog/Dialog";
import type { RuneDetail, RuneListItem, RuneStatus } from "../../../types/rune";

export { Page };

const statusColors: Record<RuneStatus, { bg: string; border: string; text: string }> = {
  draft: {
    bg: "var(--color-bg)",
    border: "var(--color-border)",
    text: "var(--color-border)",
  },
  open: {
    bg: "var(--color-blue)",
    border: "var(--color-border)",
    text: "white",
  },
  in_progress: {
    bg: "var(--color-amber)",
    border: "var(--color-border)",
    text: "white",
  },
  fulfilled: {
    bg: "var(--color-green)",
    border: "var(--color-border)",
    text: "white",
  },
  sealed: {
    bg: "var(--color-purple)",
    border: "var(--color-border)",
    text: "white",
  },
};

function Page() {
  const pageContext = usePageContext();
  const runeId = pageContext.routeParams?.id as string;
  const {
    realms,
    roles,
    realmNames,
    isSysadmin,
    accountId,
    username,
    isAuthenticated,
    loading: authLoading,
  } = useAuth();
  const { currentRealm, availableRealms, realmOptions, isLoading: realmLoading } = useRealm();
  const { showToast } = useToast();
  const fallbackRealms = realms.filter((realmId) => realmId !== "_admin");
  const effectiveRealms = availableRealms.length > 0 ? availableRealms : fallbackRealms;
  const effectiveRealm =
    currentRealm && effectiveRealms.includes(currentRealm)
      ? currentRealm
      : (effectiveRealms[0] ?? null);

  const [rune, setRune] = useState<RuneDetail | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [showShatterDialog, setShowShatterDialog] = useState(false);
  const [showRelationDialog, setShowRelationDialog] = useState(false);
  const [pendingRemoval, setPendingRemoval] = useState<{
    targetId: string;
    relationship: string;
    column: "dependencies" | "dependents";
  } | null>(null);
  const [isMutating, setIsMutating] = useState(false);
  const [assignTarget, setAssignTarget] = useState("");
  const [sealReason, setSealReason] = useState("");
  const [availableRunes, setAvailableRunes] = useState<RuneListItem[]>([]);
  const [currentRuneSummary, setCurrentRuneSummary] = useState<RuneListItem | null>(null);
  const [resolvedClaimantUsername, setResolvedClaimantUsername] = useState<string | null>(null);
  const [relationshipFilter, setRelationshipFilter] = useState("");
  const [relationshipTargetId, setRelationshipTargetId] = useState("");
  const [relationshipColumn, setRelationshipColumn] = useState<"dependencies" | "dependents">(
    "dependencies"
  );

  const loadRune = useCallback(async () => {
    if (!runeId || !effectiveRealm) {
      setIsLoading(false);
      return;
    }

    try {
      const data = await api.getRune(effectiveRealm, runeId);
      setRune(data);
    } catch {
      showToast("Error", "Failed to load rune", "error");
    } finally {
      setIsLoading(false);
    }
  }, [effectiveRealm, runeId, showToast]);

  const loadRuneOptions = useCallback(async () => {
    if (!effectiveRealm || !runeId) {
      setAvailableRunes([]);
      return;
    }

    try {
      const runes = await api.getRunes(effectiveRealm);
      setAvailableRunes(runes);
      const matchingRune = runes.find((candidate) => candidate.id === runeId) ?? null;
      setCurrentRuneSummary(matchingRune);
      if (matchingRune?.claimant_username && matchingRune.claimant_username !== "<nil>") {
        setResolvedClaimantUsername(matchingRune.claimant_username);
      }
    } catch {
      showToast("Error", "Failed to load rune options", "error");
    }
  }, [effectiveRealm, runeId, showToast]);

  const loadClaimantUsername = useCallback(async () => {
    const summaryClaimantUsername =
      currentRuneSummary?.claimant_username && currentRuneSummary.claimant_username !== "<nil>"
        ? currentRuneSummary.claimant_username
        : null;
    if (summaryClaimantUsername) {
      setResolvedClaimantUsername(summaryClaimantUsername);
      return;
    }

    const claimantId =
      (rune?.claimant && rune.claimant !== "<nil>" ? rune.claimant : null) ??
      currentRuneSummary?.claimant ??
      null;
    if (!effectiveRealm || !claimantId) {
      setResolvedClaimantUsername(null);
      return;
    }

    if (accountId && username && claimantId === accountId) {
      setResolvedClaimantUsername(username);
      return;
    }

    try {
      const account = await api.getAccount(effectiveRealm, claimantId);
      setResolvedClaimantUsername(account.username || null);
    } catch {
      setResolvedClaimantUsername(null);
    }
  }, [
    accountId,
    currentRuneSummary?.claimant,
    currentRuneSummary?.claimant_username,
    effectiveRealm,
    rune?.claimant,
    username,
  ]);

  useEffect(() => {
    if (authLoading || realmLoading) return;

    if (!isAuthenticated) {
      navigate("/login");
      return;
    }

    void loadRune();
    void loadRuneOptions();
  }, [authLoading, isAuthenticated, loadRune, loadRuneOptions, realmLoading]);

  useEffect(() => {
    void loadClaimantUsername();
  }, [loadClaimantUsername]);

  const handleShatter = async () => {
    if (!rune || !effectiveRealm) return;

    setIsMutating(true);
    try {
      await api.shatterRune(rune.id, effectiveRealm);
      showToast("Rune Shattered", `"${rune.title}" has been shattered`, "success");
      navigate("/runes");
    } catch {
      showToast("Error", "Failed to shatter rune", "error");
      setIsMutating(false);
    }
  };

  const isRealmAdmin = (effectiveRealm ? roles[effectiveRealm] : undefined) === "admin";
  const isAdmin = isRealmAdmin || isSysadmin;
  const runeStatus: string = rune?.status ?? "";
  const canForge = runeStatus === "draft";
  const canClaim = runeStatus === "open" && Boolean(accountId);
  const canAssign = runeStatus === "open" && isRealmAdmin;
  const canFulfill =
    runeStatus === "claimed" &&
    ((Boolean(accountId) && rune?.assignee_id === accountId) || isAdmin);
  const canSeal = runeStatus !== "fulfilled" && runeStatus !== "sealed" && runeStatus !== "";
  const canShatter = runeStatus === "sealed" || runeStatus === "fulfilled";

  const handleForge = async () => {
    if (!effectiveRealm || !rune) return;

    setIsMutating(true);
    try {
      await api.forgeRune(rune.id, effectiveRealm);
      showToast("Rune Forged", `"${rune.title}" is now open`, "success");
      setIsLoading(true);
      await loadRune();
    } catch {
      showToast("Error", "Failed to forge rune", "error");
    } finally {
      setIsMutating(false);
    }
  };

  const handleClaim = async () => {
    if (!effectiveRealm || !rune || !accountId) return;

    setIsMutating(true);
    try {
      await api.claimRune(rune.id, accountId, effectiveRealm);
      showToast("Rune Claimed", `You are now assigned to "${rune.title}"`, "success");
      setIsLoading(true);
      await loadRune();
    } catch {
      showToast("Error", "Failed to claim rune", "error");
    } finally {
      setIsMutating(false);
    }
  };

  const handleAssign = async () => {
    if (!effectiveRealm || !rune) return;
    const target = assignTarget.trim();
    if (!target) {
      showToast("Error", "Enter an account ID to assign", "error");
      return;
    }

    setIsMutating(true);
    try {
      await api.claimRune(rune.id, target, effectiveRealm);
      showToast("Rune Assigned", `Assigned "${rune.title}" to ${target}`, "success");
      setIsLoading(true);
      await loadRune();
    } catch {
      showToast("Error", "Failed to assign rune", "error");
    } finally {
      setIsMutating(false);
    }
  };

  const handleFulfill = async () => {
    if (!effectiveRealm || !rune) return;

    setIsMutating(true);
    try {
      await api.fulfillRune(rune.id, effectiveRealm);
      showToast("Rune Fulfilled", `"${rune.title}" has been fulfilled`, "success");
      setIsLoading(true);
      await loadRune();
    } catch {
      showToast("Error", "Failed to fulfill rune", "error");
    } finally {
      setIsMutating(false);
    }
  };

  const handleSeal = async () => {
    if (!effectiveRealm || !rune) return;

    setIsMutating(true);
    try {
      await api.sealRune(rune.id, sealReason.trim(), effectiveRealm);
      showToast("Rune Sealed", `"${rune.title}" has been sealed`, "success");
      setIsLoading(true);
      await loadRune();
    } catch {
      showToast("Error", "Failed to seal rune", "error");
    } finally {
      setIsMutating(false);
    }
  };

  const formatDate = (dateStr: string) => {
    const date = new Date(dateStr);
    return date.toLocaleDateString("en-US", {
      year: "numeric",
      month: "long",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  };

  const getStatusStyle = (status: string) => {
    if (status === "claimed") {
      return {
        bg: "var(--color-amber)",
        border: "var(--color-border)",
        text: "white",
      };
    }
    return statusColors[status as RuneStatus] ?? statusColors.draft;
  };

  const getPriorityBadge = (priority: number) => {
    if (priority >= 4) {
      return { label: "P1", color: "var(--color-red)" };
    }
    if (priority >= 3) {
      return { label: "P2", color: "var(--color-amber)" };
    }
    if (priority >= 2) {
      return { label: "P3", color: "var(--color-blue)" };
    }
    return { label: "P4", color: "var(--color-text-muted)" };
  };

  const dependencies = rune?.dependencies.filter((dep) => dep.relationship === "blocked_by") ?? [];
  const dependents = rune?.dependencies.filter((dep) => dep.relationship === "blocks") ?? [];
  const runeTitleById = new Map(availableRunes.map((candidate) => [candidate.id, candidate.title]));

  const getRuneDisplay = (targetId: string) => {
    const title = runeTitleById.get(targetId);
    if (!title) {
      return { title: targetId, id: targetId, hasDistinctTitle: false };
    }
    return { title, id: targetId, hasDistinctTitle: title !== targetId };
  };

  const filteredRuneOptions = availableRunes.filter((candidate) => {
    if (candidate.id === rune?.id) {
      return false;
    }
    if (!relationshipFilter.trim()) {
      return true;
    }
    const query = relationshipFilter.trim().toLowerCase();
    return (
      candidate.id.toLowerCase().includes(query) ||
      candidate.title.toLowerCase().includes(query)
    );
  });

  const openRelationshipDialog = (column: "dependencies" | "dependents") => {
    setRelationshipColumn(column);
    setRelationshipFilter("");
    setRelationshipTargetId("");
    void loadRuneOptions();
    setShowRelationDialog(true);
  };

  const closeRelationshipDialog = () => {
    setShowRelationDialog(false);
    setRelationshipFilter("");
    setRelationshipTargetId("");
  };

  const handleAddRelationship = async () => {
    if (!effectiveRealm || !rune || !relationshipTargetId) {
      return;
    }

    const nextRelationship = relationshipColumn === "dependencies" ? "blocked_by" : "blocks";
    const alreadyLinked = (rune.dependencies ?? []).some(
      (dependency) =>
        dependency.target_id === relationshipTargetId && dependency.relationship === nextRelationship
    );
    if (alreadyLinked) {
      showToast("Relationship Exists", "That relationship already exists", "error");
      return;
    }

    setIsMutating(true);
    try {
      await api.addDependency(
        {
          rune_id: rune.id,
          target_id: relationshipTargetId,
          relationship: nextRelationship,
        },
        effectiveRealm
      );
      showToast(
        "Relationship Added",
        relationshipColumn === "dependencies"
          ? `Added dependency on ${relationshipTargetId}`
          : `Added dependent ${relationshipTargetId}`,
        "success"
      );
      closeRelationshipDialog();
      setIsLoading(true);
      await loadRune();
      await loadRuneOptions();
    } catch {
      showToast("Error", "Failed to add relationship", "error");
    } finally {
      setIsMutating(false);
    }
  };

  const requestRelationshipRemoval = (
    targetId: string,
    relationship: string,
    column: "dependencies" | "dependents"
  ) => {
    setPendingRemoval({ targetId, relationship, column });
  };

  const closeRemoveDialog = () => {
    setPendingRemoval(null);
  };

  const handleRemoveRelationship = async () => {
    if (!effectiveRealm || !rune || !pendingRemoval) {
      return;
    }

    setIsMutating(true);
    try {
      await api.removeDependency(
        {
          rune_id: rune.id,
          target_id: pendingRemoval.targetId,
          relationship: pendingRemoval.relationship,
        },
        effectiveRealm
      );
      showToast(
        "Relationship Removed",
        pendingRemoval.column === "dependencies"
          ? `Removed dependency ${pendingRemoval.targetId}`
          : `Removed dependent ${pendingRemoval.targetId}`,
        "success"
      );
      closeRemoveDialog();
      setIsLoading(true);
      await loadRune();
      await loadRuneOptions();
    } catch {
      showToast("Error", "Failed to remove relationship", "error");
    } finally {
      setIsMutating(false);
    }
  };

  if (authLoading || realmLoading || isLoading) {
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

  if (!rune) {
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
          <h2 className="text-2xl font-bold mb-4 uppercase tracking-tight">
            Rune Not Found
          </h2>
          <p className="text-sm mb-6" style={{ color: "var(--color-text-muted)" }}>
            The rune you're looking for doesn't exist or you don't have access to it.
          </p>
          <Button
            onClick={() => navigate("/runes")}
            className="px-6 py-3 text-sm font-bold uppercase tracking-wider transition-all duration-150"
            style={{
              backgroundColor: "var(--color-amber)",
              border: "2px solid var(--color-border)",
              color: "white",
            boxShadow: "var(--shadow-soft)",
            }}
            onMouseEnter={(e) => {
                  e.currentTarget.style.boxShadow = "var(--shadow-soft-hover)";
              e.currentTarget.style.transform = "translate(2px, 2px)";
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.boxShadow = "var(--shadow-soft)";
              e.currentTarget.style.transform = "translate(0, 0)";
            }}
          >
            Back to Runes
          </Button>
        </div>
      </div>
    );
  }

  const statusStyle = getStatusStyle(rune.status);
  const realmId = rune.realm_id || currentRuneSummary?.realm_id || effectiveRealm || "";
  const realmName =
    realmOptions.find((realmOption) => realmOption.id === realmId)?.name ??
    realmNames[realmId] ??
    realmId;
  const claimantId =
    (rune.claimant && rune.claimant !== "<nil>" ? rune.claimant : null) ??
    currentRuneSummary?.claimant ??
    null;
  const claimantName =
    rune.claimant_username ||
    resolvedClaimantUsername ||
    currentRuneSummary?.claimant_username ||
    ((accountId && username && claimantId === accountId ? username : null) ?? null);
  const priorityBadge = getPriorityBadge(rune.priority);

  return (
    <div className="min-h-[calc(100vh-56px)] p-6">
      {/* Header */}
      <div className="mb-8">
        <div className="grid grid-cols-[auto_1fr_auto] items-center gap-4">
          <Button
            onClick={() => navigate("/runes")}
            className="inline-flex items-center gap-2 text-sm font-bold uppercase tracking-wider transition-all duration-150 hover:translate-x-[-2px]"
            style={{ color: "var(--color-text-muted)" }}
          >
            <span>&larr;</span>
            <span>Back to Runes</span>
          </Button>

          <div className="justify-self-center flex flex-wrap items-center justify-center gap-4 text-center">
            <span
              className="text-xs uppercase tracking-wider px-3 py-1 font-bold"
              style={{
                backgroundColor: statusStyle.bg,
                border: `2px solid ${statusStyle.border}`,
                color: statusStyle.text,
              }}
            >
              {rune.status.replace("_", " ")}
            </span>
            <h1
              className="text-4xl font-bold tracking-tight uppercase"
              style={{ color: "var(--color-amber)" }}
            >
              {rune.title}
            </h1>
            <span
              className="text-xs uppercase tracking-wider"
              style={{ color: "var(--color-text-muted)" }}
            >
              ID: {rune.id}
            </span>
          </div>

          <Button
            onClick={() => navigate(`/runes/${rune.id}/edit`)}
            className="inline-flex h-9 w-9 items-center justify-center text-base font-bold"
            style={{
              backgroundColor: "var(--color-amber)",
              border: "2px solid var(--color-border)",
              color: "white",
              boxShadow: "var(--shadow-soft)",
            }}
            title="Edit Rune"
            aria-label="Edit rune"
            disabled={isMutating}
          >
            <svg viewBox="0 0 24 24" width="14" height="14" fill="currentColor" aria-hidden="true">
              <path d="M3 17.25V21h3.75L17.8 9.94l-3.75-3.75L3 17.25zm17.71-10.04a1.003 1.003 0 0 0 0-1.42l-2.5-2.5a1.003 1.003 0 0 0-1.42 0L14.83 5.25l3.75 3.75 2.13-2.12z" />
            </svg>
          </Button>
        </div>
      </div>

      {/* Main Content */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Description Card */}
        <div
          className="lg:col-span-2 p-6"
          style={{
            backgroundColor: "var(--color-bg)",
            border: "2px solid var(--color-border)",
            boxShadow: "var(--shadow-soft)",
          }}
        >
          {rune.description ? (
            <p className="text-base leading-relaxed whitespace-pre-wrap">
              {rune.description}
            </p>
          ) : (
            <p
              className="text-base italic"
              style={{ color: "var(--color-text-muted)" }}
            >
              No description provided
            </p>
          )}
        </div>

        {/* Sidebar */}
        <div className="space-y-6">
          {/* Details Card */}
          <div
            className="p-6"
            style={{
              backgroundColor: "var(--color-bg)",
              border: "2px solid var(--color-border)",
            boxShadow: "var(--shadow-soft)",
            }}
          >
            <div className="space-y-4">
              <div>
                <div
                  className="text-xs uppercase tracking-wider block mb-1"
                  style={{ color: "var(--color-text-muted)" }}
                >
                  Claimant
                </div>
                {claimantName || claimantId ? (
                  <div className="text-sm font-mono">
                    <span>{claimantName || claimantId}</span>
                    {claimantName && claimantId && claimantName !== claimantId ? (
                      <span
                        className="ml-2 text-xs"
                        style={{ color: "var(--color-text-muted)" }}
                      >
                        {claimantId}
                      </span>
                    ) : null}
                  </div>
                ) : (
                  <span className="text-sm font-mono">-</span>
                )}
              </div>

              <div>
                <div
                  className="text-xs uppercase tracking-wider block mb-1"
                  style={{ color: "var(--color-text-muted)" }}
                >
                  Realm
                </div>
                {realmName || realmId ? (
                  <div className="text-sm">
                    <span>{realmName || realmId}</span>
                    {realmName && realmId && realmName !== realmId ? (
                      <span
                        className="ml-2 text-xs"
                        style={{ color: "var(--color-text-muted)" }}
                      >
                        {realmId}
                      </span>
                    ) : null}
                  </div>
                ) : (
                  <span className="text-sm">-</span>
                )}
              </div>

              <div>
                <div
                  className="text-xs uppercase tracking-wider block mb-1"
                  style={{ color: "var(--color-text-muted)" }}
                >
                  Priority
                </div>
                <span
                  className="text-xs font-bold px-2 py-1"
                  style={{
                    backgroundColor: priorityBadge.color,
                    color: "white",
                  }}
                >
                  {priorityBadge.label}
                </span>
              </div>

              <div>
                <div
                  className="text-xs uppercase tracking-wider block mb-1"
                  style={{ color: "var(--color-text-muted)" }}
                >
                  Created
                </div>
                <span className="text-sm">{formatDate(rune.created_at)}</span>
              </div>

              <div>
                <div
                  className="text-xs uppercase tracking-wider block mb-1"
                  style={{ color: "var(--color-text-muted)" }}
                >
                  Updated
                </div>
                <span className="text-sm">{formatDate(rune.updated_at)}</span>
              </div>

              {rune.saga_id && (
                <div>
                  <div
                    className="text-xs uppercase tracking-wider block mb-1"
                    style={{ color: "var(--color-text-muted)" }}
                  >
                    Saga
                  </div>
                  <span className="text-sm font-mono">{rune.saga_id}</span>
                </div>
              )}

              {rune.assignee_id && (
                <div>
                  <div
                    className="text-xs uppercase tracking-wider block mb-1"
                    style={{ color: "var(--color-text-muted)" }}
                  >
                    Assignee
                  </div>
                  <span className="text-sm font-mono">{rune.assignee_id}</span>
                </div>
              )}
            </div>
          </div>

          {/* Tags Card */}
          {rune.tags.length > 0 && (
            <div
              className="p-6"
              style={{
                backgroundColor: "var(--color-bg)",
                border: "2px solid var(--color-border)",
            boxShadow: "var(--shadow-soft)",
              }}
            >
              <h2
                className="text-sm uppercase tracking-wider font-bold mb-4"
                style={{ color: "var(--color-text-muted)" }}
              >
                Tags
              </h2>
              <div className="flex flex-wrap gap-2">
                {rune.tags.map((tag) => (
                  <span
                    key={tag}
                    className="text-xs px-2 py-1 font-semibold uppercase tracking-wider"
                    style={{
                      backgroundColor: "var(--color-amber)",
                      border: "1px solid var(--color-border)",
                      color: "white",
                    }}
                  >
                    {tag}
                  </span>
                ))}
              </div>
            </div>
          )}

          {/* Actions Card */}
          <div
            className="p-6"
            style={{
              backgroundColor: "var(--color-bg)",
              border: "2px solid var(--color-border)",
            boxShadow: "var(--shadow-soft)",
            }}
          >
            <div className="space-y-3">
              {canForge && (
                <Button
                  onClick={handleForge}
                  className="w-full px-4 py-3 text-sm font-bold uppercase tracking-wider"
                  style={{
                    backgroundColor: "var(--color-blue)",
                    border: "2px solid var(--color-border)",
                    color: "white",
                  }}
                  disabled={isMutating}
                >
                  Forge
                </Button>
              )}

              {canClaim && (
                <Button
                  onClick={handleClaim}
                  className="w-full px-4 py-3 text-sm font-bold uppercase tracking-wider"
                  style={{
                    backgroundColor: "var(--color-green)",
                    border: "2px solid var(--color-border)",
                    color: "white",
                  }}
                  disabled={isMutating}
                >
                  Claim
                </Button>
              )}

              {canAssign && (
                <div className="space-y-2">
                  <Input
                    value={assignTarget}
                    onChange={(e) => setAssignTarget(e.target.value)}
                    placeholder="Assignee account ID"
                    className="w-full px-3 py-2 text-sm font-mono outline-none"
                    style={{
                      backgroundColor: "var(--color-surface)",
                      border: "2px solid var(--color-border)",
                      color: "var(--color-text)",
                    }}
                  />
                  <Button
                    onClick={handleAssign}
                    className="w-full px-4 py-3 text-sm font-bold uppercase tracking-wider"
                    style={{
                      backgroundColor: "var(--color-blue)",
                      border: "2px solid var(--color-border)",
                      color: "white",
                    }}
                    disabled={isMutating || assignTarget.trim().length === 0}
                  >
                    Assign
                  </Button>
                </div>
              )}

              {canFulfill && (
                <Button
                  onClick={handleFulfill}
                  className="w-full px-4 py-3 text-sm font-bold uppercase tracking-wider"
                  style={{
                    backgroundColor: "var(--color-green)",
                    border: "2px solid var(--color-border)",
                    color: "white",
                  }}
                  disabled={isMutating}
                >
                  Fulfill
                </Button>
              )}

              {canSeal && (
                <div className="space-y-2">
                  <Input
                    value={sealReason}
                    onChange={(e) => setSealReason(e.target.value)}
                    placeholder="Seal reason (optional)"
                    className="w-full px-3 py-2 text-sm outline-none"
                    style={{
                      backgroundColor: "var(--color-surface)",
                      border: "2px solid var(--color-border)",
                      color: "var(--color-text)",
                    }}
                  />
                  <Button
                    onClick={handleSeal}
                    className="w-full px-4 py-3 text-sm font-bold uppercase tracking-wider"
                    style={{
                      backgroundColor: "var(--color-purple)",
                      border: "2px solid var(--color-border)",
                      color: "white",
                    }}
                    disabled={isMutating}
                  >
                    Seal
                  </Button>
                </div>
              )}

              {canShatter && (
                <Button
                  onClick={() => setShowShatterDialog(true)}
                  className="w-full px-4 py-3 text-sm font-bold uppercase tracking-wider"
                  style={{
                    backgroundColor: "var(--color-red)",
                    border: "2px solid var(--color-border)",
                    color: "white",
                  }}
                  disabled={isMutating}
                >
                  Shatter
                </Button>
              )}
            </div>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mt-6">
        <div
          className="p-6"
          style={{
            backgroundColor: "var(--color-bg)",
            border: "2px solid var(--color-border)",
            boxShadow: "var(--shadow-soft)",
          }}
        >
          <div className="flex items-center justify-between mb-4">
            <h2
              className="text-sm uppercase tracking-wider font-bold"
              style={{ color: "var(--color-text-muted)" }}
            >
              Dependencies
            </h2>
            <Button
              onClick={() => openRelationshipDialog("dependencies")}
              className="h-7 w-7 p-0 text-lg font-bold"
              style={{
                backgroundColor: "var(--color-amber)",
                border: "2px solid var(--color-border)",
                color: "white",
              }}
              disabled={isMutating}
            >
              +
            </Button>
          </div>
          <div className="space-y-2">
            {dependencies.length > 0 ? (
              dependencies.map((dep) => (
                <div
                  key={`${dep.relationship}:${dep.target_id}`}
                  className="text-xs p-2 flex items-start justify-between gap-2"
                  style={{
                    backgroundColor: "var(--color-surface)",
                    border: "1px solid var(--color-border)",
                  }}
                >
                  <span>
                    <span style={{ color: "var(--color-text-muted)" }}>Depends on </span>
                    <span>{getRuneDisplay(dep.target_id).title}</span>
                    {getRuneDisplay(dep.target_id).hasDistinctTitle ? (
                      <span
                        className="ml-2 text-xs"
                        style={{ color: "var(--color-text-muted)" }}
                      >
                        {getRuneDisplay(dep.target_id).id}
                      </span>
                    ) : null}
                  </span>
                  <Button
                    onClick={() =>
                      requestRelationshipRemoval(dep.target_id, dep.relationship, "dependencies")
                    }
                    className="text-xs px-1 py-0 leading-none"
                    style={{
                      backgroundColor: "transparent",
                      border: "none",
                      color: "var(--color-text-muted)",
                    }}
                    title="Remove dependency"
                    aria-label={`Remove dependency ${dep.target_id}`}
                    disabled={isMutating}
                  >
                    <svg viewBox="0 0 24 24" width="12" height="12" fill="currentColor" aria-hidden="true">
                      <path d="M18.3 5.71a1 1 0 0 0-1.41 0L12 10.59 7.11 5.7a1 1 0 0 0-1.41 1.41L10.59 12 5.7 16.89a1 1 0 1 0 1.41 1.41L12 13.41l4.89 4.89a1 1 0 0 0 1.41-1.41L13.41 12l4.89-4.89a1 1 0 0 0 0-1.4z" />
                    </svg>
                  </Button>
                </div>
              ))
            ) : (
              <p className="text-sm italic" style={{ color: "var(--color-text-muted)" }}>
                No dependencies
              </p>
            )}
          </div>
        </div>

        <div
          className="p-6"
          style={{
            backgroundColor: "var(--color-bg)",
            border: "2px solid var(--color-border)",
            boxShadow: "var(--shadow-soft)",
          }}
        >
          <div className="flex items-center justify-between mb-4">
            <h2
              className="text-sm uppercase tracking-wider font-bold"
              style={{ color: "var(--color-text-muted)" }}
            >
              Dependents
            </h2>
            <Button
              onClick={() => openRelationshipDialog("dependents")}
              className="h-7 w-7 p-0 text-lg font-bold"
              style={{
                backgroundColor: "var(--color-amber)",
                border: "2px solid var(--color-border)",
                color: "white",
              }}
              disabled={isMutating}
            >
              +
            </Button>
          </div>
          <div className="space-y-2">
            {dependents.length > 0 ? (
              dependents.map((dep) => (
                <div
                  key={`${dep.relationship}:${dep.target_id}`}
                  className="text-xs p-2 flex items-start justify-between gap-2"
                  style={{
                    backgroundColor: "var(--color-surface)",
                    border: "1px solid var(--color-border)",
                  }}
                >
                  <span>
                    <span style={{ color: "var(--color-text-muted)" }}>Blocked by </span>
                    <span>{getRuneDisplay(dep.target_id).title}</span>
                    {getRuneDisplay(dep.target_id).hasDistinctTitle ? (
                      <span
                        className="ml-2 text-xs"
                        style={{ color: "var(--color-text-muted)" }}
                      >
                        {getRuneDisplay(dep.target_id).id}
                      </span>
                    ) : null}
                  </span>
                  <Button
                    onClick={() =>
                      requestRelationshipRemoval(dep.target_id, dep.relationship, "dependents")
                    }
                    className="text-xs px-1 py-0 leading-none"
                    style={{
                      backgroundColor: "transparent",
                      border: "none",
                      color: "var(--color-text-muted)",
                    }}
                    title="Remove dependent"
                    aria-label={`Remove dependent ${dep.target_id}`}
                    disabled={isMutating}
                  >
                    <svg viewBox="0 0 24 24" width="12" height="12" fill="currentColor" aria-hidden="true">
                      <path d="M18.3 5.71a1 1 0 0 0-1.41 0L12 10.59 7.11 5.7a1 1 0 0 0-1.41 1.41L10.59 12 5.7 16.89a1 1 0 1 0 1.41 1.41L12 13.41l4.89 4.89a1 1 0 0 0 1.41-1.41L13.41 12l4.89-4.89a1 1 0 0 0 0-1.4z" />
                    </svg>
                  </Button>
                </div>
              ))
            ) : (
              <p className="text-sm italic" style={{ color: "var(--color-text-muted)" }}>
                No dependents
              </p>
            )}
          </div>
        </div>
      </div>

      <Dialog
        open={showShatterDialog}
        onClose={() => setShowShatterDialog(false)}
        title="Shatter Rune"
        description={`Are you sure you want to shatter "${rune.title}"? This action cannot be undone.`}
        confirmLabel={isMutating ? "Shattering..." : "Shatter"}
        cancelLabel="Cancel"
        onConfirm={handleShatter}
        color="red"
      />

      <Dialog
        open={pendingRemoval !== null}
        onClose={closeRemoveDialog}
        title="Remove Relationship"
        description={
          pendingRemoval
            ? `Remove ${pendingRemoval.column === "dependencies" ? "dependency" : "dependent"} ${getRuneDisplay(pendingRemoval.targetId).title}${getRuneDisplay(pendingRemoval.targetId).hasDistinctTitle ? ` (${getRuneDisplay(pendingRemoval.targetId).id})` : ""}?`
            : "Remove relationship?"
        }
        confirmLabel={isMutating ? "Removing..." : "Remove"}
        cancelLabel="Cancel"
        onConfirm={handleRemoveRelationship}
        color="red"
      />

      <BaseDialog.Root
        open={showRelationDialog}
        onOpenChange={(nextOpen) => {
          if (nextOpen) {
            void loadRuneOptions();
          }
          if (!nextOpen) {
            closeRelationshipDialog();
          }
        }}
      >
        <BaseDialog.Portal>
          <BaseDialog.Backdrop className="fixed inset-0 z-50 bg-black/50 backdrop-blur-sm" />
          <BaseDialog.Viewport className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <BaseDialog.Popup
              className="w-full max-w-xl p-6"
              style={{
                backgroundColor: "var(--color-bg)",
                border: "2px solid var(--color-border)",
                boxShadow: "var(--shadow-soft)",
              }}
              aria-labelledby="relationship-dialog-title"
              aria-describedby="relationship-dialog-description"
            >
              <div className="space-y-4">
                <div>
                  <BaseDialog.Title
                    id="relationship-dialog-title"
                    className="text-xl font-bold uppercase tracking-tight"
                    style={{ color: "var(--color-amber)" }}
                  >
                    Add {relationshipColumn === "dependencies" ? "Dependency" : "Dependent"}
                  </BaseDialog.Title>
                  <BaseDialog.Description
                    id="relationship-dialog-description"
                    className="text-sm mt-1"
                    style={{ color: "var(--color-text-muted)" }}
                  >
                    Select a rune from this realm.
                  </BaseDialog.Description>
                </div>

                <div>
                  <label
                    htmlFor="rune-relationship-selector"
                    className="text-xs uppercase tracking-wider block mb-2 font-bold"
                    style={{ color: "var(--color-text-muted)" }}
                  >
                    Rune
                  </label>
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
                      id="rune-relationship-selector"
                      placeholder="Search by rune ID or title"
                      className="w-full px-3 py-2 text-sm outline-none"
                      style={{
                        backgroundColor: "var(--color-surface)",
                        border: "2px solid var(--color-border)",
                        color: "var(--color-text)",
                      }}
                    />
                    <Combobox.Portal>
                      <Combobox.Positioner sideOffset={8} align="start">
                        <Combobox.Popup
                          className="z-[80] max-h-64 overflow-y-auto"
                          style={{
                            backgroundColor: "var(--color-bg)",
                            border: "2px solid var(--color-border)",
                            boxShadow: "var(--shadow-soft)",
                            width: "var(--anchor-width)",
                          }}
                        >
                          <Combobox.List>
                            {filteredRuneOptions.map((candidate) => (
                              <Combobox.Item
                                key={candidate.id}
                                value={candidate.id}
                                className="px-3 py-2 text-sm cursor-pointer"
                                style={{ color: "var(--color-text)" }}
                              >
                                {candidate.title}
                                <span
                                  className="ml-2 text-xs"
                                  style={{ color: "var(--color-text-muted)" }}
                                >
                                  {candidate.id}
                                </span>
                              </Combobox.Item>
                            ))}
                          </Combobox.List>
                          <Combobox.Empty
                            className="px-3 py-2 text-sm"
                            style={{ color: "var(--color-text-muted)" }}
                          >
                            No runes found
                          </Combobox.Empty>
                        </Combobox.Popup>
                      </Combobox.Positioner>
                    </Combobox.Portal>
                  </Combobox.Root>
                </div>

                <div className="flex justify-end gap-3 pt-2">
                  <BaseDialog.Close
                    className="px-4 py-2 text-sm font-semibold"
                    style={{
                      backgroundColor: "var(--color-bg)",
                      border: "2px solid var(--color-border)",
                      color: "var(--color-text)",
                    }}
                  >
                    Cancel
                  </BaseDialog.Close>
                  <Button
                    onClick={handleAddRelationship}
                    disabled={!relationshipTargetId || isMutating}
                    className="px-4 py-2 text-sm font-semibold disabled:opacity-50 disabled:cursor-not-allowed"
                    style={{
                      backgroundColor: "var(--color-amber)",
                      border: "2px solid var(--color-border)",
                      color: "white",
                    }}
                  >
                    {isMutating ? "Adding..." : "Add"}
                  </Button>
                </div>
              </div>
            </BaseDialog.Popup>
          </BaseDialog.Viewport>
        </BaseDialog.Portal>
      </BaseDialog.Root>
    </div>
  );
}
