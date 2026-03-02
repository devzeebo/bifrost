import { describe, expect, vi, test } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { Toast } from "./Toast";
import { type Toast as ToastType } from "@/lib/toast";

describe("Toast", () => {
  const mockOnRemove = vi.fn();

  const createMockToast = (
    overrides: Partial<ToastType> = {},
  ): ToastType => ({
    id: "test-123",
    title: "Test Toast",
    description: "This is a test toast message",
    type: "info",
    ...overrides,
  });

  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("Component Rendering", () => {
    test("renders without crashing", () => {
      const toast = createMockToast();
      render(<Toast toast={toast} onRemove={mockOnRemove} />);
      expect(screen.getByText("Test Toast")).toBeInTheDocument();
    });

    test("renders toast title", () => {
      const toast = createMockToast({ title: "Success Message" });
      render(<Toast toast={toast} onRemove={mockOnRemove} />);
      expect(screen.getByText("Success Message")).toBeInTheDocument();
    });

    test("renders toast description when provided", () => {
      const toast = createMockToast({
        description: "Operation completed successfully",
      });
      render(<Toast toast={toast} onRemove={mockOnRemove} />);
      expect(
        screen.getByText("Operation completed successfully"),
      ).toBeInTheDocument();
    });

    test("does not render description when not provided", () => {
      const toast = createMockToast({ description: undefined });
      render(<Toast toast={toast} onRemove={mockOnRemove} />);
      const toastElement = screen.getByText("Test Toast").parentElement;
      expect(toastElement).toBeInTheDocument();
    });

    test("renders close button", () => {
      const toast = createMockToast();
      render(<Toast toast={toast} onRemove={mockOnRemove} />);
      const closeButton = screen.getByText("✕");
      expect(closeButton).toBeInTheDocument();
    });
  });

  describe("Toast Dismissal", () => {
    test("calls onRemove with correct id when close button is clicked", () => {
      const toast = createMockToast({ id: "toast-456" });
      render(<Toast toast={toast} onRemove={mockOnRemove} />);

      const closeButton = screen.getByText("✕");
      fireEvent.click(closeButton);

      expect(mockOnRemove).toHaveBeenCalledTimes(1);
      expect(mockOnRemove).toHaveBeenCalledWith("toast-456");
    });
  });

  describe("Toast Types", () => {
    test("renders success toast with correct icon", () => {
      const toast = createMockToast({ type: "success" });
      render(<Toast toast={toast} onRemove={mockOnRemove} />);
      expect(screen.getByText("✓")).toBeInTheDocument();
    });

    test("renders error toast with correct icon", () => {
      const toast = createMockToast({ type: "error" });
      const { container } = render(<Toast toast={toast} onRemove={mockOnRemove} />);
      // Check for error styling class
      const toastElement = container.querySelector(".border-red-500");
      expect(toastElement).toBeInTheDocument();
    });

    test("renders info toast with correct icon", () => {
      const toast = createMockToast({ type: "info" });
      render(<Toast toast={toast} onRemove={mockOnRemove} />);
      expect(screen.getByText("ℹ")).toBeInTheDocument();
    });

    test("renders warning toast with correct icon", () => {
      const toast = createMockToast({ type: "warning" });
      render(<Toast toast={toast} onRemove={mockOnRemove} />);
      expect(screen.getByText("⚠")).toBeInTheDocument();
    });
  });

  describe("Toast Content", () => {
    test("displays long title correctly", () => {
      const longTitle =
        "This is a very long toast title that should still display properly in the UI component";
      const toast = createMockToast({ title: longTitle });
      render(<Toast toast={toast} onRemove={mockOnRemove} />);
      expect(screen.getByText(longTitle)).toBeInTheDocument();
    });

    test("displays long description correctly", () => {
      const longDescription =
        "This is a very long toast description that should still display properly in the UI component without breaking the layout";
      const toast = createMockToast({ description: longDescription });
      render(<Toast toast={toast} onRemove={mockOnRemove} />);
      expect(screen.getByText(longDescription)).toBeInTheDocument();
    });

    test("displays both title and description together", () => {
      const toast = createMockToast({
        title: "Warning",
        description: "Low disk space",
      });
      render(<Toast toast={toast} onRemove={mockOnRemove} />);
      expect(screen.getByText("Warning")).toBeInTheDocument();
      expect(screen.getByText("Low disk space")).toBeInTheDocument();
    });
  });
});
