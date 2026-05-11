"use client";

import { useCallback, useEffect, useState } from "react";
import { Button } from "@base-ui/react/button";
import { navigate } from "@/lib/router";
import { useAuth } from "../../lib/auth";
import { useToast } from "../../lib/toast";
import { api } from "../../lib/api";
import { Dialog } from "../../components/Dialog/Dialog";
import { PATList } from "./PATList";
import type { PatEntry } from "../../types/account";

const Page = () => {
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
    realms,
    realmNames,
    isSysadmin,
  } = useAuth();
  const { showToast } = useToast();

  const fetchPATs = useCallback(async () => {
    if (!accountId) {
      return;
    }

    setIsLoadingPATs(true);
    try {
      const data = await api.getPATs(accountId);
      setPATs(data);
    } catch {
      showToast("Error", "Failed to load PATs", "error");
    } finally {
      setIsLoadingPATs(false);
    }
  }, [accountId, showToast]);

  useEffect(() => {
    if (authLoading) {
      return;
    }

    if (!isAuthenticated) {
      navigate("/login");
      return;
    }

    fetchPATs();
  }, [authLoading, isAuthenticated, fetchPATs]);

  const handleCreatePAT = async () => {
    if (!accountId) {
      return;
    }

    setIsCreatingPAT(true);
    try {
      const result = await api.createPAT(accountId);
      setNewPAT(result.pat);
      await fetchPATs();
      showToast("Success", "PAT created successfully", "success");
    } catch {
      showToast("Error", "Failed to create PAT", "error");
    } finally {
      setIsCreatingPAT(false);
    }
  };

  const handleRevokePAT = async (patId: string) => {
    if (!accountId) {
      return;
    }

    setRevokingPATId(patId);
    try {
      await api.revokePAT(accountId, patId);
      setPATs((prevPats) => prevPats.filter((pat) => pat.id !== patId));
      showToast("Success", "PAT revoked successfully", "success");
    } catch {
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
        <h2 className="text-xl font-bold uppercase tracking-wide mb-6">Profile Information</h2>

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
                backgroundColor: isSysadmin ? "var(--color-purple)" : "var(--color-surface)",
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
      </div>

      {/* PAT Creation Section */}
      {isSysadmin && (
        <div
          className="p-6 mb-6"
          style={{
            backgroundColor: "var(--color-bg)",
            border: "2px solid var(--color-border)",
            boxShadow: "var(--shadow-soft)",
          }}
        >
          <h2 className="text-xl font-bold uppercase tracking-wide mb-6">
            Create Personal Access Token
          </h2>

          {newPAT ? (
            <div
              className="p-4"
              style={{
                backgroundColor: "var(--color-green)",
                border: "2px solid var(--color-border)",
              }}
            >
              <div className="font-mono text-sm mb-2">{newPAT}</div>
              <p className="text-xs mb-3">Copy this token immediately - it won't be shown again!</p>
              <div className="flex gap-2">
                <Button
                  onClick={() => copyToClipboard(newPAT)}
                  className="px-3 py-1 text-xs font-bold uppercase tracking-wider"
                  style={{
                    backgroundColor: "var(--color-blue)",
                    border: "2px solid var(--color-border)",
                    color: "white",
                  }}
                >
                  Copy Token
                </Button>
                <Button
                  onClick={() => setNewPAT(null)}
                  className="px-3 py-1 text-xs font-bold uppercase tracking-wider"
                  style={{
                    backgroundColor: "var(--color-gray)",
                    border: "2px solid var(--color-border)",
                    color: "var(--color-text)",
                  }}
                >
                  Create Another
                </Button>
              </div>
            </div>
          ) : (
            <div className="flex items-center justify-between">
              <p className="text-sm" style={{ color: "var(--color-border)" }}>
                Create a new Personal Access Token for API access
              </p>
              <Button
                onClick={handleCreatePAT}
                disabled={isCreatingPAT}
                className="px-4 py-2 text-xs font-bold uppercase tracking-wider disabled:opacity-50"
                style={{
                  backgroundColor: "var(--color-green)",
                  border: "2px solid var(--color-border)",
                  color: "white",
                }}
              >
                {isCreatingPAT ? "Creating..." : "Create PAT"}
              </Button>
            </div>
          )}
        </div>
      )}

      {/* PAT List */}
      <div
        className="p-6"
        style={{
          backgroundColor: "var(--color-bg)",
          border: "2px solid var(--color-border)",
          boxShadow: "var(--shadow-soft)",
        }}
      >
        <h2 className="text-xl font-bold uppercase tracking-wide mb-6">Personal Access Tokens</h2>

        <PATList
          isLoadingPATs={isLoadingPATs}
          pats={pats}
          revokingPATId={revokingPATId}
          onSetPatToRevoke={setPatToRevoke}
          formatDate={formatDate}
        />
      </div>

      {/* Revoke Confirmation Dialog */}
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
};

export { Page };
