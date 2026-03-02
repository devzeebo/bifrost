import { describe, expect, vi, test } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { Dialog } from "./Dialog";

describe("Dialog", () => {
  const defaultProps = {
    open: true,
    onClose: vi.fn(),
    title: "Test Dialog",
    description: "This is a test description",
    onConfirm: vi.fn(),
  };

  test("renders without crashing when open", () => {
    render(<Dialog {...defaultProps} />);
    const dialog = screen.getByRole("dialog");
    expect(dialog).toBeInTheDocument();
  });

  test("does not render when closed", () => {
    render(<Dialog {...defaultProps} open={false} />);
    const dialog = screen.queryByRole("dialog");
    expect(dialog).not.toBeInTheDocument();
  });

  test("displays title", () => {
    render(<Dialog {...defaultProps} title="Custom Title" />);
    expect(screen.getByText("Custom Title")).toBeInTheDocument();
  });

  test("displays description", () => {
    render(<Dialog {...defaultProps} description="Custom Description" />);
    expect(screen.getByText("Custom Description")).toBeInTheDocument();
  });

  test("calls onConfirm when confirm button is clicked", () => {
    const onConfirm = vi.fn();
    const onClose = vi.fn();
    render(<Dialog {...defaultProps} onConfirm={onConfirm} onClose={onClose} />);

    const confirmButton = screen.getByRole("button", { name: /confirm/i });
    fireEvent.click(confirmButton);

    expect(onConfirm).toHaveBeenCalledTimes(1);
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  test("calls onCancel when cancel button is clicked", () => {
    const onClose = vi.fn();
    render(<Dialog {...defaultProps} onClose={onClose} />);

    const cancelButton = screen.getByRole("button", { name: /cancel/i });
    fireEvent.click(cancelButton);

    expect(onClose).toHaveBeenCalledTimes(1);
  });

  test("uses custom confirm label", () => {
    render(<Dialog {...defaultProps} confirmLabel="Delete" />);
    expect(screen.getByRole("button", { name: "Delete" })).toBeInTheDocument();
  });

  test("uses custom cancel label", () => {
    render(<Dialog {...defaultProps} cancelLabel="Close" />);
    expect(screen.getByRole("button", { name: "Close" })).toBeInTheDocument();
  });

  test("closes when backdrop is clicked", () => {
    const onClose = vi.fn();
    render(<Dialog {...defaultProps} onClose={onClose} />);

    const backdrop = document.querySelector('[class*="fixed inset-0"]');
    expect(backdrop).toBeInTheDocument();
    if (backdrop) {
      fireEvent.click(backdrop);
      expect(onClose).toHaveBeenCalledTimes(1);
    }
  });

  test("closes when Escape key is pressed", () => {
    const onClose = vi.fn();
    render(<Dialog {...defaultProps} onClose={onClose} />);

    fireEvent.keyDown(document, { key: "Escape" });
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  test("does not close when Escape key is pressed when dialog is closed", () => {
    const onClose = vi.fn();
    render(<Dialog {...defaultProps} open={false} onClose={onClose} />);

    fireEvent.keyDown(document, { key: "Escape" });
    expect(onClose).not.toHaveBeenCalled();
  });

  test("applies correct color styles for blue", () => {
    render(<Dialog {...defaultProps} color="blue" />);
    const dialog = screen.getByRole("dialog");
    expect(dialog).toHaveClass("border-blue-500");
  });

  test("applies correct color styles for green", () => {
    render(<Dialog {...defaultProps} color="green" />);
    const dialog = screen.getByRole("dialog");
    expect(dialog).toHaveClass("border-green-500");
  });

  test("applies correct color styles for red", () => {
    render(<Dialog {...defaultProps} color="red" />);
    const dialog = screen.getByRole("dialog");
    expect(dialog).toHaveClass("border-red-500");
  });

  test("applies correct color styles for yellow", () => {
    render(<Dialog {...defaultProps} color="yellow" />);
    const dialog = screen.getByRole("dialog");
    expect(dialog).toHaveClass("border-yellow-500");
  });

  test("has proper ARIA attributes", () => {
    render(<Dialog {...defaultProps} />);
    const dialog = screen.getByRole("dialog");

    expect(dialog).toHaveAttribute("aria-labelledby", "dialog-title");
    expect(dialog).toHaveAttribute("aria-describedby", "dialog-description");
  });
});
