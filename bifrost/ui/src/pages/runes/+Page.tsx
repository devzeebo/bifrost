"use client";

import { useEffect, useState } from "react";
import { Button } from "@base-ui/react/button";
import { Toggle } from "@base-ui/react/toggle";
import { ToggleGroup } from "@base-ui/react/toggle-group";
import { navigate } from "@/lib/router";
import { useAuth } from "../../lib/auth";
import { useRealm } from "../../lib/realm";
import { useToast } from "../../lib/toast";
import { api } from "../../lib/api";
import { RealmSelector } from "../../components/RealmSelector/RealmSelector";
import type { RuneListItem, RuneStatus } from "../../types/rune";

const ACTIVE_STATUSES: RuneStatus[] = ["draft", "open", "in_progress"];

const STATUS_FILTERS: { label: string; value: RuneStatus | "all" | "active" }[] = [
  { label: "Active", value: "active" },
  { label: "All", value: "all" },
];

const RunesList = ({
  isLoading,
  filteredRunes,
  onRuneClick,
}: {
  isLoading: boolean;
  filteredRunes: RuneListItem[];
  onRuneClick: (runeId: string) => void;
}) => {
  if (isLoading) {
    return (
      <div className="text-center py-8">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500 mx-auto mb-4" />
        <p>Loading runes...</p>
      </div>
    );
  }

  if (filteredRunes.length === 0) {
    return (
      <div className="text-center py-8">
        <p>No runes found.</p>
      </div>
    );
  }

  return (
    <div className="border border-gray-200 dark:border-gray-700 rounded-lg overflow-hidden">
      <div
        className="grid grid-cols-12 gap-4 p-4 text-xs font-bold text-gray-600 dark:text-gray-400 uppercase tracking-wider"
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
      </div>

      <div className="divide-y divide-gray-200 dark:divide-gray-700">
        {filteredRunes.map((rune) => {
          const statusColor = (() => {
            if (rune.status === "draft") {
              return "var(--color-gray)";
            }
            if (rune.status === "open") {
              return "var(--color-blue)";
            }
            if (rune.status === "in_progress") {
              return "var(--color-amber)";
            }
            return "var(--color-gray)";
          })();

          const dependenciesContent = (() => {
            if (rune.dependencies && rune.dependencies.length > 0) {
              return (
                <div className="flex flex-wrap gap-1">
                  {rune.dependencies.slice(0, 2).map((dep) => (
                    <span
                      key={dep.target_id}
                      className="px-2 py-1 text-xs bg-gray-100 dark:bg-gray-700 rounded"
                      title={dep.target_id}
                    >
                      {dep.target_id.slice(0, 6)}
                    </span>
                  ))}
                  {rune.dependencies.length > 2 && (
                    <span className="px-2 py-1 text-xs bg-gray-100 dark:bg-gray-700 rounded">
                      +{rune.dependencies.length - 2}
                    </span>
                  )}
                </div>
              );
            }
            return <span className="text-gray-400">None</span>;
          })();

          return (
            <div
              key={rune.id}
              className="grid grid-cols-12 gap-4 p-4 hover:bg-gray-50 dark:hover:bg-gray-700/50 cursor-pointer transition-colors"
              onClick={() => onRuneClick(rune.id)}
              style={{
                backgroundColor: "var(--color-bg)",
              }}
            >
              <div className="col-span-1 font-mono text-sm">{rune.id.slice(0, 8)}</div>
              <div className="col-span-4 font-medium">{rune.title}</div>
              <div className="col-span-2">
                <span
                  className="px-2 py-1 text-xs rounded-full font-medium"
                  style={{
                    backgroundColor: statusColor,
                    color: "white",
                  }}
                >
                  {rune.status}
                </span>
              </div>
              <div className="col-span-3 text-sm text-gray-600 dark:text-gray-400">
                {rune.claimant_username || "-"}
              </div>
              <div className="col-span-2">{dependenciesContent}</div>
            </div>
          );
        })}
      </div>
    </div>
  );
};

