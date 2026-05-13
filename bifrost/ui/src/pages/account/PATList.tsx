"use client";

import { Button } from "@base-ui/react/button";
import type { PatEntry } from "../../types/account";

type PATListProps = {
  isLoadingPATs: boolean;
  pats: PatEntry[];
  revokingPATId: string | null;
  onSetPatToRevoke: (patId: string) => void;
  formatDate: (dateStr: string) => string;
};

export const PATList = ({
  isLoadingPATs,
  pats,
  revokingPATId,
  onSetPatToRevoke,
  formatDate,
}: PATListProps) => {
  if (isLoadingPATs) {
    return (
      <div className="text-center py-8">
        <span style={{ color: "var(--color-border)" }}>Loading PATs...</span>
      </div>
    );
  }

  if (pats.length === 0) {
    return (
      <div className="text-center py-8" style={{ color: "var(--color-border)" }}>
        <p className="text-sm uppercase tracking-wider">
          No PATs found. Create one to get started.
        </p>
      </div>
    );
  }

  return (
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
            <div className="w-3 h-3" style={{ backgroundColor: "var(--color-purple)" }} />
            <div>
              <code className="font-mono text-sm">{pat.id}</code>
              <div className="flex items-center gap-4 mt-1">
                <span className="text-xs" style={{ color: "var(--color-border)" }}>
                  Created: {formatDate(pat.created_at)}
                </span>
                {pat.last_used && (
                  <span className="text-xs" style={{ color: "var(--color-border)" }}>
                    Last used: {formatDate(pat.last_used)}
                  </span>
                )}
              </div>
            </div>
          </div>
          <Button
            onClick={() => onSetPatToRevoke(pat.id)}
            disabled={revokingPATId === pat.id}
            className="px-3 py-1 text-xs font-bold uppercase tracking-wider transition-all duration-150 disabled:opacity-50"
            style={{
              backgroundColor: "var(--color-red)",
              border: "2px solid var(--color-border)",
              color: "white",
              boxShadow: "var(--shadow-soft)",
            }}
            onMouseEnter={(_event) => {
              if (revokingPATId !== pat.id) {
                _event.currentTarget.style.boxShadow = "var(--shadow-soft-hover)";
                _event.currentTarget.style.transform = "translate(1px, 1px)";
              }
            }}
            onMouseLeave={(_event) => {
              _event.currentTarget.style.boxShadow = "var(--shadow-soft-hover)";
              _event.currentTarget.style.transform = "translate(0, 0)";
            }}
          >
            {revokingPATId === pat.id ? "Revoking..." : "Revoke"}
          </Button>
        </div>
      ))}
    </div>
  );
};
