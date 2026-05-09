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

type FormState = {
  title: string;
  description: string;
  priority: number;
  branch: string;
};

const Page = () => {
  const pageContext = usePageContext();
  const runeId = pageContext.routeParams?.id as string;
  const { isAuthenticated, loading: authLoading } = useAuth();
  const { currentRealm } = useRealm();
  const { showToast } = useToast();

  const [formData, setFormData] = useState<FormState>({
    title: "",
    description: "",
    priority: 1,
    branch: "",
  });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!isAuthenticated || authLoading) {
      return;
    }

    const loadRune = async () => {
      try {
        setLoading(true);
        const rune = await api.getRune(currentRealm, runeId);
        setFormData({
          title: rune.title,
          description: rune.description || "",
          priority: rune.priority,
          branch: rune.branch || "",
        });
      } catch (err) {
        console.error("Failed to load rune:", err);
        setError("Failed to load rune data");
      } finally {
        setLoading(false);
      }
    };

    loadRune();
  }, [isAuthenticated, authLoading, currentRealm, runeId]);

  const handleInputChange = (field: keyof FormState, value: string | number) => {
    setFormData((prev) => ({ ...prev, [field]: value }));
  };

  const onSave = async () => {
    if (!isAuthenticated || !currentRealm) {
      return;
    }

    setSaving(true);
    try {
      await api.updateRune(
        runeId,
        {
          title: formData.title,
          description: formData.description,
          priority: formData.priority,
          branch: formData.branch,
        },
        currentRealm,
      );

      showToast({ title: "Success", description: "Rune updated successfully", type: "success" });
      navigate(`/runes/${runeId}`);
    } catch (err) {
      console.error("Failed to update rune:", err);
      const errorMessage = err instanceof ApiError ? err.message : "Failed to update rune";
      showToast({ title: "Error", description: errorMessage, type: "error" });
    } finally {
      setSaving(false);
    }
  };

  const canSave = formData.title.trim() !== "" && isAuthenticated && Boolean(currentRealm);

  if (authLoading || loading) {
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
          <p>Please log in to edit runes.</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-[calc(100vh-56px)] flex items-center justify-center p-6">
        <div className="text-center p-6 border border-red-500 rounded">
          <h2 className="text-xl font-bold mb-2">Error</h2>
          <p>{error}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-[calc(100vh-56px)] p-6">
      <div className="max-w-4xl mx-auto">
        <div className="mb-6">
          <h1 className="text-3xl font-bold">Edit Rune</h1>
          <p className="text-gray-600">Update the details for rune {runeId}</p>
        </div>

        <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-300 dark:border-gray-600 p-6">
          <div className="mb-6">
            <label
              htmlFor="rune-edit-title"
              className="text-xs uppercase tracking-wider block mb-2 font-bold"
            >
              Title *
            </label>
            <Input
              id="rune-edit-title"
              value={formData.title}
              onChange={(event) => handleInputChange("title", event.target.value)}
              placeholder="Enter rune title"
              className="w-full"
              style={{
                backgroundColor: "var(--color-bg)",
                border: "2px solid var(--color-border)",
                color: "var(--color-text)",
              }}
            />
          </div>

          <div className="mb-6">
            <label
              htmlFor="rune-edit-description"
              className="text-xs uppercase tracking-wider block mb-2 font-bold"
            >
              Description
            </label>
            <textarea
              id="rune-edit-description"
              value={formData.description}
              onChange={(event) => handleInputChange("description", event.target.value)}
              placeholder="Enter rune description"
              rows={4}
              className="w-full p-3 border border-gray-300 dark:border-gray-600 rounded-md"
              style={{
                backgroundColor: "var(--color-bg)",
                color: "var(--color-text)",
              }}
            />
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
            <div>
              <label
                htmlFor="rune-edit-priority"
                className="text-xs uppercase tracking-wider block mb-2 font-bold"
              >
                Priority
              </label>
              <Input
                id="rune-edit-priority"
                type="number"
                value={formData.priority}
                onChange={(event) =>
                  handleInputChange("priority", parseInt(event.target.value) || 1)
                }
                min="1"
                max="5"
                className="w-full"
                style={{
                  backgroundColor: "var(--color-bg)",
                  border: "2px solid var(--color-border)",
                  color: "var(--color-text)",
                }}
              />
            </div>

            <div>
              <label
                htmlFor="rune-edit-branch"
                className="text-xs uppercase tracking-wider block mb-2 font-bold"
              >
                Branch
              </label>
              <Input
                id="rune-edit-branch"
                value={formData.branch}
                onChange={(event) => handleInputChange("branch", event.target.value)}
                placeholder="Enter target branch"
                className="w-full"
                style={{
                  backgroundColor: "var(--color-bg)",
                  border: "2px solid var(--color-border)",
                  color: "var(--color-text)",
                }}
              />
            </div>
          </div>

          <div className="flex justify-end gap-3">
            <Button
              type="button"
              onClick={() => navigate(`/runes/${runeId}`)}
              className="px-6 py-3 text-sm font-bold uppercase tracking-wider"
              style={{
                backgroundColor: "var(--color-gray)",
                border: "2px solid var(--color-border)",
                color: "var(--color-text)",
              }}
            >
              Cancel
            </Button>
            <Button
              type="button"
              onClick={onSave}
              disabled={!canSave || saving}
              className="px-6 py-3 text-sm font-bold uppercase tracking-wider disabled:opacity-50 disabled:cursor-not-allowed"
              style={{
                backgroundColor: "var(--color-amber)",
                border: "2px solid var(--color-border)",
                color: "white",
              }}
            >
              {saving ? "Saving..." : "Save Changes"}
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
};

export { Page };
