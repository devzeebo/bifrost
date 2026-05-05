"use client";

import { useEffect, useState } from "react";
import { Button } from "@base-ui/react/button";
import { Input } from "@base-ui/react/input";
import { navigate } from "@/lib/router";
import { usePageContext } from "vike-react/usePageContext";
import { useAuth } from "../../../../lib/auth";
import { ApiError, api } from "../../../../lib/api";
import { useRealm } from "../../../../lib/realm";
import { useToast } from "../../../../lib/toast";

export { Page };

type FormState = {
  title: string;
  description: string;
  priority: number;
  branch: string;
};

function Page() {
  const pageContext = usePageContext();
  const runeId = pageContext.routeParams?.id as string;
  const { realms, isAuthenticated, loading: authLoading } = useAuth();
  const { currentRealm, availableRealms, isLoading: realmLoading } = useRealm();
  const { showToast } = useToast();
  const fallbackRealms = realms.filter((realmId) => realmId !== "_admin");
  const effectiveRealms = availableRealms.length > 0 ? availableRealms : fallbackRealms;
  const effectiveRealm =
    currentRealm && effectiveRealms.includes(currentRealm)
      ? currentRealm
      : (effectiveRealms[0] ?? null);

  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [form, setForm] = useState<FormState>({
    title: "",
    description: "",
    priority: 2,
    branch: "",
  });

  useEffect(() => {
    if (authLoading || realmLoading) {
      return;
    }

    if (!isAuthenticated) {
      navigate("/login");
      return;
    }

    if (!runeId || !effectiveRealm) {
      setIsLoading(false);
      return;
    }

    const loadRune = async () => {
      try {
        const rune = await api.getRune(effectiveRealm, runeId);
        setForm({
          title: rune.title,
          description: rune.description || "",
          priority: rune.priority,
          branch: rune.branch || "",
        });
      } catch {
        showToast("Error", "Failed to load rune", "error");
      } finally {
        setIsLoading(false);
      }
    };

    void loadRune();
  }, [authLoading, effectiveRealm, isAuthenticated, realmLoading, runeId, showToast]);

  const canSave = form.title.trim().length >= 3 && form.priority >= 1 && form.priority <= 4;

  const onSave = async () => {
    if (!effectiveRealm || !runeId || !canSave) {
      return;
    }

    setIsSaving(true);
    try {
      await api.updateRune(effectiveRealm, runeId, {
        title: form.title.trim(),
        description: form.description.trim(),
        priority: form.priority,
        branch: form.branch.trim(),
      });
      showToast("Rune Updated", "Your changes were saved", "success");
      navigate(`/runes/${runeId}`);
    } catch (error) {
      if (error instanceof ApiError) {
        showToast("Error", `Request failed (${error.status})`, "error");
      } else {
        showToast("Error", "Failed to update rune", "error");
      }
      setIsSaving(false);
    }
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

  return (
    <div className="min-h-[calc(100vh-56px)] p-6">
      <div className="mb-6">
        <Button
          onClick={() => navigate(`/runes/${runeId}`)}
          className="inline-flex items-center gap-2 text-sm font-bold uppercase tracking-wider"
          style={{ color: "var(--color-text-muted)" }}
        >
          <span>&larr;</span>
          <span>Back to Rune</span>
        </Button>
      </div>

      <div
        className="max-w-4xl mx-auto p-6 space-y-6"
        style={{
          backgroundColor: "var(--color-bg)",
          border: "2px solid var(--color-border)",
          boxShadow: "var(--shadow-soft)",
        }}
      >
        <h1 className="text-3xl font-bold uppercase tracking-tight" style={{ color: "var(--color-amber)" }}>
          Edit Rune
        </h1>

        <div>
          <label htmlFor="rune-edit-title" className="text-xs uppercase tracking-wider block mb-2 font-bold">
            Title
          </label>
          <Input
            id="rune-edit-title"
            value={form.title}
            onChange={(e) => setForm((prev) => ({ ...prev, title: e.target.value }))}
            className="w-full px-4 py-3 text-lg outline-none"
            style={{
              backgroundColor: "var(--color-surface)",
              border: "2px solid var(--color-border)",
              color: "var(--color-text)",
            }}
          />
        </div>

        <div>
          <label htmlFor="rune-edit-description" className="text-xs uppercase tracking-wider block mb-2 font-bold">
            Description
          </label>
          <textarea
            id="rune-edit-description"
            value={form.description}
            onChange={(e) => setForm((prev) => ({ ...prev, description: e.target.value }))}
            rows={6}
            className="w-full px-4 py-3 text-base outline-none resize-none"
            style={{
              backgroundColor: "var(--color-surface)",
              border: "2px solid var(--color-border)",
              color: "var(--color-text)",
            }}
          />
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label htmlFor="rune-edit-priority" className="text-xs uppercase tracking-wider block mb-2 font-bold">
              Priority (1-4)
            </label>
            <Input
              id="rune-edit-priority"
              type="number"
              min="1"
              max="4"
              value={String(form.priority)}
              onChange={(e) => {
                const value = Number(e.target.value);
                setForm((prev) => ({ ...prev, priority: Number.isFinite(value) ? value : prev.priority }));
              }}
              className="w-full px-4 py-3 text-base outline-none"
              style={{
                backgroundColor: "var(--color-surface)",
                border: "2px solid var(--color-border)",
                color: "var(--color-text)",
              }}
            />
          </div>

          <div>
            <label htmlFor="rune-edit-branch" className="text-xs uppercase tracking-wider block mb-2 font-bold">
              Branch
            </label>
            <Input
              id="rune-edit-branch"
              value={form.branch}
              onChange={(e) => setForm((prev) => ({ ...prev, branch: e.target.value }))}
              className="w-full px-4 py-3 text-base font-mono outline-none"
              style={{
                backgroundColor: "var(--color-surface)",
                border: "2px solid var(--color-border)",
                color: "var(--color-text)",
              }}
            />
          </div>
        </div>

        <div className="flex gap-3">
          <Button
            type="button"
            onClick={() => navigate(`/runes/${runeId}`)}
            className="px-6 py-3 text-sm font-bold uppercase tracking-wider"
            style={{
              backgroundColor: "var(--color-bg)",
              border: "2px solid var(--color-border)",
              color: "var(--color-text)",
            }}
          >
            Cancel
          </Button>
          <Button
            type="button"
            onClick={onSave}
            disabled={!canSave || isSaving}
            className="px-6 py-3 text-sm font-bold uppercase tracking-wider disabled:opacity-50 disabled:cursor-not-allowed"
            style={{
              backgroundColor: "var(--color-amber)",
              border: "2px solid var(--color-border)",
              color: "white",
            }}
          >
            {isSaving ? "Saving..." : "Save Changes"}
          </Button>
        </div>
      </div>
    </div>
  );
}
