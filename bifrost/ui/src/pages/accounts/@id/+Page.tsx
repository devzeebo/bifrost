"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { Button } from "@base-ui/react/button";
import { Combobox } from "@base-ui/react/combobox";
import { Dialog as BaseDialog } from "@base-ui/react/dialog";
import { Select } from "@base-ui/react/select";
import { navigate } from "@/lib/router";
import { usePageContext } from "vike-react/usePageContext";
import { Dialog } from "../../../components/Dialog/Dialog";
import { useAuth } from "../../../lib/auth";
import { api } from "../../../lib/api";
import { useToast } from "../../../lib/toast";
import type { AdminAccountEntry, PatEntry } from "../../../types/account";
import type { RealmListEntry } from "../../../types/realm";

export { Page };

const statusColors: Record<string, { bg: string; border: string; text: string }> = {
  active: {
    bg: "var(--color-green)",
    border: "var(--color-border)",
    text: "white",
  },
  inactive: {
    bg: "var(--color-border)",
    border: "var(--color-border)",
    text: "white",
  },
  suspended: {
    bg: "var(--color-red)",
    border: "var(--color-border)",
    text: "white",
  },
};

const roleColors: Record<string, string> = {
  owner: "var(--color-amber)",
  admin: "var(--color-blue)",
  member: "var(--color-green)",
  viewer: "var(--color-border)",
};

type RoleToRemove = {
  realmId: string;
  realmName: string;
  role: string;
};

type RoleRow = {
  realmId: string;
  realmName: string;
  role: string;
};

type PatToRemove = {
  id: string;
  label?: string;
};

