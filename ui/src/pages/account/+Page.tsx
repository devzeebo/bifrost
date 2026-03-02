"use client";

import { useEffect, useState } from "react";
import { Button } from "@base-ui/react/button";
import { navigate } from "@/lib/router";
import { useAuth } from "../../lib/auth";
import { useToast } from "../../lib/toast";
import { api } from "../../lib/api";
import { Dialog } from "../../components/Dialog/Dialog";
import type { PatEntry } from "../../types/account";

export { Page };

function Page() {
  const [pats, setPATs] = useState<PatEntry[]>([]);
  const [isLoadingPATs, setIsLoadingPATs] = useState(true);
  const [newPAT, setNewPAT] = useState<string | null>(null);
  const [isCreatingPAT, setIsCreatingPAT] = useState(false);
  const [revokingPATId, setRevokingPATId] = useState<string | null>(null);
  const [patToRevoke, setPatToRevoke] = useState<string | null>(null);

  const {
    isAuthenticated,
    loading: authLoading,
    accountId,
    username,
    roles,
    realms,
    realmNames,
    isSysadmin,
  } = useAuth();
  const { showToast } = useToast();

  useEffect(() => {
    if (authLoading) return;

    if (!isAuthenticated) {
      navigate("/login");
      return;
    }

    fetchPATs();
  }, [authLoading, isAuthenticated]);

  const fetchPATs = async () => {
    if (!accountId) return;

    setIsLoadingPATs(true);
    try {
      const data = await api.getPATs(accountId);
      setPATs(data);
    } catch (error) {
      showToast("Error", "Failed to load PATs", "error");
    } finally {
      setIsLoadingPATs(false);
    }
  };

  const handleCreatePAT = async () => {
    if (!accountId) return;

    setIsCreatingPAT(true);
    try {
      const result = await api.createPAT(accountId);
      setNewPAT(result.pat);
      await fetchPATs();
      showToast("Success", "PAT created successfully", "success");
    } catch (error) {
      showToast("Error", "Failed to create PAT", "error");
    } finally {
      setIsCreatingPAT(false);
    }
  };

  const handleRevokePAT = async (patId: string) => {
    if (!accountId) return;

    setRevokingPATId(patId);
    try {
      await api.revokePAT(accountId, patId);
      setPATs((prev) => prev.filter((p) => p.id !== patId));
      showToast("Success", "PAT revoked successfully", "success");
    } catch (error) {
      showToast("Error", "Failed to revoke PAT", "error");
    } finally {
      setRevokingPATId(null);
      setPatToRevoke(null);
    }
  };

  const copyToClipboard = async (text: string) => {
    try {
      await navigator.clipboard.writeText(text);
      showToast("Copied", "PAT copied to clipboard", "success");
    } catch {
      showToast("Error", "Failed to copy to clipboard", "error");
    }
  };

  const formatDate = (dateStr: string) => {
    const date = new Date(dateStr);
    return date.toLocaleDateString("en-US", {
      year: "numeric",
      month: "short",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  };

  if (authLoading) {
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

  return (
    <div className="min-h-[calc(100vh-56px)] p-6">
      {/* Header */}
      <div className="mb-8">
        <h1
          className="text-4xl font-bold tracking-tight uppercase"
          style={{ color: "var(--color-purple)" }}
        >
          Account
        </h1>
        <p
          className="text-sm uppercase tracking-widest mt-1"
          style={{ color: "var(--color-border)" }}
        >
          Manage your profile and access tokens
        </p>
      </div>

      {/* User Info Section */}
      <div
        className="p-6 mb-6"
        style={{
          backgroundColor: "var(--color-bg)",
          border: "2px solid var(--color-border)",
              boxShadow: "var(--shadow-soft)",
        }}
      >
        <h2 className="text-xl font-bold uppercase tracking-wide mb-6">
          Profile Information
        </h2>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* Username */}
          <div>
            <label
              className="block text-xs uppercase tracking-wider font-semibold mb-2"
              style={{ color: "var(--color-border)" }}
            >
              Username
            </label>
            <div
              className="p-3 font-mono text-lg"
              style={{
                backgroundColor: "var(--color-surface)",
                border: "2px solid var(--color-border)",
              }}
            >
              {username}
            </div>
          </div>

          {/* Account ID */}
          <div>
            <label
              className="block text-xs uppercase tracking-wider font-semibold mb-2"
              style={{ color: "var(--color-border)" }}
            >
              Account ID
            </label>
            <div
              className="p-3 font-mono text-sm truncate"
              style={{
                backgroundColor: "var(--color-surface)",
                border: "2px solid var(--color-border)",
              }}
            >
              {accountId}
            </div>
          </div>

          {/* Admin Status */}
          <div>
            <label
              className="block text-xs uppercase tracking-wider font-semibold mb-2"
              style={{ color: "var(--color-border)" }}
            >
              System Admin
            </label>
            <div
              className="p-3 font-bold uppercase"
              style={{
                backgroundColor: isSysadmin
                  ? "var(--color-purple)"
                  : "var(--color-surface)",
                border: "2px solid var(--color-border)",
                color: isSysadmin ? "white" : "var(--color-border)",
              }}
            >
              {isSysadmin ? "Yes" : "No"}
            </div>
          </div>

          {/* Realms */}
          <div>
            <label
              className="block text-xs uppercase tracking-wider font-semibold mb-2"
              style={{ color: "var(--color-border)" }}
            >
              Realms ({realms.length})
            </label>
            <div
              className="p-3 min-h-[48px] flex flex-wrap gap-2"
              style={{
                backgroundColor: "var(--color-surface)",
                border: "2px solid var(--color-border)",
              }}
            >
              {realms.length === 0 ? (
                <span style={{ color: "var(--color-border)" }}>None</span>
              ) : (
                realms.map((realmId) => (
                  <span
                    key={realmId}
                    className="px-2 py-1 text-xs font-bold uppercase"
                    style={{
                      backgroundColor: "var(--color-purple)",
                      color: "white",
                      border: "1px solid var(--color-border)",
                    }}
                  >
                    {realmNames[realmId] || realmId}
                  </span>
                ))
              )}
            </div>
          </div>
        </div>

        {/* Roles by Realm */}
        <div className="mt-6">
          <label
            className="block text-xs uppercase tracking-wider font-semibold mb-2"
            style={{ color: "var(--color-border)" }}
          >
            Roles
          </label>
          <div
            className="p-3 space-y-2"
            style={{
              backgroundColor: "var(--color-surface)",
              border: "2px solid var(--color-border)",
            }}
          >
            {Object.entries(roles).length === 0 ? (
              <span style={{ color: "var(--color-border)" }}>No roles assigned</span>
            ) : (
              Object.entries(roles).map(([realmId, role]) => (
                <div
                  key={realmId}
                  className="flex items-center justify-between p-2"
                  style={{ border: "1px solid var(--color-border)" }}
                >
                  <span className="font-mono text-sm">
                    {realmNames[realmId] || realmId}
                  </span>
                  <span
                    className="px-2 py-1 text-xs font-bold uppercase"
                    style={{
                      backgroundColor: "var(--color-purple)",
                      color: "white",
                    }}
                  >
                    {role}
                  </span>
                </div>
              ))
            )}
          </div>
        </div>
      </div>

      {/* PAT Section */}
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
            Personal Access Tokens
          </h2>
          <Button
            onClick={handleCreatePAT}
            disabled={isCreatingPAT || !isSysadmin}
            className="px-4 py-2 text-xs font-bold uppercase tracking-wider transition-all duration-150 disabled:opacity-50 disabled:cursor-not-allowed"
            style={{
              backgroundColor: "var(--color-purple)",
              border: "2px solid var(--color-border)",
              color: "white",
              boxShadow: "var(--shadow-soft)",
            }}
            onMouseEnter={(e) => {
              if (!isCreatingPAT && isSysadmin) {
                  e.currentTarget.style.boxShadow = "var(--shadow-soft-hover)";
                e.currentTarget.style.transform = "translate(2px, 2px)";
              }
            }}
            onMouseLeave={(e) => {
                  e.currentTarget.style.boxShadow = "var(--shadow-soft)";
              e.currentTarget.style.transform = "translate(0, 0)";
            }}
          >
            {isCreatingPAT ? "Creating..." : "Create PAT"}
          </Button>
        </div>

        {!isSysadmin && (
          <div
            className="p-4 mb-4"
            style={{
              backgroundColor: "var(--color-surface)",
              border: "2px solid var(--color-border)",
            }}
          >
            <p className="text-sm" style={{ color: "var(--color-border)" }}>
              PAT management requires system admin privileges. Contact your administrator.
            </p>
          </div>
        )}

        {/* New PAT Display */}
        {newPAT && (
          <div
            className="p-4 mb-6"
            style={{
              backgroundColor: "var(--color-green)",
              border: "2px solid var(--color-border)",
              boxShadow: "var(--shadow-soft)",
            }}
          >
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs font-bold uppercase tracking-wider text-white">
                New PAT Created - Copy Now!
              </span>
              <Button
                onClick={() => setNewPAT(null)}
                className="text-white hover:opacity-75"
              >
                &#10005;
              </Button>
            </div>
            <div className="flex items-center gap-2">
              <code
                className="flex-1 p-2 text-sm font-mono break-all"
                style={{
                  backgroundColor: "rgba(255,255,255,0.9)",
                  border: "1px solid var(--color-border)",
                }}
              >
                {newPAT}
              </code>
              <Button
                onClick={() => copyToClipboard(newPAT)}
                className="px-3 py-2 text-xs font-bold uppercase"
                style={{
                  backgroundColor: "white",
                  border: "2px solid var(--color-border)",
              boxShadow: "var(--shadow-soft)",
                }}
              >
                Copy
              </Button>
            </div>
            <p className="text-xs mt-2 text-white opacity-80">
              This token will only be shown once. Store it securely.
            </p>
          </div>
        )}

        {/* PAT List */}
        {isLoadingPATs ? (
          <div className="text-center py-8">
            <span style={{ color: "var(--color-border)" }}>Loading PATs...</span>
          </div>
        ) : pats.length === 0 ? (
          <div
            className="text-center py-8"
            style={{ color: "var(--color-border)" }}
          >
            <p className="text-sm uppercase tracking-wider">
              No PATs found. Create one to get started.
            </p>
          </div>
        ) : (
          <div className="space-y-2">
            {pats.map((pat) => (
              <div
                key={pat.id}
                className="flex items-center justify-between p-4 transition-all duration-150"
                style={{
                  backgroundColor: "var(--color-surface)",
                  border: "2px solid var(--color-border)",
                }}
              >
                <div className="flex items-center gap-4">
                  <div
                    className="w-3 h-3"
                    style={{ backgroundColor: "var(--color-purple)" }}
                  />
                  <div>
                    <code className="font-mono text-sm">{pat.id}</code>
                    <div className="flex items-center gap-4 mt-1">
                      <span
                        className="text-xs"
                        style={{ color: "var(--color-border)" }}
                      >
                        Created: {formatDate(pat.created_at)}
                      </span>
                      {pat.last_used && (
                        <span
                          className="text-xs"
                          style={{ color: "var(--color-border)" }}
                        >
                          Last used: {formatDate(pat.last_used)}
                        </span>
                      )}
                    </div>
                  </div>
                </div>
                <Button
                  onClick={() => setPatToRevoke(pat.id)}
                  disabled={revokingPATId === pat.id}
                  className="px-3 py-1 text-xs font-bold uppercase tracking-wider transition-all duration-150 disabled:opacity-50"
                  style={{
                    backgroundColor: "var(--color-red)",
                    border: "2px solid var(--color-border)",
                    color: "white",
              boxShadow: "var(--shadow-soft)",
                  }}
                  onMouseEnter={(e) => {
                    if (revokingPATId !== pat.id) {
                    e.currentTarget.style.boxShadow = "var(--shadow-soft-hover)";
                      e.currentTarget.style.transform = "translate(1px, 1px)";
                    }
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.boxShadow = "var(--shadow-soft-hover)";
                    e.currentTarget.style.transform = "translate(0, 0)";
                  }}
                >
                  {revokingPATId === pat.id ? "Revoking..." : "Revoke"}
                </Button>
              </div>
            ))}
          </div>
        )}
      </div>

      <Dialog
        open={patToRevoke !== null}
        onClose={() => setPatToRevoke(null)}
        title="Revoke PAT"
        description="Are you sure you want to revoke this PAT? This action cannot be undone."
        confirmLabel={revokingPATId ? "Revoking..." : "Revoke"}
        cancelLabel="Cancel"
        onConfirm={() => (patToRevoke ? handleRevokePAT(patToRevoke) : Promise.resolve())}
        color="red"
      />
    </div>
  );
}
