"use client";

import { useState, useCallback } from "react";
import { Button } from "@base-ui/react/button";
import { Input } from "@base-ui/react/input";
import { navigate } from "@/lib/router";
import { useToast } from "../../lib/toast";
import { api } from "../../lib/api";
import type { CreateAdminResponse } from "../../types/session";

export { Page };

function Page() {
  const [username, setUsername] = useState("");
  const [realmName, setRealmName] = useState("");
  const [adminResponse, setAdminResponse] = useState<CreateAdminResponse | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [copied, setCopied] = useState(false);
  const { showToast } = useToast();

  const handleCreateAdmin = useCallback(async () => {
    if (!username.trim()) {
      showToast("Error", "Username is required", "error");
      return false;
    }

    if (!realmName.trim()) {
      showToast("Error", "Realm name is required", "error");
      return false;
    }

    setIsLoading(true);
    try {
      const response = await api.createAdmin({
        username: username.trim(),
        realm_name: realmName.trim(),
      });
      setAdminResponse(response);
      return true;
    } catch (_error) {
      showToast("Error", "Failed to create admin account", "error");
      return false;
    } finally {
      setIsLoading(false);
    }
  }, [username, realmName, showToast]);

  const handleCopyPAT = useCallback(async () => {
    if (adminResponse?.pat) {
      await navigator.clipboard.writeText(adminResponse.pat);
      setCopied(true);
      showToast("Copied!", "PAT copied to clipboard", "success");
      setTimeout(() => setCopied(false), 2000);
    }
  }, [adminResponse, showToast]);

  const handleComplete = useCallback(() => {
    navigate("/dashboard");
  }, []);

  const stepColors = [
    "var(--color-red)",
    "var(--color-blue)",
    "var(--color-green)",
    "var(--color-purple)",
  ];

  const steps = [
    {
      title: "Admin Account",
      content: (
        <StepContent color="var(--color-red)">
          <StepHeader color="var(--color-red)">
            Create Your Admin Account
          </StepHeader>
          <StepDescription>
            This will be your primary administrator account for managing Bifrost.
          </StepDescription>
          <FormField
            label="Username"
            value={username}
            onChange={setUsername}
            placeholder="Enter your username"
            disabled={isLoading}
          />
        </StepContent>
      ),
    },
    {
      title: "Create Realm",
      content: (
        <StepContent color="var(--color-blue)">
          <StepHeader color="var(--color-blue)">
            Create Your First Realm
          </StepHeader>
          <StepDescription>
            A realm is an isolated workspace for managing runes (issues, tasks, bugs).
          </StepDescription>
          <FormField
            label="Realm Name"
            value={realmName}
            onChange={setRealmName}
            placeholder="e.g., my-project"
            disabled={isLoading}
          />
        </StepContent>
      ),
    },
    {
      title: "Access Token",
      content: (
        <StepContent color="var(--color-green)">
          <StepHeader color="var(--color-green)">
            Your Personal Access Token
          </StepHeader>
          <StepDescription>
            Save this token securely. You'll need it to authenticate with Bifrost.
          </StepDescription>
          {adminResponse ? (
            <PATDisplay
              pat={adminResponse.pat}
              copied={copied}
              onCopy={handleCopyPAT}
            />
          ) : (
            <div className="text-center py-8">
              <p className="text-sm opacity-60">Click Next to generate your token...</p>
            </div>
          )}
        </StepContent>
      ),
    },
    {
      title: "Complete",
      content: (
        <StepContent color="var(--color-purple)">
          <StepHeader color="var(--color-purple)">
            You're All Set!
          </StepHeader>
          <StepDescription>
            Your Bifrost instance is ready to use. Start creating and managing runes.
          </StepDescription>
          <div className="text-center py-8">
            <div
              className="inline-block px-6 py-4 text-sm"
              style={{
                border: "2px solid var(--color-purple)",
            boxShadow: "var(--shadow-soft)",
              }}
            >
              <p className="font-bold mb-2">Setup Summary</p>
              <p>Admin: <strong>{username}</strong></p>
              <p>Realm: <strong>{realmName}</strong></p>
            </div>
          </div>
        </StepContent>
      ),
    },
  ];

  const handleWizardNext = useCallback(async (currentStep: number) => {
    // Step 2 (index 2) is the PAT generation step
    if (currentStep === 2 && !adminResponse) {
      return handleCreateAdmin();
    }
    return true;
  }, [adminResponse, handleCreateAdmin]);

  return (
    <div className="min-h-[calc(100vh-56px)] flex items-center justify-center p-6">
      <div className="w-full max-w-2xl">
        {/* Header */}
        <div className="mb-8 text-center">
          <h1 className="text-4xl font-bold tracking-tight mb-2">
            <span className="bifrost-logo-text">Bifrost</span>
          </h1>
          <p
            className="text-sm uppercase tracking-widest"
            style={{ color: "var(--color-border)" }}
          >
            First-Time Setup
          </p>
        </div>

        {/* Wizard Card */}
        <div
          className="p-8"
          style={{
            backgroundColor: "var(--color-bg)",
            border: "2px solid var(--color-border)",
            boxShadow: "var(--shadow-soft)",
          }}
        >
          <WizardWithValidation
            steps={steps}
            colors={stepColors}
            onComplete={handleComplete}
            onValidateStep={handleWizardNext}
          />
        </div>
      </div>
    </div>
  );
}