const Page = () => {
  const [runes, setRunes] = useState<RuneListItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState<RuneStatus | "all" | "active">("all");
  const { isAuthenticated, loading: authLoading } = useAuth();
  const { currentRealm } = useRealm();
  const { showToast } = useToast();

  useEffect(() => {
    if (!isAuthenticated || !currentRealm || authLoading) {
      return;
    }

    const loadRunes = async () => {
      try {
        setIsLoading(true);
        const runesData = await api.getRunes(currentRealm);
        setRunes(runesData);
      } catch (error) {
        console.error("Failed to load runes:", error);
        showToast({
          title: "Error",
          description: "Failed to load runes",
          type: "error",
        });
      } finally {
        setIsLoading(false);
      }
    };

    loadRunes();
  }, [isAuthenticated, currentRealm, authLoading, showToast]);

  let filteredRunes: RuneListItem[] = [];
  if (statusFilter === "all") {
    filteredRunes = runes;
  } else if (statusFilter === "active") {
    filteredRunes = runes.filter((rune) => ACTIVE_STATUSES.includes(rune.status));
  } else {
    filteredRunes = runes.filter((rune) => rune.status === statusFilter);
  }

  const handleCreateRune = () => {
    navigate("/runes/create");
  };

  const handleRuneClick = (runeId: string) => {
    navigate(`/runes/${runeId}`);
  };

  const handleStatusChange = (value: string) => {
    setStatusFilter(value as RuneStatus | "all" | "active");
  };

  if (authLoading) {
    return (
      <div className="min-h-[calc(100vh-56px)] flex items-center justify-center p-6">
        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500 mx-auto mb-4" />
          <p>Loading...</p>
        </div>
      </div>
    );
  }

  if (!isAuthenticated) {
    return (
      <div className="min-h-[calc(100vh-56px)] flex items-center justify-center p-6">
        <div className="text-center p-6 border border-red-500 rounded">
          <h2 className="text-xl font-bold mb-2">Authentication Required</h2>
          <p>Please log in to view runes.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-[calc(100vh-56px)] p-6">
      <div className="max-w-7xl mx-auto">
        <div className="mb-8">
          <h1 className="text-3xl font-bold mb-2">Runes</h1>
          <p className="text-gray-600">Manage and track your work items</p>
        </div>

        <div className="flex flex-col lg:flex-row gap-6">
          <div className="lg:w-1/4">
            <RealmSelector />
          </div>

          <div className="lg:w-3/4">
            <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-300 dark:border-gray-600 p-6">
              <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between mb-6 gap-4">
                <div className="flex items-center gap-4">
                  <h2 className="text-xl font-bold">All Runes</h2>
                  <ToggleGroup
                    type="single"
                    value={statusFilter}
                    onValueChange={handleStatusChange}
                    className="flex gap-2"
                  >
                    {STATUS_FILTERS.map((filter) => (
                      <Toggle
                        key={filter.value}
                        value={filter.value}
                        aria-label={filter.label}
                        className="px-3 py-1 text-sm"
                        style={{
                          backgroundColor: "var(--color-bg)",
                          border: "2px solid var(--color-border)",
                          color: "var(--color-text)",
                        }}
                      >
                        {filter.label}
                      </Toggle>
                    ))}
                  </ToggleGroup>
                </div>

                <Button
                  onClick={handleCreateRune}
                  className="px-6 py-2 text-sm font-bold uppercase tracking-wider"
                  style={{
                    backgroundColor: "var(--color-blue)",
                    border: "2px solid var(--color-border)",
                    color: "white",
                  }}
                >
                  Create Rune
                </Button>
              </div>

              <RunesList
                isLoading={isLoading}
                filteredRunes={filteredRunes}
                onRuneClick={handleRuneClick}
              />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export { Page };
