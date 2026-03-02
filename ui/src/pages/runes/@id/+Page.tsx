"use client";

import { useCallback, useEffect, useState } from "react";
import { Button } from "@base-ui/react/button";
import { Input } from "@base-ui/react/input";
import { navigate } from "@/lib/router";
import { usePageContext } from "vike-react/usePageContext";
import { useAuth } from "../../../lib/auth";
import { useRealm } from "../../../lib/realm";
import { useToast } from "../../../lib/toast";
import { api } from "../../../lib/api";
import { Dialog } from "../../../components/Dialog/Dialog";
import type { RuneDetail, RuneStatus } from "../../../types/rune";

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
    isSysadmin,
    accountId,
    isAuthenticated,
    loading: authLoading,
  } = useAuth();
  const { currentRealm, availableRealms, isLoading: realmLoading } = useRealm();
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
  const [isMutating, setIsMutating] = useState(false);
  const [assignTarget, setAssignTarget] = useState("");
  const [sealReason, setSealReason] = useState("");

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

  useEffect(() => {
    if (authLoading || realmLoading) return;

    if (!isAuthenticated) {
      navigate("/login");
      return;
    }

    void loadRune();
  }, [authLoading, isAuthenticated, loadRune, realmLoading]);

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

  const formatRelationship = (relationship: string, targetId: string) => {
    switch (relationship) {
      case "blocks":
        return `This rune blocks ${targetId}.`;
      case "blocked_by":
        return `This rune is blocked by ${targetId}.`;
      case "duplicates":
        return `This rune duplicates ${targetId}.`;
      case "duplicated_by":
        return `${targetId} duplicates this rune.`;
      case "supersedes":
        return `This rune supersedes ${targetId}.`;
      case "superseded_by":
        return `${targetId} supersedes this rune.`;
      case "replies_to":
        return `This rune replies to ${targetId}.`;
      case "replied_to_by":
        return `${targetId} replies to this rune.`;
      case "relates_to":
      default:
        return `This rune relates to ${targetId}.`;
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

  return (
    <div className="min-h-[calc(100vh-56px)] p-6">
      {/* Header */}
      <div className="mb-8">
        <Button
          onClick={() => navigate("/runes")}
          className="inline-flex items-center gap-2 text-sm font-bold uppercase tracking-wider mb-4 transition-all duration-150 hover:translate-x-[-2px]"
          style={{ color: "var(--color-text-muted)" }}
        >
          <span>&larr;</span>
          <span>Back to Runes</span>
        </Button>
        <h1
          className="text-4xl font-bold tracking-tight uppercase"
          style={{ color: "var(--color-amber)" }}
        >
          {rune.title}
        </h1>
        <div className="flex items-center gap-4 mt-3">
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
          <span
            className="text-xs uppercase tracking-wider"
            style={{ color: "var(--color-text-muted)" }}
          >
            ID: {rune.id}
          </span>
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
          <h2
            className="text-sm uppercase tracking-wider font-bold mb-4"
            style={{ color: "var(--color-text-muted)" }}
          >
            Description
          </h2>
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
            <h2
              className="text-sm uppercase tracking-wider font-bold mb-4"
              style={{ color: "var(--color-text-muted)" }}
            >
              Details
            </h2>
            <div className="space-y-4">
              <div>
                <div
                  className="text-xs uppercase tracking-wider block mb-1"
                  style={{ color: "var(--color-text-muted)" }}
                >
                  Status
                </div>
                <span
                  className="text-xs uppercase tracking-wider px-2 py-1 font-bold"
                  style={{
                    backgroundColor: statusStyle.bg,
                    border: `1px solid ${statusStyle.border}`,
                    color: statusStyle.text,
                  }}
                >
                  {rune.status.replace("_", " ")}
                </span>
              </div>

              <div>
                <div
                  className="text-xs uppercase tracking-wider block mb-1"
                  style={{ color: "var(--color-text-muted)" }}
                >
                  Priority
                </div>
                <span className="text-sm font-bold">{rune.priority}</span>
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

          {rune.dependencies.length > 0 && (
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
                Relationships
              </h2>
              <div className="space-y-2">
                {rune.dependencies.map((dep) => (
                  <div
                    key={`${dep.relationship}:${dep.target_id}`}
                    className="text-xs p-2"
                    style={{
                      backgroundColor: "var(--color-surface)",
                      border: "1px solid var(--color-border)",
                    }}
                  >
                    {formatRelationship(dep.relationship, dep.target_id)}
                  </div>
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
            <h2
              className="text-sm uppercase tracking-wider font-bold mb-4"
              style={{ color: "var(--color-text-muted)" }}
            >
              Actions
            </h2>
            <div className="space-y-3">
              <Button
                onClick={() => navigate(`/runes/${rune.id}/edit`)}
                className="w-full px-4 py-3 text-sm font-bold uppercase tracking-wider transition-all duration-150"
                style={{
                  backgroundColor: "var(--color-amber)",
                  border: "2px solid var(--color-border)",
                  color: "white",
                  boxShadow: "var(--shadow-soft)",
                }}
                disabled={isMutating}
              >
                Edit Rune
              </Button>

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
    </div>
  );
}
