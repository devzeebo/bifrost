"use client";

import { useEffect, useState } from "react";
import { Button } from "@base-ui/react/button";
import { navigate } from "@/lib/router";
import { useAuth } from "../../lib/auth";
import { useRealm } from "../../lib/realm";
import { useToast } from "../../lib/toast";
import { ApiError, api } from "../../lib/api";
import type { RuneListItem, RuneStatus } from "../../types/rune";

export { Page };

interface StatCard {
  label: string;
  value: number;
  color: string;
}

function Page() {
  const [runes, setRunes] = useState<RuneListItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);
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
        setIsLoading(false);
        return;
      }

      try {
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

  const stats: StatCard[] = [
    {
      label: "Total Runes",
      value: runes.length,
      color: "var(--color-red)",
    },
    {
      label: "Open",
      value: runes.filter((r) => r.status === "open").length,
      color: "var(--color-blue)",
    },
    {
      label: "In Progress",
      value: runes.filter((r) => r.status === "in_progress").length,
      color: "var(--color-amber)",
    },
    {
      label: "Fulfilled",
      value: runes.filter((r) => r.status === "fulfilled").length,
      color: "var(--color-green)",
    },
    {
      label: "Sealed",
      value: runes.filter((r) => r.status === "sealed").length,
      color: "var(--color-text-muted)",
    },
  ];

  const recentRunes = [...runes]
    .sort((a, b) => new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime())
    .slice(0, 10);

  const formatDate = (dateStr: string) => {
    const date = new Date(dateStr);
    return date.toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
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
      {/* Stats Grid */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-4 mb-8">
        {stats.map((stat) => (
          <div
            key={stat.label}
            className="p-6 transition-all duration-150 hover:translate-x-[2px] hover:translate-y-[2px]"
            style={{
              backgroundColor: "var(--color-bg)",
              border: "2px solid var(--color-border)",
            boxShadow: "var(--shadow-soft)",
            }}
          >
            <div
              className="text-4xl font-bold mb-2"
              style={{ color: stat.color }}
            >
              {stat.value}
            </div>
            <div
              className="text-xs uppercase tracking-wider font-semibold"
              style={{ color: "var(--color-text-muted)" }}
            >
              {stat.label}
            </div>
          </div>
        ))}
      </div>

      {/* Recent Activity */}
      <div
        className="p-6"
        style={{
          backgroundColor: "var(--color-bg)",
          border: "2px solid var(--color-border)",
            boxShadow: "var(--shadow-soft)",
        }}
      >
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-xl font-bold uppercase tracking-wide">
            Recent Activity
          </h2>
          <Button
            onClick={() => navigate("/runes")}
            className="px-4 py-2 text-xs font-bold uppercase tracking-wider transition-all duration-150"
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
            View All Runes
          </Button>
        </div>

        {recentRunes.length === 0 ? (
          <p
            className="text-center py-8 text-sm uppercase tracking-wider"
            style={{ color: "var(--color-text-muted)" }}
          >
            No runes yet. Create your first rune to get started.
          </p>
        ) : (
          <div className="space-y-2">
            {recentRunes.map((rune) => (
              <button
                type="button"
                key={rune.id}
                className="flex items-center justify-between p-4 transition-all duration-150 cursor-pointer hover:translate-x-[2px]"
                style={{
                  backgroundColor: "var(--color-bg)",
                  border: "1px solid var(--color-border)",
                  width: "100%",
                  textAlign: "left",
                }}
                onClick={() => navigate(`/runes/${rune.id}`)}
                onMouseEnter={(e) => {
                  e.currentTarget.style.borderColor = "var(--color-red)";
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.borderColor = "var(--color-border)";
                }}
              >
                <div className="flex items-center gap-4">
                  <div
                    className="w-2 h-2"
                    style={{ backgroundColor: getStatusColor(rune.status) }}
                  />
                  <span className="font-medium truncate max-w-[300px]">
                    {rune.title}
                  </span>
                </div>
                <div className="flex items-center gap-4">
                  <span
                    className="text-xs uppercase tracking-wider px-2 py-1"
                    style={{
                      color: getStatusColor(rune.status),
                      border: `1px solid ${getStatusColor(rune.status)}`,
                    }}
                  >
                    {rune.status.replace("_", " ")}
                  </span>
                  <span
                    className="text-xs"
                    style={{ color: "var(--color-text-muted)" }}
                  >
                    {formatDate(rune.updated_at)}
                  </span>
                </div>
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
