"use client";

import { useEffect, useState } from "react";
import { Button } from "@base-ui/react/button";
import { navigate } from "@/lib/router";
import { usePageContext } from "vike-react/usePageContext";
import { useAuth } from "../../../lib/auth";
import { useToast } from "../../../lib/toast";
import { api } from "../../../lib/api";
import type { AdminAccountEntry } from "../../../types/account";

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

function Page() {
  const pageContext = usePageContext();
  const routeParams = pageContext.routeParams as Record<string, string | undefined>;
  const accountId = routeParams?.id ?? routeParams?.["@id"] ?? routeParams?.["-id"] ?? "";
  const {
    isAuthenticated,
    isSysadmin,
    accountId: currentAccountId,
    username,
    realms,
    roles,
    loading: authLoading,
  } = useAuth();
  const { showToast } = useToast();

  const [account, setAccount] = useState<AdminAccountEntry | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  const normalizeAccounts = (rawData: unknown): AdminAccountEntry[] => {
    if (!Array.isArray(rawData)) {
      return [];
    }

    return rawData
      .map((entry) => {
        if (!entry || typeof entry !== "object") {
          return null;
        }

        const rawEntry = entry as Partial<AdminAccountEntry>;
        if (!rawEntry.account_id || !rawEntry.username) {
          return null;
        }

        return {
          account_id: rawEntry.account_id,
          username: rawEntry.username,
          status: rawEntry.status ?? "active",
          realms: rawEntry.realms ?? [],
          roles: rawEntry.roles ?? {},
          pat_count: rawEntry.pat_count ?? 0,
          created_at: rawEntry.created_at ?? new Date(0).toISOString(),
        };
      })
      .filter((entry): entry is AdminAccountEntry => entry !== null);
  };

  const toFallbackAccount = (targetAccountId: string): AdminAccountEntry | null => {
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
  };

  useEffect(() => {
    if (authLoading) return;

    if (!isAuthenticated) {
      navigate("/login");
      return;
    }

    if (!isSysadmin) {
      navigate("/dashboard");
      return;
    }

    if (!accountId) {
      setIsLoading(false);
      return;
    }

    const fetchAccount = async () => {
      try {
        const accounts = normalizeAccounts(await api.getAdminAccounts());
        const found = accounts.find((entry) => entry.account_id === accountId);
        if (found) {
          setAccount(found);
        } else {
          setAccount(toFallbackAccount(accountId));
        }
      } catch (error) {
        const fallback = toFallbackAccount(accountId);
        setAccount(fallback);
        if (!fallback) {
          showToast("Error", "Failed to load account", "error");
        }
      } finally {
        setIsLoading(false);
      }
    };

    fetchAccount();
  }, [
    authLoading,
    isAuthenticated,
    isSysadmin,
    accountId,
    currentAccountId,
    username,
    realms,
    roles,
    showToast,
  ]);

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
          <h2 className="text-2xl font-bold mb-4 uppercase tracking-tight">
            Account Not Found
          </h2>
          <p className="text-sm mb-6" style={{ color: "var(--color-text-muted)" }}>
            The account you're looking for doesn't exist or has been deleted.
          </p>
          <Button
            onClick={() => navigate("/accounts")}
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
            Back to Accounts
          </Button>
        </div>
      </div>
    );
  }

  const statusStyle = statusColors[account.status] || statusColors.inactive;

  return (
    <div className="min-h-[calc(100vh-56px)] p-6">
      {/* Header */}
      <div className="mb-8">
        <Button
          onClick={() => navigate("/accounts")}
          className="inline-flex items-center gap-2 text-sm font-bold uppercase tracking-wider mb-4 transition-all duration-150 hover:translate-x-[-2px]"
          style={{ color: "var(--color-text-muted)" }}
        >
          <span>&larr;</span>
          <span>Back to Accounts</span>
        </Button>
        <h1
          className="text-4xl font-bold tracking-tight uppercase"
          style={{ color: "var(--color-blue)" }}
        >
          {account.username}
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
            {account.status}
          </span>
          <span
            className="text-xs uppercase tracking-wider"
            style={{ color: "var(--color-text-muted)" }}
          >
            ID: {account.account_id}
          </span>
        </div>
      </div>

      {/* Main Content */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Account Details Card */}
        <div
          className="lg:col-span-2 p-6"
          style={{
            backgroundColor: "var(--color-bg)",
            border: "2px solid var(--color-border)",
            boxShadow: "var(--shadow-soft)",
          }}
        >
          <h2
            className="text-sm uppercase tracking-wider font-bold mb-6"
            style={{ color: "var(--color-text-muted)" }}
          >
            Account Information
          </h2>

          <div className="space-y-6">
            {/* Username */}
            <div>
              <label
                className="text-xs uppercase tracking-wider block mb-2"
                style={{ color: "var(--color-text-muted)" }}
              >
                Username
              </label>
              <span className="text-xl font-bold">{account.username}</span>
            </div>

            {/* Account ID */}
            <div>
              <label
                className="text-xs uppercase tracking-wider block mb-2"
                style={{ color: "var(--color-text-muted)" }}
              >
                Account ID
              </label>
              <span className="text-sm font-mono">{account.account_id}</span>
            </div>

            {/* Status */}
            <div>
              <label
                className="text-xs uppercase tracking-wider block mb-2"
                style={{ color: "var(--color-text-muted)" }}
              >
                Status
              </label>
              <span
                className="text-xs uppercase tracking-wider px-3 py-1 font-bold"
                style={{
                  backgroundColor: statusStyle.bg,
                  border: `1px solid ${statusStyle.border}`,
                  color: statusStyle.text,
                }}
              >
                {account.status}
              </span>
            </div>

            {/* Created */}
            <div>
              <label
                className="text-xs uppercase tracking-wider block mb-2"
                style={{ color: "var(--color-text-muted)" }}
              >
                Created
              </label>
              <span className="text-sm">{formatDate(account.created_at)}</span>
            </div>
          </div>
        </div>

        {/* Sidebar */}
        <div className="space-y-6">
          {/* PATs Card */}
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
              Personal Access Tokens
            </h2>
            <div className="flex items-center gap-3">
              <div
                className="w-12 h-12 flex items-center justify-center text-2xl font-bold"
                style={{
                  backgroundColor: "var(--color-blue)",
                  border: "2px solid var(--color-border)",
                  color: "white",
                }}
              >
                {account.pat_count}
              </div>
              <span className="text-sm" style={{ color: "var(--color-text-muted)" }}>
                active token{account.pat_count !== 1 ? "s" : ""}
              </span>
            </div>
          </div>

          {/* Quick Stats */}
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
              Quick Stats
            </h2>
            <div className="space-y-3">
              <div className="flex justify-between items-center">
                <span className="text-sm" style={{ color: "var(--color-text-muted)" }}>
                  Realms
                </span>
                <span className="text-lg font-bold">{account.realms.length}</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-sm" style={{ color: "var(--color-text-muted)" }}>
                  PATs
                </span>
                <span className="text-lg font-bold">{account.pat_count}</span>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Realms Section */}
      <div className="mt-8">
        <div className="flex items-center justify-between mb-4">
          <h2
            className="text-2xl font-bold uppercase tracking-tight"
            style={{ color: "var(--color-blue)" }}
          >
            Realms
          </h2>
          <span
            className="text-sm uppercase tracking-widest"
            style={{ color: "var(--color-text-muted)" }}
          >
            {account.realms.length} realm{account.realms.length !== 1 ? "s" : ""}
          </span>
        </div>

        {account.realms.length === 0 ? (
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
              This account has no realm memberships.
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
              <div className="col-span-6">Realm</div>
              <div className="col-span-3">Role</div>
              <div className="col-span-3">Actions</div>
            </div>

            {/* Table Body */}
            <div>
              {account.realms.map((realmId) => {
                const role = account.roles[realmId] || "member";
                const roleColor = roleColors[role] || "var(--color-border)";
                return (
                  <div
                    key={realmId}
                    className="grid grid-cols-12 gap-4 px-4 py-4 items-center transition-all duration-150 hover:translate-x-[2px] cursor-pointer"
                    style={{
                      borderBottom: "1px solid var(--color-border)",
                      backgroundColor: "var(--color-bg)",
                    }}
                    onClick={() => navigate(`/realms/${realmId}`)}
                    onMouseEnter={(e) => {
                      e.currentTarget.style.backgroundColor = "var(--color-surface)";
                      e.currentTarget.style.borderLeftWidth = "4px";
                      e.currentTarget.style.borderLeftColor = "var(--color-blue)";
                      e.currentTarget.style.borderLeftStyle = "solid";
                    }}
                    onMouseLeave={(e) => {
                      e.currentTarget.style.backgroundColor = "var(--color-bg)";
                      e.currentTarget.style.borderLeftWidth = "0px";
                    }}
                  >
                    <div className="col-span-6">
                      <span className="font-mono text-sm">{realmId}</span>
                    </div>
                    <div className="col-span-3">
                      <span
                        className="text-xs uppercase tracking-wider px-2 py-1 font-semibold"
                        style={{
                          color: roleColor,
                          border: `1px solid ${roleColor}`,
                        }}
                      >
                        {role}
                      </span>
                    </div>
                    <div className="col-span-3">
                      <span
                        className="text-xs uppercase tracking-wider"
                        style={{ color: "var(--color-text-muted)" }}
                      >
                        View Realm
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