// Custom wizard with validation
type WizardWithValidationProps = {
  steps: Array<{ title: string; content: React.ReactNode }>;
  colors: string[];
  onComplete: () => void;
  onValidateStep: (stepIndex: number) => Promise<boolean>;
};

function WizardWithValidation({
  steps,
  colors,
  onComplete,
  onValidateStep,
}: WizardWithValidationProps) {
  const [currentStep, setCurrentStep] = useState(0);
  const [isValidating, setIsValidating] = useState(false);

  const isLastStep = currentStep === steps.length - 1;
  const isFirstStep = currentStep === 0;

  const handleNext = async () => {
    if (isValidating) return;

    setIsValidating(true);
    try {
      const canProceed = await onValidateStep(currentStep);
      if (canProceed) {
        if (!isLastStep) {
          setCurrentStep((prev) => prev + 1);
        } else {
          onComplete();
        }
      }
    } finally {
      setIsValidating(false);
    }
  };

  const handleBack = () => {
    if (!isFirstStep) {
      setCurrentStep((prev) => prev - 1);
    }
  };

  const getStepColor = (stepIndex: number) => {
    return colors[stepIndex % colors.length] ?? colors[0];
  };

  return (
    <div className="wizard">
      {/* Step Indicators */}
      <div className="wizard-indicators">
        {steps.map((step, index) => {
          const isActive = index === currentStep;
          const isCompleted = index < currentStep;
          const isUpcoming = index > currentStep;

          return (
            <div key={step.title} className="wizard-step-indicator">
              <div
                className="step-number"
                style={{
                  backgroundColor:
                    isActive || isCompleted ? getStepColor(index) : "#f5f5f5",
                  borderColor:
                    isActive || isCompleted ? getStepColor(index) : "#000000",
                  color: isActive || isCompleted ? "#ffffff" : "#000000",
                }}
              >
                {isCompleted ? "✓" : index + 1}
              </div>
              <div
                className="step-title"
                style={{
                  color: isActive
                    ? getStepColor(index)
                    : isUpcoming
                      ? "#999999"
                      : "#000000",
                  fontWeight: isActive ? "bold" : "normal",
                }}
              >
                {step.title}
              </div>
              {index < steps.length - 1 && <div className="step-connector" />}
            </div>
          );
        })}
      </div>

      {/* Step Content */}
      <div className="wizard-content">{steps[currentStep]?.content}</div>

      {/* Navigation Buttons */}
      <div className="wizard-navigation">
        {!isFirstStep && (
          <Button
            onClick={handleBack}
            className="wizard-button wizard-button-back"
            type="button"
          >
            ← Back
          </Button>
        )}

        <Button
          onClick={handleNext}
          className={`wizard-button ${isLastStep ? "wizard-button-done" : "wizard-button-next"}`}
          type="button"
          disabled={isValidating}
        >
          {isValidating
            ? "Processing..."
            : isLastStep
              ? "Go to Dashboard →"
              : "Next →"}
        </Button>
      </div>

      <style>{`
        .wizard {
          display: flex;
          flex-direction: column;
          gap: 24px;
        }

        .wizard-indicators {
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 8px;
          padding: 16px;
          border: 2px solid var(--color-border);
          background: var(--color-bg);
          box-shadow: 4px 4px 0px var(--color-border);
        }

        .wizard-step-indicator {
          display: flex;
          flex-direction: column;
          align-items: center;
          gap: 8px;
          position: relative;
          flex: 1;
        }

        .step-number {
          width: 40px;
          height: 40px;
          display: flex;
          align-items: center;
          justify-content: center;
          border: 2px solid;
          border-radius: 0;
          font-weight: bold;
          font-size: 16px;
          box-shadow: 2px 2px 0px var(--color-border);
          transition: all 0.2s;
        }

        .step-number:hover {
          transform: translate(-2px, -2px);
          box-shadow: 4px 4px 0px var(--color-border);
        }

        .step-title {
          font-size: 12px;
          text-align: center;
          max-width: 100px;
          text-transform: uppercase;
          letter-spacing: 0.5px;
        }

        .step-connector {
          position: absolute;
          top: 36px;
          left: 50%;
          width: 100%;
          height: 2px;
          background: var(--color-border);
          z-index: -1;
        }

        .wizard-step-indicator:last-child .step-connector {
          display: none;
        }

        .wizard-content {
          padding: 24px;
          border: 2px solid var(--color-border);
          background: var(--color-bg);
          box-shadow: 4px 4px 0px var(--color-border);
          min-height: 200px;
        }

        .wizard-navigation {
          display: flex;
          justify-content: space-between;
          gap: 16px;
        }

        .wizard-button {
          padding: 12px 24px;
          border: 2px solid var(--color-border);
          border-radius: 0;
          font-size: 16px;
          font-weight: bold;
          cursor: pointer;
          background: var(--color-bg);
          box-shadow: 4px 4px 0px var(--color-border);
          transition: all 0.1s;
          color: var(--color-text);
        }

        .wizard-button:hover:not(:disabled) {
          transform: translate(-2px, -2px);
          box-shadow: 6px 6px 0px var(--color-border);
        }

        .wizard-button:active:not(:disabled) {
          transform: translate(2px, 2px);
          box-shadow: 0px 0px 0px var(--color-border);
        }

        .wizard-button:disabled {
          opacity: 0.6;
          cursor: not-allowed;
        }

        .wizard-button-back {
          background: #f5f5f5;
          color: #000000;
        }

        .wizard-button-next {
          background: var(--color-bg);
        }

        .wizard-button-done {
          background: var(--color-green);
          color: #ffffff;
          border-color: #000000;
        }

        .wizard-button-done:hover:not(:disabled) {
          background: #16a34a;
        }
      `}</style>
    </div>
  );
}

