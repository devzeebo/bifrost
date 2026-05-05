"use client";

import { usePageContext } from "vike-react/usePageContext";
import { Button } from "@base-ui/react/button";
import { navigate } from "@/lib/router";

export default function Page() {
  const pageContext = usePageContext();
  const { abortReason, abortStatusCode, is404 } = pageContext;

  let title: string;
  let message: string;
  let status: number;

  if (is404) {
    title = "Not Found";
    message = "This page doesn't exist.";
    status = 404;
  } else if (abortStatusCode) {
    status = abortStatusCode;
    if (typeof abortReason === "string") {
      title = "Error";
      message = abortReason;
    } else if (abortStatusCode === 401) {
      title = "Unauthorized";
      message = "You need to log in to access this page.";
    } else if (abortStatusCode === 403) {
      title = "Forbidden";
      message = "You don't have permission to access this page.";
    } else if (abortStatusCode === 500) {
      title = "Server Error";
      message = "Something went wrong on our end. Please try again later.";
    } else {
      title = "Error";
      message = "Something went wrong. Try again later.";
    }
  } else {
    title = "Error";
    message = "Something went wrong. Try again later.";
    status = 500;
  }

  return (
    <div className="min-h-[calc(100vh-56px)] flex items-center justify-center p-6">
      <div
        className="p-8 text-center max-w-md w-full"
        style={{
          backgroundColor: "var(--color-bg)",
          border: "2px solid var(--color-border)",
          boxShadow: "var(--shadow-soft)",
        }}
      >
        <div
          className="text-6xl font-bold mb-4 uppercase tracking-tight"
          style={{ color: "var(--color-red)" }}
        >
          {status}
        </div>
        <h1 className="text-2xl font-bold mb-4 uppercase tracking-tight">
          {title}
        </h1>
        <p
          className="text-sm mb-6"
          style={{ color: "var(--color-border)" }}
        >
          {message}
        </p>
        <Button
          onClick={() => navigate("/dashboard")}
          className="w-full px-6 py-3 text-sm font-bold uppercase tracking-wider transition-all duration-150"
          style={{
            backgroundColor: "var(--color-red)",
            border: "2px solid var(--color-border)",
            color: "white",
            boxShadow: "var(--shadow-soft)",
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.boxShadow = "var(--shadow-soft-hover)";
            e.currentTarget.style.transform = "translate(2px, 2px)";
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.boxShadow = "var(--shadow-soft)";
            e.currentTarget.style.transform = "translate(0, 0)";
          }}
        >
          Go to Dashboard
        </Button>
      </div>
    </div>
  );
}
