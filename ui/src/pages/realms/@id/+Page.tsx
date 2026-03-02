"use client";

import { useCallback, useEffect, useState } from "react";
import { Button } from "@base-ui/react/button";
import { Combobox } from "@base-ui/react/combobox";
import { Dialog as BaseDialog } from "@base-ui/react/dialog";
import { Select } from "@base-ui/react/select";
import { navigate } from "@/lib/router";
import { usePageContext } from "vike-react/usePageContext";
import { useAuth } from "../../../lib/auth";
import { useToast } from "../../../lib/toast";
import { api } from "../../../lib/api";
import { Dialog } from "../../../components/Dialog/Dialog";
import type { RealmDetail, RealmStatus } from "../../../types/realm";
import type { RuneListItem, RuneStatus } from "../../../types/rune";
import type { AdminAccountEntry } from "../../../types/account";

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
  const [showSuspendDialog, setShowSuspendDialog] = useState(false);
  const [isSuspending, setIsSuspending] = useState(false);
  const [showAddAccountDialog, setShowAddAccountDialog] = useState(false);
  const [isAssigning, setIsAssigning] = useState(false);
  const [availableAccounts, setAvailableAccounts] = useState<AdminAccountEntry[]>([]);
  const [realmMemberIds, setRealmMemberIds] = useState<string[]>([]);
  const [accountFilter, setAccountFilter] = useState("");
  const [selectedAccountId, setSelectedAccountId] = useState("");
  const [selectedRole, setSelectedRole] = useState<"admin" | "member" | "viewer">("member");
  const [memberToRemove, setMemberToRemove] = useState<{
    account_id: string;
    username: string;
  } | null>(null);
  const [isRemovingMember, setIsRemovingMember] = useState(false);

  const normalizeRealmDetail = useCallback((rawData: unknown): RealmDetail | null => {
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
  }, [realmNames]);

  const toFallbackRealm = useCallback((targetRealmId: string): RealmDetail | null => {
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
  }, [realmNames, sessionRealmIds]);

  const extractRealmMemberIds = useCallback((rawData: unknown): string[] => {
    if (!rawData || typeof rawData !== "object") {
      return [];
    }

    const rawMembers = (rawData as { members?: unknown[] }).members;
    if (!Array.isArray(rawMembers)) {
      return [];
    }

    return rawMembers
      .map((entry) => {
        if (!entry || typeof entry !== "object") {
          return null;
        }
        const accountId = (entry as { account_id?: unknown }).account_id;
        return typeof accountId === "string" ? accountId : null;
      })
      .filter((accountId): accountId is string => accountId !== null);
  }, []);

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
        const [realmData, runesData, accountsData] = await Promise.all([
          api.getRealm(realmId),
          api.getRunes(realmId),
          api.getAdminAccounts().catch(() => [] as AdminAccountEntry[]),
        ]);
        const normalizedRealm = normalizeRealmDetail(realmData) ?? toFallbackRealm(realmId);
        setRealm(normalizedRealm);
        setRunes(runesData);
        setRealmMemberIds(extractRealmMemberIds(realmData));
        setAvailableAccounts(Array.isArray(accountsData) ? accountsData : []);
      } catch (error) {
        const fallbackRealm = toFallbackRealm(realmId);
        setRealm(fallbackRealm);
        setRealmMemberIds([]);
        setAvailableAccounts([]);
        if (!fallbackRealm) {
          showToast("Error", "Failed to load realm", "error");
        }
      } finally {
        setIsLoading(false);
      }
    };

    fetchData();
  }, [
    authLoading,
    extractRealmMemberIds,
    isAuthenticated,
    normalizeRealmDetail,
    realmId,
    showToast,
    toFallbackRealm,
  ]);

  const handleSuspend = async () => {
    if (!realm) return;

    setIsSuspending(true);
    setIsLoading(true);
    try {
      await api.suspendRealm({ realm_id: realm.id, reason: "Suspended from realm details" }, realm.id);
      showToast("Realm Suspended", `${realm.name} is now suspended`, "success");
      setShowSuspendDialog(false);
      const realmData = await api.getRealm(realm.id);
      setRealm(normalizeRealmDetail(realmData) ?? toFallbackRealm(realm.id));
    } catch (error) {
      showToast("Error", "Failed to suspend realm", "error");
    } finally {
      setIsSuspending(false);
      setIsLoading(false);
    }
  };

  const handleAddAccount = async () => {
    if (!realm || !selectedAccountId.trim()) {
      return;
    }

    setIsAssigning(true);
    try {
      await api.assignRole(
        {
          account_id: selectedAccountId.trim(),
          realm_id: realm.id,
          role: selectedRole,
        },
        realm.id
      );
      showToast("Account Added", `Assigned ${selectedRole} to ${selectedAccountId.trim()}`, "success");
      setShowAddAccountDialog(false);
      setSelectedAccountId("");
      setAccountFilter("");
      setIsLoading(true);
      const realmData = await api.getRealm(realm.id);
      setRealm(normalizeRealmDetail(realmData) ?? toFallbackRealm(realm.id));
      setRealmMemberIds(extractRealmMemberIds(realmData));
    } catch {
      showToast("Error", "Failed to add account to realm", "error");
    } finally {
      setIsAssigning(false);
    }
  };

  const handleRemoveMember = async () => {
    if (!realm || !memberToRemove) {
      return;
    }

    setIsRemovingMember(true);
    try {
      await api.revokeRole(
        {
          account_id: memberToRemove.account_id,
          realm_id: realm.id,
        },
        realm.id
      );
      showToast("Member Removed", `${memberToRemove.username} removed from realm`, "success");
      setMemberToRemove(null);
      setIsLoading(true);
      const [realmData, accountsData] = await Promise.all([
        api.getRealm(realm.id),
        api.getAdminAccounts().catch(() => [] as AdminAccountEntry[]),
      ]);
      setRealm(normalizeRealmDetail(realmData) ?? toFallbackRealm(realm.id));
      setRealmMemberIds(extractRealmMemberIds(realmData));
      setAvailableAccounts(Array.isArray(accountsData) ? accountsData : []);
    } catch {
      showToast("Error", "Failed to remove member", "error");
    } finally {
      setIsRemovingMember(false);
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
  const assignableAccounts = availableAccounts.filter(
    (account) => !realmMemberIds.includes(account.account_id)
  );
  const filteredAssignableAccounts = assignableAccounts.filter((account) => {
    if (!accountFilter.trim()) {
      return true;
    }
    const query = accountFilter.trim().toLowerCase();
    return (
      account.account_id.toLowerCase().includes(query) ||
      account.username.toLowerCase().includes(query)
    );
  });
  const selectedAccount = assignableAccounts.find(
    (account) => account.account_id === selectedAccountId
  );
  const accountsById = new Map(availableAccounts.map((account) => [account.account_id, account]));
  const memberRows = realmMemberIds.map((accountId) => {
    const account = accountsById.get(accountId);
    return {
      account_id: accountId,
      username: account?.username ?? accountId,
      role: account?.roles?.[realm.id] ?? "-",
    };
  });

  return (
    <div className="min-h-[calc(100vh-56px)] p-6">
      {/* Header */}
      <div className="mb-8">
        <div className="grid grid-cols-[auto_1fr_auto] items-center gap-4">
          <Button
            onClick={() => navigate("/realms")}
            className="inline-flex items-center gap-2 text-sm font-bold uppercase tracking-wider transition-all duration-150 hover:translate-x-[-2px]"
            style={{ color: "var(--color-text-muted)" }}
          >
            <span>&larr;</span>
            <span>Back to Realms</span>
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
              {realm.status}
            </span>
            <h1
              className="text-4xl font-bold tracking-tight uppercase"
              style={{ color: "var(--color-green)" }}
            >
              {realm.name}
            </h1>
            <span
              className="text-xs uppercase tracking-wider"
              style={{ color: "var(--color-text-muted)" }}
            >
              ID: {realm.id}
            </span>
          </div>

          <Button
            onClick={() => navigate(`/realms/${realm.id}/edit`)}
            className="inline-flex h-9 w-9 items-center justify-center text-base font-bold"
            style={{
              backgroundColor: "var(--color-green)",
              border: "2px solid var(--color-border)",
              color: "white",
              boxShadow: "var(--shadow-soft)",
            }}
            title="Edit Realm"
            aria-label="Edit realm"
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
            <div className="space-y-4">
              <div>
                <div
                  className="text-xs uppercase tracking-wider block mb-1"
                  style={{ color: "var(--color-text-muted)" }}
                >
                  Created
                </div>
                <span className="text-sm">{formatDate(realm.created_at)}</span>
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
            <div className="space-y-3">
              <Button
                onClick={() => setShowSuspendDialog(true)}
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
                Suspend Realm
              </Button>
            </div>
          </div>
        </div>
      </div>

      <div className="mt-8">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-4">
            <h2
              className="text-2xl font-bold uppercase tracking-tight"
              style={{ color: "var(--color-green)" }}
            >
              Members
            </h2>
            <span
              className="text-sm uppercase tracking-widest"
              style={{ color: "var(--color-text-muted)" }}
            >
              {memberRows.length} members
            </span>
          </div>
          <Button
            onClick={() => {
              setSelectedAccountId("");
              setAccountFilter("");
              setSelectedRole("member");
              setShowAddAccountDialog(true);
            }}
            className="px-3 py-2 text-xs font-bold uppercase tracking-wider"
            style={{
              backgroundColor: "var(--color-green)",
              border: "2px solid var(--color-border)",
              color: "white",
            }}
            title="Add account"
            aria-label="Add account"
          >
            +
          </Button>
        </div>

        <div
          style={{
            backgroundColor: "var(--color-bg)",
            border: "2px solid var(--color-border)",
            boxShadow: "var(--shadow-soft)",
          }}
        >
          <div
            className="grid grid-cols-12 gap-4 px-4 py-3 text-xs font-bold uppercase tracking-wider"
            style={{
              borderBottom: "2px solid var(--color-border)",
              backgroundColor: "var(--color-surface)",
            }}
          >
            <div className="col-span-3">Account ID</div>
            <div className="col-span-4">Name</div>
            <div className="col-span-4">Role</div>
            <div className="col-span-1 text-right">&nbsp;</div>
          </div>

          {memberRows.length === 0 ? (
            <div className="px-4 py-10 text-sm" style={{ color: "var(--color-text-muted)" }}>
              No members in this realm.
            </div>
          ) : (
            <div>
              {memberRows.map((member) => (
                <div
                  key={member.account_id}
                  className="grid grid-cols-12 gap-4 px-4 py-4 items-center transition-all duration-150 hover:translate-x-[2px] border-l-4 border-l-transparent hover:bg-[var(--color-surface)] hover:border-l-[var(--color-green)]"
                  style={{
                    borderBottom: "1px solid var(--color-border)",
                    backgroundColor: "var(--color-bg)",
                  }}
                >
                  <button
                    type="button"
                    className="col-span-11 grid grid-cols-11 gap-4 items-center text-left"
                    onClick={() => navigate(`/accounts/${member.account_id}`)}
                  >
                    <div className="col-span-3">
                      <span className="text-xs font-mono" style={{ color: "var(--color-text-muted)" }}>
                        {member.account_id}
                      </span>
                    </div>
                    <div className="col-span-4">
                      <span className="font-medium truncate block">{member.username}</span>
                    </div>
                    <div className="col-span-4">
                      <span className="text-sm uppercase tracking-wider">{member.role}</span>
                    </div>
                  </button>
                  <div className="col-span-1 flex justify-end">
                    <Button
                      onClick={() => setMemberToRemove({ account_id: member.account_id, username: member.username })}
                      className="text-xs px-1 py-0 leading-none"
                      style={{
                        backgroundColor: "transparent",
                        border: "none",
                        color: "var(--color-text-muted)",
                      }}
                      aria-label={`Remove ${member.username}`}
                      title="Remove member"
                    >
                      <svg viewBox="0 0 24 24" width="12" height="12" fill="currentColor" aria-hidden="true">
                        <path d="M18.3 5.71a1 1 0 0 0-1.41 0L12 10.59 7.11 5.7a1 1 0 0 0-1.41 1.41L10.59 12 5.7 16.89a1 1 0 1 0 1.41 1.41L12 13.41l4.89 4.89a1 1 0 0 0 1.41-1.41L13.41 12l4.89-4.89a1 1 0 0 0 0-1.4z" />
                      </svg>
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Runes Section */}
      <div className="mt-8">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-4">
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
              {runes.length} runes
            </span>
          </div>
          <Button
            onClick={() => navigate(`/runes/new?realm=${encodeURIComponent(realm.id)}`)}
            className="px-3 py-2 text-xs font-bold uppercase tracking-wider"
            style={{
              backgroundColor: "var(--color-green)",
              border: "2px solid var(--color-border)",
              color: "white",
            }}
            title="Add rune"
            aria-label="Add rune"
          >
            +
          </Button>
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
                  <button
                    type="button"
                    key={rune.id}
                    className="grid grid-cols-12 gap-4 px-4 py-4 items-center cursor-pointer transition-all duration-150 hover:translate-x-[2px]"
                    style={{
                      borderBottom: "1px solid var(--color-border)",
                      backgroundColor: "var(--color-bg)",
                      width: "100%",
                      textAlign: "left",
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
                  </button>
                );
              })}
            </div>
          </div>
        )}
      </div>

      <Dialog
        open={showSuspendDialog}
        onClose={() => setShowSuspendDialog(false)}
        title="Suspend Realm"
        description={`Suspend "${realm.name}"? Suspended realms remain visible but no longer accept active work.`}
        confirmLabel={isSuspending ? "Suspending..." : "Suspend"}
        cancelLabel="Cancel"
        onConfirm={handleSuspend}
        color="red"
      />

      <Dialog
        open={memberToRemove !== null}
        onClose={() => setMemberToRemove(null)}
        title="Remove Member"
        description={
          memberToRemove
            ? `Remove ${memberToRemove.username} (${memberToRemove.account_id}) from this realm?`
            : "Remove member from this realm?"
        }
        confirmLabel={isRemovingMember ? "Removing..." : "Remove"}
        cancelLabel="Cancel"
        onConfirm={handleRemoveMember}
        color="red"
      />

      <BaseDialog.Root open={showAddAccountDialog} onOpenChange={setShowAddAccountDialog}>
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
              aria-labelledby="assign-account-title"
              aria-describedby="assign-account-description"
            >
              <div className="space-y-4">
                <div>
                  <BaseDialog.Title
                    id="assign-account-title"
                    className="text-xl font-bold uppercase tracking-tight"
                    style={{ color: "var(--color-green)" }}
                  >
                    Add Account to Realm
                  </BaseDialog.Title>
                  <BaseDialog.Description
                    id="assign-account-description"
                    className="text-sm mt-1"
                    style={{ color: "var(--color-text-muted)" }}
                  >
                    Select an account and assign a role in this realm.
                  </BaseDialog.Description>
                </div>

                <div>
                  <label
                    htmlFor="assign-account-combobox"
                    className="text-xs uppercase tracking-wider block mb-2 font-bold"
                    style={{ color: "var(--color-text-muted)" }}
                  >
                    Account
                  </label>
                  <Combobox.Root
                    value={selectedAccountId || null}
                    onValueChange={(value) => {
                      if (typeof value === "string") {
                        setSelectedAccountId(value);
                      }
                    }}
                    onInputValueChange={setAccountFilter}
                  >
                    <Combobox.Input
                      id="assign-account-combobox"
                      placeholder="Search by username or account ID"
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
                            {filteredAssignableAccounts.map((account) => (
                              <Combobox.Item
                                key={account.account_id}
                                value={account.account_id}
                                className="px-3 py-2 text-sm cursor-pointer"
                                style={{ color: "var(--color-text)" }}
                              >
                                {account.username}
                                <span
                                  className="ml-2 text-xs"
                                  style={{ color: "var(--color-text-muted)" }}
                                >
                                  {account.account_id}
                                </span>
                              </Combobox.Item>
                            ))}
                          </Combobox.List>
                          <Combobox.Empty
                            className="px-3 py-2 text-sm"
                            style={{ color: "var(--color-text-muted)" }}
                          >
                            No accounts available
                          </Combobox.Empty>
                        </Combobox.Popup>
                      </Combobox.Positioner>
                    </Combobox.Portal>
                  </Combobox.Root>
                </div>

                <div>
                  <label
                    htmlFor="assign-role"
                    className="text-xs uppercase tracking-wider block mb-2 font-bold"
                    style={{ color: "var(--color-text-muted)" }}
                  >
                    Role
                  </label>
                  <Select.Root
                    items={{ viewer: "viewer", member: "member", admin: "admin" }}
                    value={selectedRole}
                    onValueChange={(value) => {
                      if (value === "admin" || value === "member" || value === "viewer") {
                        setSelectedRole(value);
                      }
                    }}
                  >
                    <Select.Trigger
                      id="assign-role"
                      className="w-full px-3 py-2 text-sm outline-none"
                      style={{
                        backgroundColor: "var(--color-surface)",
                        border: "2px solid var(--color-border)",
                        color: "var(--color-text)",
                      }}
                    >
                      <Select.Value placeholder="Select role" />
                    </Select.Trigger>
                    <Select.Portal>
                      <Select.Positioner sideOffset={8} align="end">
                        <Select.Popup
                          style={{
                            backgroundColor: "var(--color-bg)",
                            border: "2px solid var(--color-border)",
                            boxShadow: "var(--shadow-soft)",
                          }}
                        >
                          <Select.List>
                            {(["viewer", "member", "admin"] as const).map((role) => (
                              <Select.Item
                                key={role}
                                value={role}
                                onClick={() => setSelectedRole(role)}
                                className="px-3 py-2 text-sm font-semibold cursor-pointer"
                              >
                                <Select.ItemText>{role}</Select.ItemText>
                              </Select.Item>
                            ))}
                          </Select.List>
                        </Select.Popup>
                      </Select.Positioner>
                    </Select.Portal>
                  </Select.Root>
                  <p className="text-xs mt-2" style={{ color: "var(--color-text-muted)" }}>
                    Current: {selectedRole}
                    {selectedAccount
                      ? ` for ${selectedAccount.username} (${selectedAccount.account_id})`
                      : ""}
                  </p>
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
                    onClick={handleAddAccount}
                    disabled={selectedAccountId.trim().length === 0 || isAssigning}
                    className="px-4 py-2 text-sm font-semibold disabled:opacity-50 disabled:cursor-not-allowed"
                    style={{
                      backgroundColor: "var(--color-green)",
                      border: "2px solid var(--color-border)",
                      color: "white",
                    }}
                  >
                    {isAssigning ? "Adding..." : "Add"}
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
