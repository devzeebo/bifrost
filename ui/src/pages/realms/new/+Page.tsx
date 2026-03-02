"use client";

import { useState } from "react";
import { Button } from "@base-ui/react/button";
import { Input } from "@base-ui/react/input";
import { navigate } from "@/lib/router";
import { useAuth } from "../../../lib/auth";
import { useToast } from "../../../lib/toast";
import { api } from "../../../lib/api";

export { Page };

type FormData = {
  name: string;
  description: string;
};

const INITIAL_FORM: FormData = {
  name: "",
  description: "",
};

const STEPS = [
  { id: 1, label: "Name", field: "name" as const },
  { id: 2, label: "Description", field: "description" as const },
];

function Page() {
  const { isAuthenticated, loading: authLoading } = useAuth();
  const { showToast } = useToast();

  const [step, setStep] = useState(0);
  const [form, setForm] = useState<FormData>(INITIAL_FORM);
  const [isSubmitting, setIsSubmitting] = useState(false);

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

  if (!isAuthenticated) {
    navigate("/login");
    return null;
  }

  const updateForm = <K extends keyof FormData>(field: K, value: FormData[K]) => {
    setForm((prev) => ({ ...prev, [field]: value }));
  };

  const canProceed = () => {
    switch (step) {
      case 0:
        return form.name.trim().length >= 2;
      case 1:
        return true; // Description is optional
      default:
        return false;
    }
  };

  const handleSubmit = async () => {
    setIsSubmitting(true);

    try {
      const realm = await api.createRealm({
        name: form.name.trim(),
        description: form.description.trim() || "",
      });
      showToast("Realm Created", `"${realm.name}" has been created`, "success");
      navigate(`/realms/${realm.id}`);
    } catch (error) {
      showToast("Error", "Failed to create realm", "error");
      setIsSubmitting(false);
    }
  };

  const nextStep = () => {
    if (step < STEPS.length - 1) {
      setStep(step + 1);
    } else {
      handleSubmit();
    }
  };

  const prevStep = () => {
    if (step > 0) {
      setStep(step - 1);
    }
  };


  return (
    <div className="min-h-[calc(100vh-56px)] p-6">
      {/* Header */}
      <div className="mb-8">
        <Button
          onClick={() => navigate("/realms")}
          className="inline-flex items-center gap-2 text-sm font-bold uppercase tracking-wider mb-4 transition-all duration-150 hover:translate-x-[-2px]"
          style={{ color: "var(--color-text-muted)" }}
        >
          <span>&larr;</span>
          <span>Back to Realms</span>
        </Button>
        <h1
          className="text-4xl font-bold tracking-tight uppercase"
          style={{ color: "var(--color-green)" }}
        >
          New Realm
        </h1>
        <p
          className="text-sm uppercase tracking-widest mt-1"
          style={{ color: "var(--color-text-muted)" }}
        >
          Create a new workspace for your project
        </p>
      </div>

      {/* Progress Steps */}
      <div className="flex gap-1 mb-8">
        {STEPS.map((s, idx) => (
          <div
            key={s.id}
            className="flex-1 h-2 transition-all duration-300"
            style={{
              backgroundColor: idx <= step ? "var(--color-green)" : "var(--color-surface)",
              border: "1px solid var(--color-border)",
            }}
          />
        ))}
      </div>

      {/* Wizard Card */}
      <div
        className="max-w-2xl mx-auto p-8"
        style={{
          backgroundColor: "var(--color-bg)",
          border: "2px solid var(--color-border)",
            boxShadow: "var(--shadow-soft)",
        }}
      >
        {/* Step Title */}
        <div className="mb-6 flex items-center justify-between">
          <h2
            className="text-2xl font-bold uppercase tracking-tight"
            style={{ color: "var(--color-green)" }}
          >
            {STEPS[step].label}
          </h2>
          <span
            className="text-xs font-bold uppercase tracking-wider px-2 py-1"
            style={{
              backgroundColor: "var(--color-surface)",
              border: "1px solid var(--color-border)",
              color: "var(--color-text-muted)",
            }}
          >
            Step {step + 1} of {STEPS.length}
          </span>
        </div>

        {/* Step Content */}
        <div className="mb-8 min-h-[200px]">
          {step === 0 && (
            <div>
              <label
                className="text-xs uppercase tracking-wider block mb-2 font-bold"
                style={{ color: "var(--color-text-muted)" }}
              >
                What's the name of your realm?
              </label>
              <Input
                type="text"
                value={form.name}
                onChange={(e) => updateForm("name", e.target.value)}
                placeholder="e.g., my-project, acme-corp, team-alpha"
                className="w-full px-4 py-3 text-lg outline-none transition-all duration-150"
                style={{
                  backgroundColor: "var(--color-surface)",
                  border: "2px solid var(--color-border)",
                  color: "var(--color-text)",
                }}
                onFocus={(e) => {
                  e.currentTarget.style.borderLeftWidth = "4px";
                  e.currentTarget.style.borderLeftColor = "var(--color-green)";
                }}
                onBlur={(e) => {
                  e.currentTarget.style.borderLeftWidth = "2px";
                  e.currentTarget.style.borderLeftColor = "var(--color-border)";
                }}
                autoFocus
              />
              <p
                className="text-xs mt-2"
                style={{ color: "var(--color-text-muted)" }}
              >
                {form.name.length}/50 characters (minimum 2)
              </p>
            </div>
          )}

          {step === 1 && (
            <div>
              <label
                className="text-xs uppercase tracking-wider block mb-2 font-bold"
                style={{ color: "var(--color-text-muted)" }}
              >
                Describe your realm (optional)
              </label>
              <textarea
                value={form.description}
                onChange={(e) => updateForm("description", e.target.value)}
                placeholder="What is this realm for? Who will use it?"
                rows={6}
                className="w-full px-4 py-3 text-base outline-none resize-none transition-all duration-150"
                style={{
                  backgroundColor: "var(--color-surface)",
                  border: "2px solid var(--color-border)",
                  color: "var(--color-text)",
                }}
                onFocus={(e) => {
                  e.currentTarget.style.borderLeftWidth = "4px";
                  e.currentTarget.style.borderLeftColor = "var(--color-green)";
                }}
                onBlur={(e) => {
                  e.currentTarget.style.borderLeftWidth = "2px";
                  e.currentTarget.style.borderLeftColor = "var(--color-border)";
                }}
              />
            </div>
          )}
        </div>

        {/* Summary Preview (last step) */}
        {step === 1 && (
          <div
            className="mb-6 p-4"
            style={{
              backgroundColor: "var(--color-surface)",
              border: "1px solid var(--color-border)",
            }}
          >
            <h3
              className="text-xs uppercase tracking-wider font-bold mb-3"
              style={{ color: "var(--color-text-muted)" }}
            >
              Summary
            </h3>
            <div className="space-y-2 text-sm">
              <div className="flex justify-between">
                <span style={{ color: "var(--color-text-muted)" }}>Name:</span>
                <span className="font-medium">{form.name}</span>
              </div>
              <div className="flex justify-between">
                <span style={{ color: "var(--color-text-muted)" }}>Description:</span>
                <span className="font-medium truncate max-w-[200px]">
                  {form.description || "—"}
                </span>
              </div>
            </div>
          </div>
        )}

        {/* Navigation Buttons */}
        <div className="flex gap-4">
          <Button
            onClick={prevStep}
            disabled={step === 0}
            className="flex-1 px-6 py-4 text-sm font-bold uppercase tracking-wider transition-all duration-150 disabled:opacity-50 disabled:cursor-not-allowed"
            style={{
              backgroundColor: "var(--color-bg)",
              border: "2px solid var(--color-border)",
              color: "var(--color-text)",
              boxShadow: step === 0 ? "none" : "4px 4px 0px var(--color-border)",
            }}
            onMouseEnter={(e) => {
              if (step > 0) {
                e.currentTarget.style.boxShadow = "var(--shadow-soft-hover)";
                e.currentTarget.style.transform = "translate(2px, 2px)";
              }
            }}
            onMouseLeave={(e) => {
              if (step > 0) {
                e.currentTarget.style.boxShadow = "var(--shadow-soft)";
                e.currentTarget.style.transform = "translate(0, 0)";
              }
            }}
          >
            Back
          </Button>
          <Button
            onClick={nextStep}
            disabled={!canProceed() || isSubmitting}
            className="flex-1 px-6 py-4 text-sm font-bold uppercase tracking-wider transition-all duration-150 disabled:opacity-50 disabled:cursor-not-allowed"
            style={{
              backgroundColor: "var(--color-green)",
              border: "2px solid var(--color-border)",
              color: "white",
              boxShadow: canProceed() && !isSubmitting ? "4px 4px 0px var(--color-border)" : "none",
            }}
            onMouseEnter={(e) => {
              if (canProceed() && !isSubmitting) {
                e.currentTarget.style.boxShadow = "var(--shadow-soft-hover)";
                e.currentTarget.style.transform = "translate(2px, 2px)";
              }
            }}
            onMouseLeave={(e) => {
              if (canProceed() && !isSubmitting) {
                e.currentTarget.style.boxShadow = "var(--shadow-soft)";
                e.currentTarget.style.transform = "translate(0, 0)";
              }
            }}
          >
            {isSubmitting
              ? "Creating..."
              : step === STEPS.length - 1
                ? "Create Realm"
                : "Next"}
          </Button>
        </div>
      </div>
    </div>
  );
}
