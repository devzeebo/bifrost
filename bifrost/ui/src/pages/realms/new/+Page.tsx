"use client";

import { useState } from "react";
import { Input } from "@base-ui/react/input";
import { navigate } from "@/lib/router";
import { useAuth } from "../../../lib/auth";
import { useToast } from "../../../lib/toast";
import { api } from "../../../lib/api";
import { Wizard, type WizardStep } from "../../../components/Wizard/Wizard";

type FormData = {
  name: string;
  description: string;
};

const INITIAL_FORM: FormData = {
  name: "",
  description: "",
};

const Page = () => {
  const { isAuthenticated, loading: authLoading } = useAuth();
  const { showToast } = useToast();
  const [formData, setFormData] = useState<FormData>(INITIAL_FORM);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleInputChange = (field: keyof FormData) => (value: string) => {
    setFormData((prev) => ({ ...prev, [field]: value }));
  };

  const handleSubmit = async () => {
    setIsSubmitting(true);
    try {
      await api.createRealm(formData);
      showToast("Success", "Realm created successfully", "success");
      navigate("/realms");
    } catch {
      showToast("Error", "Failed to create realm", "error");
    } finally {
      setIsSubmitting(false);
    }
  };

  if (authLoading) {
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
          <p>Please log in to create a realm.</p>
        </div>
      </div>
    );
  }

  const steps: WizardStep[] = [
    {
      title: "Name",
      content: (
        <div className="space-y-4">
          <h2 className="text-2xl font-bold">What should we call this realm?</h2>
          <p className="text-gray-600">Choose a descriptive name for your realm.</p>
          <Input
            type="text"
            value={formData.name}
            onChange={(event) => handleInputChange("name")(event.target.value)}
            placeholder="e.g., My Awesome Realm"
            className="w-full"
            style={{
              backgroundColor: "var(--color-bg)",
              border: "2px solid var(--color-border)",
              color: "var(--color-text)",
            }}
            onFocus={(event) => {
              event.currentTarget.style.boxShadow = "var(--shadow-soft-hover)";
            }}
            onBlur={(event) => {
              event.currentTarget.style.boxShadow = "var(--shadow-soft)";
            }}
          />
        </div>
      ),
    },
    {
      title: "Description",
      content: (
        <div className="space-y-4">
          <h2 className="text-2xl font-bold">Tell us about this realm</h2>
          <p className="text-gray-600">
            Provide a brief description to help others understand its purpose.
          </p>
          <textarea
            value={formData.description}
            onChange={(event) => handleInputChange("description")(event.target.value)}
            placeholder="e.g., This realm is for managing our project tasks"
            rows={4}
            className="w-full p-3 border border-gray-300 dark:border-gray-600 rounded-md"
            style={{
              backgroundColor: "var(--color-bg)",
              color: "var(--color-text)",
            }}
            onFocus={(event) => {
              event.currentTarget.style.boxShadow = "var(--shadow-soft-hover)";
            }}
            onBlur={(event) => {
              event.currentTarget.style.boxShadow = "var(--shadow-soft)";
            }}
          />
        </div>
      ),
    },
  ];

  return (
    <div className="min-h-[calc(100vh-56px)] p-6">
      <div className="max-w-3xl mx-auto">
        <div className="mb-8">
          <h1 className="text-3xl font-bold mb-2">Create New Realm</h1>
          <p className="text-gray-600">Set up a new realm for organizing your work</p>
        </div>

        <Wizard steps={steps} onComplete={handleSubmit} colors={["#3b82f6", "#22c55e"]} />

        {isSubmitting && (
          <div className="mt-8 text-center">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500 mx-auto mb-4" />
            <p>Creating realm...</p>
          </div>
        )}
      </div>
    </div>
  );
};

export { Page };
