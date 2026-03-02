"use client";

import { useEffect, useState } from "react";
import { Button } from "@base-ui/react/button";
import { navigate } from "@/lib/router";
import { usePageContext } from "vike-react/usePageContext";
import { useAuth } from "../../../lib/auth";
import { useToast } from "../../../lib/toast";
import { api } from "../../../lib/api";
import { Dialog } from "../../../components/Dialog/Dialog";
import type { RealmDetail, RealmStatus } from "../../../types/realm";
import type { RuneListItem, RuneStatus } from "../../../types/rune";

export { Page };

const realmStatusColors: Record<RealmStatus, { bg: string; border: string; text: string }> = {
  active: {
    bg: "var(--color-green)",
    border: "var(--color-border)",
    text: "white",
  },
  archived: {
    bg: "var(--color-border)",
    border: "var(--color-border)",
    text: "white",
  },
};

const runeStatusColors: Record<RuneStatus, { bg: string; border: string; text: string }> = {
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
  const routeParams = pageContext.routeParams as Record<string, string | undefined>;
  const realmId = routeParams?.id ?? routeParams?.["@id"] ?? routeParams?.["-id"] ?? "";
  const {
    isAuthenticated,
    realms: sessionRealmIds,
    realmNames,
    loading: authLoading,
  } = useAuth();
  const { showToast } = useToast();

  const [realm, setRealm] = useState<RealmDetail | null>(null);
  const [runes, setRunes] = useState<RuneListItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);

  const normalizeRealmDetail = (rawData: unknown): RealmDetail | null => {
    if (!rawData || typeof rawData !== "object") {
      return null;
    }

    const rawRealm = rawData as {
      id?: string;
      realm_id?: string;
      name?: string;
      status?: string;
      created_at?: string;
      description?: string;
      owner_id?: string;
      member_count?: number;
      members?: unknown[];
    };

    const id = rawRealm.id ?? rawRealm.realm_id;
    if (!id) {
      return null;
    }

    const memberCount =
      typeof rawRealm.member_count === "number"
        ? rawRealm.member_count
        : Array.isArray(rawRealm.members)
          ? rawRealm.members.length
          : 0;

    return {
      id,
      name: rawRealm.name ?? realmNames[id] ?? id,
      status: rawRealm.status === "suspended" ? "archived" : "active",
      created_at: rawRealm.created_at ?? new Date(0).toISOString(),
      description: rawRealm.description ?? "",
      owner_id: rawRealm.owner_id ?? "",
      member_count: memberCount,
    };
  };

  const toFallbackRealm = (targetRealmId: string): RealmDetail | null => {
    if (!targetRealmId || !sessionRealmIds.includes(targetRealmId)) {
      return null;
    }

    return {
      id: targetRealmId,
      name: realmNames[targetRealmId] ?? targetRealmId,
      status: "active",
      created_at: new Date(0).toISOString(),
      description: "",
      owner_id: "",
      member_count: 0,
    };
  };

  useEffect(() => {
    if (authLoading) return;

    if (!isAuthenticated) {
      navigate("/login");
      return;
    }

    if (!realmId) {
      setIsLoading(false);
      return;
    }

    const fetchData = async () => {
      try {
        const [realmData, runesData] = await Promise.all([api.getRealm(realmId), api.getRunes(realmId)]);
        const normalizedRealm = normalizeRealmDetail(realmData) ?? toFallbackRealm(realmId);
        setRealm(normalizedRealm);
        setRunes(runesData);
      } catch (error) {
        const fallbackRealm = toFallbackRealm(realmId);
        setRealm(fallbackRealm);
        if (!fallbackRealm) {
          showToast("Error", "Failed to load realm", "error");
        }
      } finally {
        setIsLoading(false);
      }
    };

    fetchData();
  }, [authLoading, isAuthenticated, realmId, sessionRealmIds, realmNames, showToast]);

  const handleDelete = async () => {
    if (!realm) return;

    setIsDeleting(true);
    try {
      // Note: deleteRealm API not yet implemented
      showToast(
        "Not Implemented",
        "Realm deletion is not yet available",
        "error"
      );
      setShowDeleteDialog(false);
    } catch (error) {
      showToast("Error", "Failed to delete realm", "error");
    } finally {
      setIsDeleting(false);
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

  const formatShortDate = (dateStr: string) => {
    const date = new Date(dateStr);
    return date.toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
      year: "numeric",
    });
  };

  if (authLoading || isLoading) {
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

  if (!realm) {
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
            Realm Not Found
          </h2>
          <p className="text-sm mb-6" style={{ color: "var(--color-text-muted)" }}>
            The realm you're looking for doesn't exist or you don't have access to it.
          </p>
          <Button
            onClick={() => navigate("/realms")}
            className="px-6 py-3 text-sm font-bold uppercase tracking-wider transition-all duration-150"
            style={{
              backgroundColor: "var(--color-green)",
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
            Back to Realms
          </Button>
        </div>
      </div>
    );
  }

  const statusStyle = realmStatusColors[realm.status];

  return (
    <div className="min-h-[calc(100vh-56px)] p-6">
      {/* Header */}
      <div className="mb-8">
        <Button
          onClick={() => navigate("/realms")}
          className="inline-flex items-center gap-2 text-sm font-bold uppercase tracking-wider mb-4 transition-all duration-150 hover:translate-x-[-2px]"
          style={{ color: "var(--color-text-muted)" }}
        >
          <span>&larr;</span>
          <span>Back to Realms</span>
        </Button>
        <h1
          className="text-4xl font-bold tracking-tight uppercase"
          style={{ color: "var(--color-green)" }}
        >
          {realm.name}
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
            {realm.status}
          </span>
          <span
            className="text-xs uppercase tracking-wider"
            style={{ color: "var(--color-text-muted)" }}
          >
            ID: {realm.id}
          </span>
          <span
            className="text-xs uppercase tracking-wider"
            style={{ color: "var(--color-text-muted)" }}
          >
            {realm.member_count} member{realm.member_count !== 1 ? "s" : ""}
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
          {realm.description ? (
            <p className="text-base leading-relaxed whitespace-pre-wrap">
              {realm.description}
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
                <label
                  className="text-xs uppercase tracking-wider block mb-1"
                  style={{ color: "var(--color-text-muted)" }}
                >
                  Status
                </label>
                <span
                  className="text-xs uppercase tracking-wider px-2 py-1 font-bold"
                  style={{
                    backgroundColor: statusStyle.bg,
                    border: `1px solid ${statusStyle.border}`,
                    color: statusStyle.text,
                  }}
                >
                  {realm.status}
                </span>
              </div>

              <div>
                <label
                  className="text-xs uppercase tracking-wider block mb-1"
                  style={{ color: "var(--color-text-muted)" }}
                >
                  Owner ID
                </label>
                <span className="text-sm font-mono">{realm.owner_id}</span>
              </div>

              <div>
                <label
                  className="text-xs uppercase tracking-wider block mb-1"
                  style={{ color: "var(--color-text-muted)" }}
                >
                  Created
                </label>
                <span className="text-sm">{formatDate(realm.created_at)}</span>
              </div>

              <div>
                <label
                  className="text-xs uppercase tracking-wider block mb-1"
                  style={{ color: "var(--color-text-muted)" }}
                >
                  Members
                </label>
                <span className="text-sm font-bold">{realm.member_count}</span>
              </div>
            </div>
          </div>

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
                onClick={() => navigate(`/realms/${realm.id}/edit`)}
                className="w-full px-4 py-3 text-sm font-bold uppercase tracking-wider transition-all duration-150"
                style={{
                  backgroundColor: "var(--color-green)",
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
                Edit Realm
              </Button>
              <Button
                onClick={() => setShowDeleteDialog(true)}
                className="w-full px-4 py-3 text-sm font-bold uppercase tracking-wider transition-all duration-150"
                style={{
                  backgroundColor: "var(--color-red)",
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
                Delete Realm
              </Button>
            </div>
          </div>
        </div>
      </div>

      {/* Runes Section */}
      <div className="mt-8">
        <div className="flex items-center justify-between mb-4">
          <h2
            className="text-2xl font-bold uppercase tracking-tight"
            style={{ color: "var(--color-green)" }}
          >
            Runes
          </h2>
          <span
            className="text-sm uppercase tracking-widest"
            style={{ color: "var(--color-text-muted)" }}
          >
            {runes.length} rune{runes.length !== 1 ? "s" : ""}
          </span>
        </div>

        {runes.length === 0 ? (
          <div
            className="p-8 text-center"
            style={{
              backgroundColor: "var(--color-bg)",
              border: "2px solid var(--color-border)",
            boxShadow: "var(--shadow-soft)",
            }}
          >
            <p
              className="text-sm"
              style={{ color: "var(--color-text-muted)" }}
            >
              No runes in this realm yet.
            </p>
          </div>
        ) : (
          <div
            style={{
              backgroundColor: "var(--color-bg)",
              border: "2px solid var(--color-border)",
            boxShadow: "var(--shadow-soft)",
            }}
          >
            {/* Table Header */}
            <div
              className="grid grid-cols-12 gap-4 px-4 py-3 text-xs font-bold uppercase tracking-wider"
              style={{
                borderBottom: "2px solid var(--color-border)",
                backgroundColor: "var(--color-surface)",
              }}
            >
              <div className="col-span-2">ID</div>
              <div className="col-span-5">Title</div>
              <div className="col-span-2">Status</div>
              <div className="col-span-1">Priority</div>
              <div className="col-span-2">Created</div>
            </div>

            {/* Table Body */}
            <div>
              {runes.map((rune) => {
                const runeStyle = runeStatusColors[rune.status];
                return (
                  <div
                    key={rune.id}
                    className="grid grid-cols-12 gap-4 px-4 py-4 items-center cursor-pointer transition-all duration-150 hover:translate-x-[2px]"
                    style={{
                      borderBottom: "1px solid var(--color-border)",
                      backgroundColor: "var(--color-bg)",
                    }}
                    onClick={() => navigate(`/runes/${rune.id}`)}
                    onMouseEnter={(e) => {
                      e.currentTarget.style.backgroundColor = "var(--color-surface)";
                      e.currentTarget.style.borderLeftWidth = "4px";
                      e.currentTarget.style.borderLeftColor = "var(--color-green)";
                      e.currentTarget.style.borderLeftStyle = "solid";
                    }}
                    onMouseLeave={(e) => {
                      e.currentTarget.style.backgroundColor = "var(--color-bg)";
                      e.currentTarget.style.borderLeftWidth = "0px";
                    }}
                  >
                    <div className="col-span-2">
                      <span
                        className="text-xs font-mono"
                        style={{ color: "var(--color-text-muted)" }}
                      >
                        {rune.id.slice(0, 8)}
                      </span>
                    </div>
                    <div className="col-span-5">
                      <span className="font-medium truncate block">
                        {rune.title}
                      </span>
                    </div>
                    <div className="col-span-2">
                      <span
                        className="text-xs uppercase tracking-wider px-2 py-1 font-semibold"
                        style={{
                          backgroundColor: runeStyle.bg,
                          border: `1px solid ${runeStyle.border}`,
                          color: runeStyle.text,
                        }}
                      >
                        {rune.status.replace("_", " ")}
                      </span>
                    </div>
                    <div className="col-span-1">
                      <span className="text-sm font-bold">{rune.priority}</span>
                    </div>
                    <div className="col-span-2">
                      <span
                        className="text-xs"
                        style={{ color: "var(--color-text-muted)" }}
                      >
                        {formatShortDate(rune.created_at)}
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </div>

      {/* Delete Confirmation Dialog */}
      <Dialog
        open={showDeleteDialog}
        onClose={() => setShowDeleteDialog(false)}
        title="Delete Realm"
        description={`Are you sure you want to delete "${realm.name}"? This will also delete all runes in this realm. This action cannot be undone.`}
        confirmLabel={isDeleting ? "Deleting..." : "Delete"}
        cancelLabel="Cancel"
        onConfirm={handleDelete}
        color="red"
      />
    </div>
  );
}
