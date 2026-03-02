"use client";

import { useEffect, useState } from "react";
import { Button } from "@base-ui/react/button";
import { Toggle } from "@base-ui/react/toggle";
import { ToggleGroup } from "@base-ui/react/toggle-group";
import { navigate } from "@/lib/router";
import { useAuth } from "../../lib/auth";
import { useRealm } from "../../lib/realm";
import { useToast } from "../../lib/toast";
import { ApiError, api } from "../../lib/api";
import { RealmSelector } from "../../components/RealmSelector/RealmSelector";
import type { RuneListItem, RuneStatus } from "../../types/rune";
export { Page };

const STATUS_FILTERS: { label: string; value: RuneStatus | "all" }[] = [
  { label: "All", value: "all" },
  { label: "Draft", value: "draft" },
  { label: "Open", value: "open" },
  { label: "In Progress", value: "in_progress" },
  { label: "Fulfilled", value: "fulfilled" },
  { label: "Sealed", value: "sealed" },
];

function Page() {
  const [runes, setRunes] = useState<RuneListItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState<RuneStatus | "all">("all");
  const { realms, isAuthenticated, loading: authLoading } = useAuth();
  const { currentRealm, availableRealms, isLoading: realmLoading } = useRealm();
  const { showToast } = useToast();
  const fallbackRealms = realms.filter((realmId) => realmId !== "_admin");
  const effectiveRealms = availableRealms.length > 0 ? availableRealms : fallbackRealms;
  const effectiveRealm =
    currentRealm && effectiveRealms.includes(currentRealm)
      ? currentRealm
      : (effectiveRealms[0] ?? null);

  useEffect(() => {
    if (authLoading) return;

    if (!isAuthenticated) {
      navigate("/login");
      return;
    }

    const fetchRunes = async () => {
      if (realmLoading) {
        return;
      }

      if (!effectiveRealm) {
        setRunes([]);
        setIsLoading(false);
        return;
      }

      try {
        setIsLoading(true);
        const data = await api.getRunes(effectiveRealm);
        setRunes(data);
      } catch (error) {
        if (error instanceof ApiError && error.status === 404) {
          setRunes([]);
        } else {
          showToast("Error", "Failed to load runes", "error");
        }
      } finally {
        setIsLoading(false);
      }
    };

    fetchRunes();
  }, [authLoading, effectiveRealm, isAuthenticated, realmLoading, showToast]);

  const filteredRunes =
    statusFilter === "all"
      ? runes
      : runes.filter((r) => r.status === statusFilter);

  const formatDate = (dateStr: string) => {
    const date = new Date(dateStr);
    return date.toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
      year: "numeric",
    });
  };

  const getStatusColor = (status: string) => {
    if (status === "claimed") {
      return "var(--color-amber)";
    }
    const colors: Record<RuneStatus, string> = {
      draft: "var(--color-border)",
      open: "var(--color-blue)",
      in_progress: "var(--color-amber)",
      fulfilled: "var(--color-green)",
      sealed: "var(--color-purple)",
    };
    return colors[status as RuneStatus] ?? "var(--color-border)";
  };

  const getPriorityBadge = (priority: number) => {
    if (priority >= 4) {
      return { label: "P1", color: "var(--color-red)" };
    } else if (priority >= 3) {
      return { label: "P2", color: "var(--color-amber)" };
    } else if (priority >= 2) {
      return { label: "P3", color: "var(--color-blue)" };
    }
    return { label: "P4", color: "var(--color-text-muted)" };
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

  if (effectiveRealms.length === 0) {
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
            No Realms Found
          </h2>
          <p className="text-sm mb-6" style={{ color: "var(--color-text-muted)" }}>
            You don't have access to any realms yet. Contact your administrator.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-[calc(100vh-56px)] p-6">
      {/* Filter Tabs and Actions */}
      <div className="flex justify-between items-center mb-6">
        <ToggleGroup
          value={[statusFilter]}
          onValueChange={(values) => {
            const nextFilter = values[0];
            if (nextFilter) {
              setStatusFilter(nextFilter as RuneStatus | "all");
            }
          }}
          className="flex flex-wrap gap-2"
        >
          {STATUS_FILTERS.map((filter) => (
            <Toggle
              key={filter.value}
              value={filter.value}
              className="px-4 py-2 text-xs font-bold uppercase tracking-wider transition-all duration-150"
              style={{
                backgroundColor:
                  statusFilter === filter.value
                    ? "var(--color-amber)"
                    : "var(--color-bg)",
                border: "2px solid var(--color-border)",
                color:
                  statusFilter === filter.value ? "white" : "var(--color-text)",
                boxShadow: "var(--shadow-soft)",
              }}
            >
              {filter.label}
            </Toggle>
          ))}
        </ToggleGroup>
        <div className="flex items-center gap-3">
          <RealmSelector />
          <Button
            onClick={() => navigate("/runes/new")}
            className="px-3 py-2 text-xs font-bold uppercase tracking-wider transition-all duration-150"
            style={{
              backgroundColor: "var(--color-bg)",
              border: "2px solid var(--color-border)",
              color: "var(--color-text)",
              boxShadow: "var(--shadow-soft)",
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.backgroundColor = "var(--color-amber)";
              e.currentTarget.style.color = "white";
              e.currentTarget.style.boxShadow = "var(--shadow-soft-hover)";
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.backgroundColor = "var(--color-bg)";
              e.currentTarget.style.color = "var(--color-text)";
              e.currentTarget.style.boxShadow = "var(--shadow-soft)";
            }}
          >
            +
          </Button>
        </div>
      </div>



      {/* Runes Table */}
      <div
        style={{
          backgroundColor: "var(--color-bg)",
          border: "2px solid var(--color-border)",
            boxShadow: "var(--shadow-soft)",
        }}
      >
        {/* Table Header */}
        <div
          className="grid grid-cols-16 gap-4 px-4 py-3 text-xs font-bold uppercase tracking-wider"
          style={{
            borderBottom: "2px solid var(--color-border)",
            backgroundColor: "var(--color-surface)",
          }}
        >
          <div className="col-span-1">ID</div>
          <div className="col-span-4">Title</div>
          <div className="col-span-2">Status</div>
          <div className="col-span-3">Claimed By</div>
          <div className="col-span-2">Dependencies</div>
          <div className="col-span-2">Dependents</div>
          <div className="col-span-1">Priority</div>
          <div className="col-span-1">Created</div>
        </div>

        {/* Table Body */}
        {filteredRunes.length === 0 ? (
          <div
            className="px-4 py-12 text-center text-sm uppercase tracking-wider"
            style={{ color: "var(--color-text-muted)" }}
          >
            No runes found. Create your first rune to get started.
          </div>
        ) : (
          <div>
            {filteredRunes.map((rune) => {
              const priorityBadge = getPriorityBadge(rune.priority);
              return (
                <button
                  type="button"
                  key={rune.id}
                  className="grid grid-cols-16 gap-4 px-4 py-4 items-center cursor-pointer transition-all duration-150 hover:translate-x-[2px]"
                  style={{
                    borderBottom: "1px solid var(--color-border)",
                    backgroundColor: "var(--color-bg)",
                    width: "100%",
                    textAlign: "left",
                  }}
                  onClick={() => navigate(`/runes/${rune.id}`)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" || e.key === " ") {
                      e.preventDefault();
                      navigate(`/runes/${rune.id}`);
                    }
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.backgroundColor = "var(--color-surface)";
                    e.currentTarget.style.borderLeftWidth = "4px";
                    e.currentTarget.style.borderLeftColor = "var(--color-amber)";
                    e.currentTarget.style.borderLeftStyle = "solid";
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.backgroundColor = "var(--color-bg)";
                    e.currentTarget.style.borderLeftWidth = "0px";
                  }}
                >
                  <div className="col-span-1">
                    <span
                      className="text-xs font-mono"
                      style={{ color: "var(--color-text-muted)" }}
                    >
                      {rune.id.slice(0, 8)}
                    </span>
                  </div>
                  <div className="col-span-4">
                    <span className="font-medium truncate block">
                      {rune.title}
                    </span>
                  </div>
                  <div className="col-span-2">
                    <span
                      className="text-xs uppercase tracking-wider px-2 py-1 font-semibold"
                      style={{
                        color: getStatusColor(rune.status),
                        border: `1px solid ${getStatusColor(rune.status)}`,
                      }}
                    >
                      {rune.status.replace("_", " ")}
                    </span>
                  </div>
                  <div className="col-span-3">
                    <span className="text-xs font-mono" style={{ color: "var(--color-text-muted)" }}>
                      {(() => {
                        const claimant = rune.claimant_username || rune.claimant || "";
                        return claimant && claimant !== "<nil>" ? claimant : "-";
                      })()}
                    </span>
                  </div>
                  <div className="col-span-2">
                    <span className="text-xs font-semibold" style={{ color: "var(--color-text)" }}>
                      {rune.dependencies_count ?? 0}
                    </span>
                  </div>
                  <div className="col-span-2">
                    <span className="text-xs font-semibold" style={{ color: "var(--color-text)" }}>
                      {rune.dependents_count ?? 0}
                    </span>
                  </div>
                  <div className="col-span-1">
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
                  <div className="col-span-1">
                    <span
                      className="text-xs"
                      style={{ color: "var(--color-text-muted)" }}
                    >
                      {formatDate(rune.created_at)}
                    </span>
                  </div>
                </button>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
