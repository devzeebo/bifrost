"use client";

import { useEffect, useState } from "react";
import { Button } from "@base-ui/react/button";
import { Input } from "@base-ui/react/input";
import { navigate } from "@/lib/router";
import { useAuth } from "../../lib/auth";
import { useToast } from "../../lib/toast";
import { api } from "../../lib/api";

const Page = () => {
  const [pat, setPat] = useState("");
  const [rememberMe, setRememberMe] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [isCheckingOnboarding, setIsCheckingOnboarding] = useState(true);
  const { login } = useAuth();
  const { showToast } = useToast();

  useEffect(() => {
    const checkOnboarding = async () => {
      try {
        const response = await api.checkOnboarding();
        if (response.needs_onboarding) {
          navigate("/onboarding");
        } else {
          setIsCheckingOnboarding(false);
        }
      } catch (error) {
        console.error("Failed to check onboarding status:", error);
        setIsCheckingOnboarding(false);
      }
    };

    checkOnboarding();
  }, []);

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (isLoading || isCheckingOnboarding) {
      return;
    }

    setIsLoading(true);
    try {
      await login(pat, rememberMe);
      showToast("Success", "Logged in successfully", "success");
      navigate("/dashboard");
    } catch (error) {
      console.error("Login failed:", error);
      showToast("Error", "Failed to log in", "error");
    } finally {
      setIsLoading(false);
    }
  };

  if (isCheckingOnboarding) {
    return (
      <div className="min-h-[calc(100vh-56px)] flex items-center justify-center p-6">
        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500 mx-auto mb-4" />
          <p>Checking setup...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-[calc(100vh-56px)] flex items-center justify-center p-6">
      <div
        className="p-8 max-w-md w-full"
        style={{
          backgroundColor: "var(--color-bg)",
          border: "2px solid var(--color-border)",
          boxShadow: "var(--shadow-soft)",
        }}
      >
        <h1 className="text-2xl font-bold mb-6 text-center">Login</h1>
        <form onSubmit={handleSubmit}>
          <div className="mb-4">
            <Input
              type="password"
              value={pat}
              onChange={(event) => setPat(event.target.value)}
              placeholder="Enter your PAT"
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
          <div className="mb-6">
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={rememberMe}
                onChange={(event) => setRememberMe(event.target.checked)}
                disabled={isLoading || isCheckingOnboarding}
                className="w-4 h-4"
                style={{
                  accentColor: "var(--color-blue)",
                }}
              />
              <span style={{ color: "var(--color-text)" }}>Remember me</span>
            </label>
          </div>
          <Button
            type="submit"
            disabled={isLoading || isCheckingOnboarding || !pat.trim()}
            style={{
              backgroundColor: "var(--color-blue)",
              border: "2px solid var(--color-border)",
              color: "white",
              boxShadow: "var(--shadow-soft)",
              width: "100%",
            }}
            onMouseEnter={(event) => {
              if (!isLoading) {
                event.currentTarget.style.boxShadow = "var(--shadow-soft-hover)";
              }
            }}
            onMouseLeave={(event) => {
              event.currentTarget.style.boxShadow = "var(--shadow-soft)";
            }}
            onMouseDown={(event) => {
              if (!isLoading) {
                event.currentTarget.style.boxShadow = "none";
              }
            }}
            onMouseUp={(event) => {
              if (!isLoading) {
                event.currentTarget.style.boxShadow = "var(--shadow-soft-hover)";
              }
            }}
          >
            {(() => {
              if (isCheckingOnboarding) {
                return "Checking setup...";
              } else if (isLoading) {
                return "Signing in...";
              } else {
                return "Sign In";
              }
            })()}
          </Button>
        </form>
      </div>
    </div>
  );
};

export { Page };