// Step content components
type StepContentProps = {
  children: React.ReactNode;
  color: string;
};

function StepContent({ children }: StepContentProps) {
  return <div className="step-content">{children}</div>;
}

type StepHeaderProps = {
  children: string;
  color: string;
};

function StepHeader({ children, color }: StepHeaderProps) {
  return (
    <h2
      className="text-xl font-bold mb-4 uppercase tracking-wide"
      style={{ color }}
    >
      {children}
    </h2>
  );
}

function StepDescription({ children }: { children: string }) {
  return (
    <p
      className="text-sm mb-6 opacity-70"
      style={{ color: "var(--color-text)" }}
    >
      {children}
    </p>
  );
}

type FormFieldProps = {
  label: string;
  value: string;
  onChange: (value: string) => void;
  placeholder: string;
  disabled: boolean;
};

function FormField({
  label,
  value,
  onChange,
  placeholder,
  disabled,
}: FormFieldProps) {
  const fieldId = label.toLowerCase().replace(/\s+/g, "-");

  return (
    <div className="mb-6">
      <label
        htmlFor={fieldId}
        className="block text-xs uppercase tracking-wider mb-2 font-semibold"
        style={{ color: "var(--color-border)" }}
      >
        {label}
      </label>
      <Input
        id={fieldId}
        type="text"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        disabled={disabled}
        className="w-full px-4 py-3 text-sm transition-all duration-150"
        style={{
          backgroundColor: "var(--color-bg)",
          border: "2px solid var(--color-border)",
          color: "var(--color-text)",
            boxShadow: "var(--shadow-soft)",
        }}
        onFocus={(e) => {
          e.currentTarget.style.boxShadow = "var(--shadow-soft-hover)";
          e.currentTarget.style.transform = "translate(2px, 2px)";
        }}
        onBlur={(e) => {
          e.currentTarget.style.boxShadow = "var(--shadow-soft)";
          e.currentTarget.style.transform = "translate(0, 0)";
        }}
      />
    </div>
  );
}

type PATDisplayProps = {
  pat: string;
  copied: boolean;
  onCopy: () => void;
};

function PATDisplay({ pat, copied, onCopy }: PATDisplayProps) {
  return (
    <div className="space-y-4">
      <div
        className="p-4 font-mono text-sm break-all"
        style={{
          backgroundColor: "var(--color-bg)",
          border: "2px solid var(--color-green)",
            boxShadow: "var(--shadow-soft)",
        }}
      >
        {pat}
      </div>
      <Button
        onClick={onCopy}
        className="w-full py-3 px-6 text-sm font-bold uppercase tracking-wider transition-all duration-150"
        style={{
          backgroundColor: copied ? "var(--color-green)" : "var(--color-bg)",
          border: "2px solid var(--color-border)",
          color: copied ? "#ffffff" : "var(--color-text)",
            boxShadow: "var(--shadow-soft)",
        }}
        onMouseEnter={(e) => {
          if (!copied) {
            e.currentTarget.style.boxShadow = "var(--shadow-soft-hover)";
            e.currentTarget.style.transform = "translate(2px, 2px)";
          }
        }}
        onMouseLeave={(e) => {
          e.currentTarget.style.boxShadow = "var(--shadow-soft)";
          e.currentTarget.style.transform = "translate(0, 0)";
        }}
      >
        {copied ? "✓ Copied!" : "Copy to Clipboard"}
      </Button>
      <p
        className="text-xs text-center opacity-60"
        style={{ color: "var(--color-text)" }}
      >
        ⚠️ Store this token securely. It won't be shown again.
      </p>
    </div>
  );
}
