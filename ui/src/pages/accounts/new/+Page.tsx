"use client";

import { useEffect, useState } from "react";
import { Button } from "@base-ui/react/button";
import { Input } from "@base-ui/react/input";
import { Select } from "@base-ui/react/select";
import { Toggle } from "@base-ui/react/toggle";
import { ToggleGroup } from "@base-ui/react/toggle-group";
import { navigate } from "@/lib/router";
import { useAuth } from "../../../lib/auth";
import { useToast } from "../../../lib/toast";
import { api } from "../../../lib/api";
import type { RealmListEntry } from "../../../types/realm";

export { Page };

type FormData = {
  username: string;
  realmId: string;
  role: "owner" | "admin" | "member" | "viewer";
};

const INITIAL_FORM: FormData = {
  username: "",
  realmId: "",
  role: "member",
};

const STEPS = [
  { id: 1, label: "Username", field: "username" as const },
  { id: 2, label: "Realm Access", field: "realm" as const },
  { id: 3, label: "Review", field: "review" as const },
];

function Page() {
  const { isAuthenticated, isSysadmin, loading: authLoading } = useAuth();
  const { showToast } = useToast();

  const [step, setStep] = useState(0);
  const [form, setForm] = useState<FormData>(INITIAL_FORM);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [realms, setRealms] = useState<RealmListEntry[]>([]);

  useEffect(() => {
    if (authLoading || !isAuthenticated || !isSysadmin) {
      return;
    }

    const loadRealms = async () => {
      try {
        const data = await api.getRealms();
        const eligibleRealms = data
          .map((realm) => {
            const realmWithLegacyId = realm as RealmListEntry & { realm_id?: string };
            const normalizedId = realm.id || realmWithLegacyId.realm_id;
            if (!normalizedId) {
              return null;
            }

            return {
              ...realm,
              id: normalizedId,
            };
          })
          .filter((realm): realm is RealmListEntry => realm !== null)
          .filter((realm) => realm.id !== "_admin");
        setRealms(eligibleRealms);
        setForm((prev) => ({
          ...prev,
          realmId: prev.realmId || eligibleRealms[0]?.id || "",
        }));
      } catch {
        setRealms([]);
      }
    };

    void loadRealms();
  }, [authLoading, isAuthenticated, isSysadmin]);

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

  if (!isSysadmin) {
    navigate("/dashboard");
    return null;
  }

  const updateForm = <K extends keyof FormData>(field: K, value: FormData[K]) => {
    setForm((prev) => ({ ...prev, [field]: value }));
  };

  const canProceed = () => {
    switch (step) {
      case 0:
        return form.username.trim().length >= 2;
      case 1:
        return form.realmId.trim().length > 0 && form.role.trim().length > 0;
      case 2:
        return true;
      default:
        return false;
    }
  };

  const handleSubmit = async () => {
    setIsSubmitting(true);

    try {
      const result = await api.createAdminAccount(form.username.trim());
      showToast("Account Created", `"${form.username}" has been created`, "success");

      try {
        await api.grantRealmAccess({
          account_id: result.account_id,
          realm_id: form.realmId,
          role: form.role,
        });
      } catch {
        showToast(
          "Role Assignment Warning",
          "Account was created, but realm role assignment failed",
          "warning"
        );
      }

      navigate(`/accounts/${result.account_id}`);
    } catch {
      showToast("Error", "Failed to create account. Username may already exist.", "error");
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
        <button
          onClick={() => navigate("/accounts")}
          className="inline-flex items-center gap-2 text-sm font-bold uppercase tracking-wider mb-4 transition-all duration-150 hover:translate-x-[-2px]"
          style={{ color: "var(--color-text-muted)" }}
        >
          <span>&larr;</span>
          <span>Back to Accounts</span>
        </button>
        <h1
          className="text-4xl font-bold tracking-tight uppercase"
          style={{ color: "var(--color-blue)" }}
        >
          New Account
        </h1>
        <p
          className="text-sm uppercase tracking-widest mt-1"
          style={{ color: "var(--color-text-muted)" }}
        >
          Create a new user account
        </p>
      </div>

      {/* Progress Steps */}
      <div className="flex gap-1 mb-8">
        {STEPS.map((s, idx) => (
          <div
            key={s.id}
            className="flex-1 h-2 transition-all duration-300"
            style={{
              backgroundColor: idx <= step ? "var(--color-blue)" : "var(--color-surface)",
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
            style={{ color: "var(--color-blue)" }}
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
                Choose a username
              </label>
              <Input
                type="text"
                value={form.username}
                onChange={(e) => updateForm("username", e.target.value)}
                placeholder="e.g., alice, bob, developer-1"
                className="w-full px-4 py-3 text-lg outline-none transition-all duration-150"
                style={{
                  backgroundColor: "var(--color-surface)",
                  border: "2px solid var(--color-border)",
                  color: "var(--color-text)",
                }}
                onFocus={(e) => {
                  e.currentTarget.style.borderLeftWidth = "4px";
                  e.currentTarget.style.borderLeftColor = "var(--color-blue)";
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
                {form.username.length}/50 characters (minimum 2)
              </p>
            </div>
          )}

          {step === 1 && (
            <div>
              <label
                className="text-xs uppercase tracking-wider block mb-2 font-bold"
                style={{ color: "var(--color-text-muted)" }}
              >
                Select realm
              </label>
              <Select.Root
                items={Object.fromEntries(realms.map((realm) => [realm.id, realm.name]))}
                value={form.realmId || null}
                onValueChange={(value) => {
                  if (typeof value === "string") {
                    updateForm("realmId", value);
                  }
                }}
              >
                <Select.Trigger
                  className="w-full px-4 py-3 text-base outline-none transition-all duration-150 mb-4"
                  style={{
                    backgroundColor: "var(--color-surface)",
                    border: "2px solid var(--color-border)",
                    color: "var(--color-text)",
                  }}
                >
                  <Select.Value placeholder="Select realm" />
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
                        {realms.map((realm) => (
                          <Select.Item
                            key={realm.id}
                            value={realm.id}
                            onClick={() => updateForm("realmId", realm.id)}
                            className="px-3 py-2 text-sm font-semibold cursor-pointer"
                          >
                            <Select.ItemText>{realm.name}</Select.ItemText>
                          </Select.Item>
                        ))}
                      </Select.List>
                    </Select.Popup>
                  </Select.Positioner>
                </Select.Portal>
              </Select.Root>

              <label
                className="text-xs uppercase tracking-wider block mb-2 font-bold"
                style={{ color: "var(--color-text-muted)" }}
              >
                Select role
              </label>
              <ToggleGroup
                value={[form.role]}
                onValueChange={(values) => {
                  const nextRole = values[0];
                  if (nextRole) {
                    updateForm("role", nextRole as FormData["role"]);
                  }
                }}
                className="grid grid-cols-2 gap-2"
              >
                {(["owner", "admin", "member", "viewer"] as const).map((role) => (
                  <Toggle
                    key={role}
                    value={role}
                    className="px-3 py-2 text-xs font-bold uppercase tracking-wider transition-all duration-150"
                    style={{
                      backgroundColor: form.role === role ? "var(--color-blue)" : "var(--color-bg)",
                      border: "2px solid var(--color-border)",
                      color: form.role === role ? "white" : "var(--color-text)",
                    }}
                  >
                    {role}
                  </Toggle>
                ))}
              </ToggleGroup>

              <p
                className="text-sm mb-6"
                style={{ color: "var(--color-text-muted)" }}
              >
                This account will be granted access to the selected realm with the chosen role.
              </p>
            </div>
          )}

          {step === 2 && (
            <div>
              <p
                className="text-sm mb-6"
                style={{ color: "var(--color-text-muted)" }}
              >
                Review the account details before creating.
              </p>

              {/* Summary Card */}
              <div
                className="p-6"
                style={{
                  backgroundColor: "var(--color-surface)",
                  border: "2px solid var(--color-border)",
                }}
              >
                <h3
                  className="text-xs uppercase tracking-wider font-bold mb-4"
                  style={{ color: "var(--color-text-muted)" }}
                >
                  Account Summary
                </h3>
                <div className="space-y-4">
                  <div className="flex justify-between items-center py-2 border-b border-dashed" style={{ borderColor: "var(--color-border)" }}>
                    <span style={{ color: "var(--color-text-muted)" }}>Username</span>
                    <span className="font-bold text-lg">{form.username}</span>
                  </div>
                  <div className="flex justify-between items-center py-2 border-b border-dashed" style={{ borderColor: "var(--color-border)" }}>
                    <span style={{ color: "var(--color-text-muted)" }}>Realm</span>
                    <span className="font-mono text-sm">{form.realmId}</span>
                  </div>
                  <div className="flex justify-between items-center py-2 border-b border-dashed" style={{ borderColor: "var(--color-border)" }}>
                    <span style={{ color: "var(--color-text-muted)" }}>Role</span>
                    <span className="font-bold uppercase">{form.role}</span>
                  </div>
                  <div className="flex justify-between items-center py-2">
                    <span style={{ color: "var(--color-text-muted)" }}>Initial PAT</span>
                    <span className="text-sm" style={{ color: "var(--color-text-muted)" }}>
                      Will be generated automatically
                    </span>
                  </div>
                </div>
              </div>

              <p
                className="text-xs mt-4"
                style={{ color: "var(--color-text-muted)" }}
              >
                A Personal Access Token (PAT) will be generated for this account. 
                You can share it with the user to allow them to authenticate.
              </p>
            </div>
          )}
        </div>

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
              backgroundColor: "var(--color-blue)",
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
                ? "Create Account"
                : "Next"}
          </Button>
        </div>
      </div>
    </div>
  );
}