function Page() {
  const pageContext = usePageContext();
  const routeParams = pageContext.routeParams as Record<string, string | undefined>;
  const accountId = routeParams?.id ?? routeParams?.["@id"] ?? routeParams?.["-id"] ?? "";
  const {
    isAuthenticated,
    isSysadmin,
    accountId: currentAccountId,
    username,
    logout,
    realms,
    roles,
    realmNames,
    loading: authLoading,
  } = useAuth();
  const { showToast } = useToast();

  const [account, setAccount] = useState<AdminAccountEntry | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [availableRealms, setAvailableRealms] = useState<RealmListEntry[]>([]);
  const [totalPATCount, setTotalPATCount] = useState(0);
  const [pats, setPATs] = useState<PatEntry[]>([]);

  const [showAssignRoleDialog, setShowAssignRoleDialog] = useState(false);
  const [isAssigningRole, setIsAssigningRole] = useState(false);
  const [realmFilter, setRealmFilter] = useState("");
  const [selectedRealmId, setSelectedRealmId] = useState("");
  const [selectedRole, setSelectedRole] = useState<"owner" | "admin" | "member" | "viewer">("member");

  const [roleToRemove, setRoleToRemove] = useState<RoleToRemove | null>(null);
  const [isRemovingRole, setIsRemovingRole] = useState(false);

  const [showCreatePATDialog, setShowCreatePATDialog] = useState(false);
  const [isCreatingPAT, setIsCreatingPAT] = useState(false);
  const [newPATName, setNewPATName] = useState("");
  const [newPATValue, setNewPATValue] = useState<string | null>(null);
  const [patToRemove, setPatToRemove] = useState<PatToRemove | null>(null);
  const [isRemovingPAT, setIsRemovingPAT] = useState(false);

  const [showCloseAccountDialog, setShowCloseAccountDialog] = useState(false);
  const [isClosingAccount, setIsClosingAccount] = useState(false);

  const toFallbackAccount = useCallback(
    (targetAccountId: string): AdminAccountEntry | null => {
      if (!targetAccountId || !currentAccountId || !username || targetAccountId !== currentAccountId) {
        return null;
      }

      return {
        account_id: currentAccountId,
        username,
        status: "active",
        realms: realms.filter((realmId) => realmId !== "_admin"),
        roles,
        pat_count: 0,
        created_at: new Date(0).toISOString(),
      };
    },
    [currentAccountId, username, realms, roles]
  );

  const loadAccount = useCallback(async () => {
    if (authLoading) {
      return;
    }

    if (!isAuthenticated) {
      navigate("/login");
      return;
    }

    if (!accountId) {
      setIsLoading(false);
      return;
    }

    const isOwnAccountRoute = currentAccountId !== null && accountId === currentAccountId;
    if (!isOwnAccountRoute && !isSysadmin) {
      navigate("/dashboard");
      return;
    }

    setIsLoading(true);
    try {
      const [accountRaw, patsRaw, realmsRaw] = await Promise.all([
        api.getAdminAccount(accountId),
        api.getPATs(accountId).catch(() => [] as PatEntry[]),
        api.getRealms().catch(() => [] as RealmListEntry[]),
      ]);

      const resolvedAccount = accountRaw ?? toFallbackAccount(accountId);
      setAccount(resolvedAccount);
      setPATs(Array.isArray(patsRaw) ? patsRaw : []);

      if (resolvedAccount) {
        setTotalPATCount(Array.isArray(patsRaw) ? patsRaw.length : resolvedAccount.pat_count);
      } else {
        setTotalPATCount(0);
      }

      setAvailableRealms(Array.isArray(realmsRaw) ? realmsRaw : []);
    } catch {
      const fallback = toFallbackAccount(accountId);
      setAccount(fallback);
      setPATs([]);
      setTotalPATCount(fallback?.pat_count ?? 0);
      setAvailableRealms([]);

      if (!fallback) {
        showToast("Error", "Failed to load account", "error");
      }
    } finally {
      setIsLoading(false);
    }
  }, [
    accountId,
    currentAccountId,
    authLoading,
    isAuthenticated,
    isSysadmin,
    showToast,
    toFallbackAccount,
  ]);

  useEffect(() => {
    void loadAccount();
  }, [loadAccount]);

  const realmNameById = useMemo(() => {
    const map = new Map<string, string>();

    for (const [realmId, realmName] of Object.entries(realmNames)) {
      const normalizedName = realmName.trim();
      if (normalizedName.length > 0) {
        map.set(realmId, normalizedName);
      }
    }

    for (const realm of availableRealms) {
      const normalizedName = realm.name.trim();
      if (!map.has(realm.id) || normalizedName.length > 0 && normalizedName !== realm.id) {
        map.set(realm.id, normalizedName || realm.id);
      }
    }

    return map;
  }, [availableRealms, realmNames]);

  const roleRows = useMemo<RoleRow[]>(() => {
    if (!account) {
      return [];
    }

    const realmIds = new Set<string>([
      ...account.realms.filter((realmId) => realmId !== "_admin"),
      ...Object.keys(account.roles).filter((realmId) => realmId !== "_admin"),
    ]);

    return Array.from(realmIds)
      .map((realmId) => {
        const role = account.roles[realmId] ?? "member";
        return {
          realmId,
          realmName: realmNameById.get(realmId) ?? realmId,
          role,
        };
      })
      .sort((a, b) => a.realmName.localeCompare(b.realmName));
  }, [account, realmNameById]);

  const filteredRealms = useMemo(() => {
    const query = realmFilter.trim().toLowerCase();
    if (!query) {
      return availableRealms;
    }

    return availableRealms.filter((realm) => {
      const id = realm.id.toLowerCase();
      const resolvedRealmName = (realmNameById.get(realm.id) ?? realm.name).toLowerCase();
      return id.includes(query) || resolvedRealmName.includes(query);
    });
  }, [availableRealms, realmFilter, realmNameById]);

  const selectedRealm = availableRealms.find((realm) => realm.id === selectedRealmId) ?? null;

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

  const handleOpenAssignRole = () => {
    setRealmFilter("");
    setSelectedRealmId("");
    setSelectedRole("member");
    setShowAssignRoleDialog(true);
  };

  const handleAssignRole = async () => {
    if (!account || !selectedRealmId) {
      return;
    }

    const existingRole = account.roles[selectedRealmId] ?? null;

    setIsAssigningRole(true);
    try {
      await api.assignRole(
        {
          account_id: account.account_id,
          realm_id: selectedRealmId,
          role: selectedRole,
        },
        selectedRealmId
      );

      if (existingRole) {
        showToast(
          "Role Updated",
          `${account.username} now has ${selectedRole} role in ${selectedRealm?.name ?? selectedRealmId}`,
          "success"
        );
      } else {
        showToast(
          "Role Added",
          `${account.username} assigned ${selectedRole} role in ${selectedRealm?.name ?? selectedRealmId}`,
          "success"
        );
      }

      setShowAssignRoleDialog(false);
      setSelectedRealmId("");
      setRealmFilter("");
      await loadAccount();
    } catch {
      showToast("Error", "Failed to assign role", "error");
    } finally {
      setIsAssigningRole(false);
    }
  };

  const handleRemoveRole = async () => {
    if (!account || !roleToRemove) {
      return;
    }

    setIsRemovingRole(true);
    try {
      await api.revokeRole(
        {
          account_id: account.account_id,
          realm_id: roleToRemove.realmId,
        },
        roleToRemove.realmId
      );

      showToast(
        "Role Removed",
        `Removed ${roleToRemove.role} role for ${account.username} in ${roleToRemove.realmName}`,
        "success"
      );
      setRoleToRemove(null);
      await loadAccount();
    } catch {
      showToast("Error", "Failed to remove role", "error");
    } finally {
      setIsRemovingRole(false);
    }
  };

  const copyToClipboard = async (value: string, label: string) => {
    try {
      await navigator.clipboard.writeText(value);
      showToast("Copied", `${label} copied to clipboard`, "success");
    } catch {
      showToast("Error", "Failed to copy", "error");
    }
  };

  const handleCreatePAT = async () => {
    if (!account) {
      return;
    }

    setIsCreatingPAT(true);
    try {
      const result = await api.createPAT(account.account_id, newPATName.trim());
      setNewPATValue(result.pat);
      setNewPATName("");
      showToast("PAT Created", "New PAT generated successfully", "success");
      await loadAccount();
    } catch {
      showToast("Error", "Failed to create PAT", "error");
    } finally {
      setIsCreatingPAT(false);
    }
  };

  const handleRemovePAT = async () => {
    if (!account || !patToRemove) {
      return;
    }

    if (pats.length <= 1) {
      showToast("Blocked", "Cannot delete the last PAT", "error");
      setPatToRemove(null);
      return;
    }

    setIsRemovingPAT(true);
    try {
      await api.revokePAT(account.account_id, patToRemove.id);
      setPatToRemove(null);
      showToast("PAT Removed", "PAT revoked successfully", "success");
      await loadAccount();
    } catch {
      showToast("Error", "Failed to remove PAT", "error");
    } finally {
      setIsRemovingPAT(false);
    }
  };

  const handleCloseAccount = async () => {
    if (!account) {
      return;
    }

    setIsClosingAccount(true);
    try {
      await api.suspendAccount(account.account_id, true);
      showToast("Account Closed", `${account.username} has been closed`, "success");
      setShowCloseAccountDialog(false);

      if (currentAccountId === account.account_id) {
        await logout();
        navigate("/login");
        return;
      }

      await loadAccount();
    } catch {
      showToast("Error", "Failed to close account", "error");
    } finally {
      setIsClosingAccount(false);
    }
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

  const backTarget = isSysadmin ? "/accounts" : "/dashboard";
  const backLabel = isSysadmin ? "Back to Accounts" : "Back to Dashboard";

  if (!account) {
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
          <h2 className="text-2xl font-bold mb-4 uppercase tracking-tight">Account Not Found</h2>
          <p className="text-sm mb-6" style={{ color: "var(--color-text-muted)" }}>
            The account you&apos;re looking for doesn&apos;t exist or has been deleted.
          </p>
          <Button
            onClick={() => navigate(backTarget)}
            className="px-6 py-3 text-sm font-bold uppercase tracking-wider transition-all duration-150"
            style={{
              backgroundColor: "var(--color-blue)",
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
            {backLabel}
          </Button>
        </div>
      </div>
    );
  }

  const statusStyle = statusColors[account.status] || statusColors.inactive;
  const activePATs = account.pat_count;
  const totalPATs = Math.max(totalPATCount, activePATs);
  const isAdminAccount = account.realms.includes("_admin") || account.roles["_admin"] !== undefined;
  const isOwnAccount = currentAccountId === account.account_id;
  const canCloseAccount = isOwnAccount || isSysadmin;
  const canManageRoles = isSysadmin;
  const isProfilePATSectionVisible = isOwnAccount;

  const abbreviateSecret = (value: string) => {
    if (value.length <= 16) {
      return value;
    }

    return `${value.slice(0, 8)}...${value.slice(-4)}`;
  };


  return (
    <div className="min-h-[calc(100vh-56px)] p-6">
      <div className="mb-8">
        <div className="grid grid-cols-[auto_1fr_auto] items-center gap-4">
          <Button
            onClick={() => navigate(backTarget)}
            className="inline-flex items-center gap-2 text-sm font-bold uppercase tracking-wider transition-all duration-150 hover:translate-x-[-2px]"
            style={{ color: "var(--color-text-muted)" }}
          >
            <span>&larr;</span>
            <span>{backLabel}</span>
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
              {account.status}
            </span>
            <h1
              className="text-4xl font-bold tracking-tight uppercase"
              style={{ color: "var(--color-blue)" }}
            >
              {account.username}
            </h1>
            <span
              className="text-xs uppercase tracking-wider"
              style={{ color: "var(--color-text-muted)" }}
            >
              ID: {account.account_id}
            </span>
          </div>

          <div className="justify-self-end">
            <span
              className="text-xs uppercase tracking-wider px-3 py-1 font-bold"
              style={{
                backgroundColor: "var(--color-surface)",
                border: "2px solid var(--color-border)",
                color: "var(--color-text-muted)",
              }}
            >
              {isAdminAccount ? "ADMIN" : "USER"}
            </span>
          </div>
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
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
          <div className="space-y-6">
            <div>
              <div
                className="text-xs uppercase tracking-wider block mb-2"
                style={{ color: "var(--color-text-muted)" }}
              >
                Username
              </div>
              <span className="text-xl font-bold">{account.username}</span>
            </div>

            <div>
              <div
                className="text-xs uppercase tracking-wider block mb-2"
                style={{ color: "var(--color-text-muted)" }}
              >
                Account ID
              </div>
              <span className="text-sm font-mono">{account.account_id}</span>
            </div>

            <div>
              <div
                className="text-xs uppercase tracking-wider block mb-2"
                style={{ color: "var(--color-text-muted)" }}
              >
                Created
              </div>
              <span className="text-sm">{formatDate(account.created_at)}</span>
            </div>
          </div>

          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <span className="text-sm uppercase tracking-wider" style={{ color: "var(--color-text-muted)" }}>
                Active PATs
              </span>
              <span className="text-2xl font-bold">{activePATs}</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-sm uppercase tracking-wider" style={{ color: "var(--color-text-muted)" }}>
                Total PATs
              </span>
              <span className="text-2xl font-bold">{totalPATs}</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-sm uppercase tracking-wider" style={{ color: "var(--color-text-muted)" }}>
                Realms
              </span>
              <span className="text-2xl font-bold">{roleRows.length}</span>
            </div>
            {canCloseAccount ? (
              <div className="pt-4">
                <Button
                  onClick={() => setShowCloseAccountDialog(true)}
                  className="w-full px-4 py-2 text-xs font-bold uppercase tracking-wider"
                  style={{
                    backgroundColor: "var(--color-red)",
                    border: "2px solid var(--color-border)",
                    color: "white",
                  }}
                >
                  Close Account
                </Button>
              </div>
            ) : null}
          </div>
        </div>
      </div>

      {isProfilePATSectionVisible ? (
        <div className="mt-8">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-4">
              <h2 className="text-2xl font-bold uppercase tracking-tight" style={{ color: "var(--color-blue)" }}>
                Personal Access Tokens
              </h2>
              <span className="text-sm uppercase tracking-widest" style={{ color: "var(--color-text-muted)" }}>
                {pats.length} pat{pats.length !== 1 ? "s" : ""}
              </span>
            </div>
            <Button
              onClick={() => {
                setShowCreatePATDialog(true);
                setNewPATValue(null);
                setNewPATName("");
              }}
              className="px-3 py-2 text-xs font-bold uppercase tracking-wider"
              style={{
                backgroundColor: "var(--color-blue)",
                border: "2px solid var(--color-border)",
                color: "white",
              }}
              title="Add PAT"
              aria-label="Add PAT"
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
              <div className="col-span-3">PAT ID</div>
              <div className="col-span-3">Name</div>
              <div className="col-span-5">PAT</div>
              <div className="col-span-1 text-right">&nbsp;</div>
            </div>

            {pats.length === 0 ? (
              <div className="p-8 text-center text-sm" style={{ color: "var(--color-text-muted)" }}>
                No PATs available.
              </div>
            ) : (
              <div>
                {pats.map((pat) => {
                  const patPreview = pat.token_preview && pat.token_preview.trim().length > 0
                    ? pat.token_preview
                    : abbreviateSecret(pat.id);
                  const canDelete = pats.length > 1;

                  return (
                    <div
                      key={pat.id}
                      className="grid grid-cols-12 gap-4 px-4 py-4 items-center transition-all duration-150 hover:translate-x-[2px] border-l-4 border-l-transparent hover:bg-[var(--color-surface)] hover:border-l-[var(--color-blue)]"
                      style={{
                        borderBottom: "1px solid var(--color-border)",
                        backgroundColor: "var(--color-bg)",
                      }}
                    >
                      <div className="col-span-3 text-xs font-mono" style={{ color: "var(--color-text-muted)" }}>
                        {pat.id}
                      </div>
                      <div className="col-span-3 text-sm">{pat.label?.trim() || "-"}</div>
                      <div className="col-span-5 text-xs">{patPreview}</div>
                      <div className="col-span-1 flex justify-end">
                        <Button
                          onClick={() => {
                            if (!canDelete) {
                              showToast("Blocked", "Cannot delete the last PAT", "error");
                              return;
                            }

                            setPatToRemove({ id: pat.id, label: pat.label });
                          }}
                          className="text-xs px-1 py-0 leading-none"
                          style={{
                            backgroundColor: "transparent",
                            border: "none",
                            color: canDelete ? "var(--color-text-muted)" : "var(--color-border)",
                          }}
                          aria-label={`Remove PAT ${pat.id}`}
                          title={canDelete ? "Remove PAT" : "Cannot remove last PAT"}
                        >
                          <svg viewBox="0 0 24 24" width="12" height="12" fill="currentColor" aria-hidden="true">
                            <path d="M18.3 5.71a1 1 0 0 0-1.41 0L12 10.59 7.11 5.7a1 1 0 0 0-1.41 1.41L10.59 12 5.7 16.89a1 1 0 1 0 1.41 1.41L12 13.41l4.89 4.89a1 1 0 0 0 1.41-1.41L13.41 12l4.89-4.89a1 1 0 0 0 0-1.4z" />
                          </svg>
                        </Button>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      ) : null}

      <div className="mt-8">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-4">
            <h2
              className="text-2xl font-bold uppercase tracking-tight"
              style={{ color: "var(--color-blue)" }}
            >
              Roles
            </h2>
            <span
              className="text-sm uppercase tracking-widest"
              style={{ color: "var(--color-text-muted)" }}
            >
              {roleRows.length} role{roleRows.length !== 1 ? "s" : ""}
            </span>
          </div>
          {canManageRoles ? (
            <Button
              onClick={handleOpenAssignRole}
              className="px-3 py-2 text-xs font-bold uppercase tracking-wider"
              style={{
                backgroundColor: "var(--color-blue)",
                border: "2px solid var(--color-border)",
                color: "white",
              }}
              title="Add role"
              aria-label="Add role"
            >
              +
            </Button>
          ) : (
            <div className="w-8" aria-hidden="true" />
          )}
        </div>

        {roleRows.length === 0 ? (
          <div
            className="p-8 text-center"
            style={{
              backgroundColor: "var(--color-bg)",
              border: "2px solid var(--color-border)",
              boxShadow: "var(--shadow-soft)",
            }}
          >
            <p className="text-sm" style={{ color: "var(--color-text-muted)" }}>
              This account has no realm role assignments.
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
            <div
              className="grid grid-cols-12 gap-4 px-4 py-3 text-xs font-bold uppercase tracking-wider"
              style={{
                borderBottom: "2px solid var(--color-border)",
                backgroundColor: "var(--color-surface)",
              }}
            >
              <div className="col-span-3">ID</div>
              <div className="col-span-4">Realm Name</div>
              <div className="col-span-4">Role</div>
              <div className="col-span-1 text-right">&nbsp;</div>
            </div>

            <div>
              {roleRows.map((row) => {
                const roleColor = roleColors[row.role] || "var(--color-border)";

                return (
                  <div
                    key={row.realmId}
                    className="grid grid-cols-12 gap-4 px-4 py-4 items-center transition-all duration-150 hover:translate-x-[2px] border-l-4 border-l-transparent hover:bg-[var(--color-surface)] hover:border-l-[var(--color-blue)]"
                    style={{
                      borderBottom: "1px solid var(--color-border)",
                      backgroundColor: "var(--color-bg)",
                    }}
                  >
                    <button
                      type="button"
                      className="col-span-11 grid grid-cols-11 gap-4 items-center text-left"
                      onClick={() => navigate(`/realms/${row.realmId}`)}
                    >
                      <div className="col-span-3">
                        <span className="text-xs font-mono" style={{ color: "var(--color-text-muted)" }}>
                          {row.realmId}
                        </span>
                      </div>
                      <div className="col-span-4">
                        <span className="font-medium truncate block">{row.realmName}</span>
                      </div>
                      <div className="col-span-4">
                        <span
                          className="text-xs uppercase tracking-wider px-2 py-1 font-semibold"
                          style={{
                            color: roleColor,
                            border: `1px solid ${roleColor}`,
                          }}
                        >
                          {row.role}
                        </span>
                      </div>
                    </button>
                    <div className="col-span-1 flex items-center justify-end gap-2">
                      {canManageRoles ? (
                        <Button
                          onClick={() => {
                            setRoleToRemove({
                              realmId: row.realmId,
                              realmName: row.realmName,
                              role: row.role,
                            });
                          }}
                          className="text-xs px-1 py-0 leading-none"
                          style={{
                            backgroundColor: "transparent",
                            border: "none",
                            color: "var(--color-text-muted)",
                          }}
                          aria-label={`Remove ${row.role} role in ${row.realmName}`}
                          title="Remove role"
                        >
                          <svg viewBox="0 0 24 24" width="12" height="12" fill="currentColor" aria-hidden="true">
                            <path d="M18.3 5.71a1 1 0 0 0-1.41 0L12 10.59 7.11 5.7a1 1 0 0 0-1.41 1.41L10.59 12 5.7 16.89a1 1 0 1 0 1.41 1.41L12 13.41l4.89 4.89a1 1 0 0 0 1.41-1.41L13.41 12l4.89-4.89a1 1 0 0 0 0-1.4z" />
                          </svg>
                        </Button>
                      ) : null}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </div>

      <Dialog
        open={patToRemove !== null}
        onClose={() => setPatToRemove(null)}
        title="Remove PAT"
        description={
          patToRemove
            ? `Remove PAT ${patToRemove.id}${patToRemove.label ? ` (${patToRemove.label})` : ""}?`
            : "Remove PAT?"
        }
        confirmLabel={isRemovingPAT ? "Removing..." : "Remove"}
        cancelLabel="Cancel"
        onConfirm={handleRemovePAT}
        color="red"
      />

      <Dialog
        open={showCloseAccountDialog}
        onClose={() => setShowCloseAccountDialog(false)}
        title="Close Account"
        description={`Close ${account.username}? This will suspend access immediately.`}
        confirmLabel={isClosingAccount ? "Closing..." : "Close Account"}
        cancelLabel="Cancel"
        onConfirm={handleCloseAccount}
        color="red"
      />

      <BaseDialog.Root open={showCreatePATDialog} onOpenChange={setShowCreatePATDialog}>
        <BaseDialog.Portal>
          <BaseDialog.Backdrop className="fixed inset-0 z-50 bg-black/50 backdrop-blur-sm" />
          <BaseDialog.Viewport className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <BaseDialog.Popup
              className="w-full max-w-lg p-6"
              style={{
                backgroundColor: "var(--color-bg)",
                border: "2px solid var(--color-border)",
                boxShadow: "var(--shadow-soft)",
              }}
              aria-labelledby="create-pat-title"
              aria-describedby="create-pat-description"
            >
              <div className="space-y-4">
                <div>
                  <BaseDialog.Title
                    id="create-pat-title"
                    className="text-xl font-bold uppercase tracking-tight"
                    style={{ color: "var(--color-blue)" }}
                  >
                    Create Personal Access Token
                  </BaseDialog.Title>
                    Create a new token and copy it immediately. This token will not be retrievable again.
                </div>

                {newPATValue ? (
                  <div
                    className="p-4"
                    style={{
                      backgroundColor: "var(--color-surface)",
                      border: "2px solid var(--color-border)",
                    }}
                  >
                    <div className="text-xs uppercase tracking-wider mb-2" style={{ color: "var(--color-text-muted)" }}>
                      New PAT (shown once)
                    </div>
                    <div className="flex items-center gap-2">
                      <code className="flex-1 text-xs break-all">{newPATValue}</code>
                      <Button
                        onClick={() => void copyToClipboard(newPATValue, "PAT")}
                        className="px-3 py-1 text-xs font-bold uppercase"
                        style={{
                          backgroundColor: "var(--color-blue)",
                          border: "2px solid var(--color-border)",
                          color: "white",
                        }}
                      >
                        Copy
                      </Button>
                    </div>
                  </div>
                ) : (
                  <div>
                    <label
                      htmlFor="new-pat-name"
                      className="text-xs uppercase tracking-wider block mb-2 font-bold"
                      style={{ color: "var(--color-text-muted)" }}
                    >
                      PAT Name
                    </label>
                    <input
                      id="new-pat-name"
                      value={newPATName}
                      onChange={(event) => setNewPATName(event.target.value)}
                      placeholder="e.g. CLI token"
                      className="w-full px-3 py-2 text-sm outline-none"
                      style={{
                        backgroundColor: "var(--color-surface)",
                        border: "2px solid var(--color-border)",
                        color: "var(--color-text)",
                      }}
                    />
                  </div>
                )}

                <div className="flex justify-end gap-3 pt-2">
                  <BaseDialog.Close
                    className="px-4 py-2 text-sm font-semibold"
                    onClick={() => {
                      setNewPATValue(null);
                      setNewPATName("");
                    }}
                    style={{
                      backgroundColor: "var(--color-bg)",
                      border: "2px solid var(--color-border)",
                      color: "var(--color-text)",
                    }}
                  >
                    Cancel
                  </BaseDialog.Close>
                  {!newPATValue ? (
                    <Button
                      onClick={handleCreatePAT}
                      disabled={isCreatingPAT}
                      className="px-4 py-2 text-sm font-semibold disabled:opacity-50 disabled:cursor-not-allowed"
                      style={{
                        backgroundColor: "var(--color-blue)",
                        border: "2px solid var(--color-border)",
                        color: "white",
                      }}
                    >
                      {isCreatingPAT ? "Saving..." : "Save"}
                    </Button>
                  ) : (
                    <BaseDialog.Close
                      className="px-4 py-2 text-sm font-semibold"
                      style={{
                        backgroundColor: "var(--color-blue)",
                        border: "2px solid var(--color-border)",
                        color: "white",
                      }}
                    >
                      Close
                    </BaseDialog.Close>
                  )}
                </div>
              </div>
            </BaseDialog.Popup>
          </BaseDialog.Viewport>
        </BaseDialog.Portal>
      </BaseDialog.Root>

      <Dialog
        open={roleToRemove !== null}
        onClose={() => setRoleToRemove(null)}
        title="Remove Role"
        description={
          roleToRemove
            ? `Remove ${roleToRemove.role} role in ${roleToRemove.realmName} for ${account.username}?`
            : "Remove role assignment?"
        }
        confirmLabel={isRemovingRole ? "Removing..." : "Remove"}
        cancelLabel="Cancel"
        onConfirm={handleRemoveRole}
        color="red"
      />

      <BaseDialog.Root open={showAssignRoleDialog} onOpenChange={setShowAssignRoleDialog}>
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
              aria-labelledby="assign-role-title"
              aria-describedby="assign-role-description"
            >
              <div className="space-y-4">
                <div>
                  <BaseDialog.Title
                    id="assign-role-title"
                    className="text-xl font-bold uppercase tracking-tight"
                    style={{ color: "var(--color-blue)" }}
                  >
                    Add Role Assignment
                  </BaseDialog.Title>
                  <BaseDialog.Description
                    id="assign-role-description"
                    className="text-sm mt-1"
                    style={{ color: "var(--color-text-muted)" }}
                  >
                    Assigning a role to a realm with an existing role will overwrite the existing role.
                  </BaseDialog.Description>
                </div>

                <div>
                  <label
                    htmlFor="assign-realm-combobox"
                    className="text-xs uppercase tracking-wider block mb-2 font-bold"
                    style={{ color: "var(--color-text-muted)" }}
                  >
                    Realm
                  </label>
                  <Combobox.Root
                    value={selectedRealmId || null}
                    onValueChange={(value) => {
                      if (typeof value === "string") {
                        setSelectedRealmId(value);
                      }
                    }}
                    onInputValueChange={setRealmFilter}
                  >
                    <Combobox.Input
                      id="assign-realm-combobox"
                      placeholder="Search by realm name or ID"
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
                            {filteredRealms.map((realm) => {
                              const existingRole = account.roles[realm.id];
                              return (
                                <Combobox.Item
                                  key={realm.id}
                                  value={realm.id}
                                  className="px-3 py-2 text-sm cursor-pointer"
                                  style={{ color: "var(--color-text)" }}
                                >
                                  {realmNameById.get(realm.id) ?? realm.name}
                                  <span
                                    className="ml-2 text-xs"
                                    style={{ color: "var(--color-text-muted)" }}
                                  >
                                    {realm.id}
                                    {existingRole ? ` • current: ${existingRole}` : ""}
                                  </span>
                                </Combobox.Item>
                              );
                            })}
                          </Combobox.List>
                          <Combobox.Empty
                            className="px-3 py-2 text-sm"
                            style={{ color: "var(--color-text-muted)" }}
                          >
                            No realms available
                          </Combobox.Empty>
                        </Combobox.Popup>
                      </Combobox.Positioner>
                    </Combobox.Portal>
                  </Combobox.Root>
                </div>

                <div>
                  <label
                    htmlFor="assign-role-select"
                    className="text-xs uppercase tracking-wider block mb-2 font-bold"
                    style={{ color: "var(--color-text-muted)" }}
                  >
                    Role
                  </label>
                  <Select.Root
                    items={{ viewer: "viewer", member: "member", admin: "admin", owner: "owner" }}
                    value={selectedRole}
                    onValueChange={(value) => {
                      if (value === "owner" || value === "admin" || value === "member" || value === "viewer") {
                        setSelectedRole(value);
                      }
                    }}
                  >
                    <Select.Trigger
                      id="assign-role-select"
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
                            {(["viewer", "member", "admin", "owner"] as const).map((role) => (
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
                    Current role: {selectedRealmId ? account.roles[selectedRealmId] ?? "none" : "none"}
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
                    onClick={handleAssignRole}
                    disabled={!selectedRealmId || isAssigningRole}
                    className="px-4 py-2 text-sm font-semibold disabled:opacity-50 disabled:cursor-not-allowed"
                    style={{
                      backgroundColor: "var(--color-blue)",
                      border: "2px solid var(--color-border)",
                      color: "white",
                    }}
                  >
                    {isAssigningRole ? "Saving..." : "Save"}
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
