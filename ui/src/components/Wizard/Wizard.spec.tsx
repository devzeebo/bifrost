import { describe, expect, vi, beforeEach, test } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { Wizard } from "./Wizard";

describe("Wizard", () => {
  const mockSteps = [
    {
      title: "Step 1",
      content: <div data-testid="step-1">Step 1 Content</div>,
    },
    {
      title: "Step 2",
      content: <div data-testid="step-2">Step 2 Content</div>,
    },
    {
      title: "Step 3",
      content: <div data-testid="step-3">Step 3 Content</div>,
    },
  ];

  const mockOnComplete = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("Component Rendering", () => {
    test("renders without crashing", () => {
      const { container } = render(<Wizard steps={mockSteps} onComplete={mockOnComplete} />);
      const wizard = container.querySelector('.wizard');
      expect(wizard).toBeInTheDocument();
    });

    test("renders with custom colors", () => {
      const customColors = ["#ff0000", "#00ff00", "#0000ff"];
      const { container } = render(
        <Wizard steps={mockSteps} onComplete={mockOnComplete} colors={customColors} />
      );
      const wizard = container.querySelector('.wizard');
      expect(wizard).toBeInTheDocument();
    });
  });

  describe("Step Content", () => {
    test("displays first step content initially", () => {
      render(<Wizard steps={mockSteps} onComplete={mockOnComplete} />);
      const step1Content = screen.getByTestId("step-1");
      expect(step1Content).toBeInTheDocument();
    });

    test("does not display other steps initially", () => {
      render(<Wizard steps={mockSteps} onComplete={mockOnComplete} />);
      const step2Content = screen.queryByTestId("step-2");
      const step3Content = screen.queryByTestId("step-3");
      expect(step2Content).not.toBeInTheDocument();
      expect(step3Content).not.toBeInTheDocument();
    });

    test("displays correct step content after navigation", () => {
      render(<Wizard steps={mockSteps} onComplete={mockOnComplete} />);

      const nextButton = screen.getByText("Next →");
      fireEvent.click(nextButton);

      const step2Content = screen.getByTestId("step-2");
      expect(step2Content).toBeInTheDocument();
    });
  });

  describe("Step Indicators", () => {
    test("displays all step indicators", () => {
      render(<Wizard steps={mockSteps} onComplete={mockOnComplete} />);

      expect(screen.getByText("Step 1")).toBeInTheDocument();
      expect(screen.getByText("Step 2")).toBeInTheDocument();
      expect(screen.getByText("Step 3")).toBeInTheDocument();
    });

    test("shows step numbers for incomplete steps", () => {
      render(<Wizard steps={mockSteps} onComplete={mockOnComplete} />);

      expect(screen.getByText("1")).toBeInTheDocument();
      expect(screen.getByText("2")).toBeInTheDocument();
      expect(screen.getByText("3")).toBeInTheDocument();
    });

    test("shows checkmark for completed steps", () => {
      render(<Wizard steps={mockSteps} onComplete={mockOnComplete} />);

      // Navigate to step 2
      const nextButton = screen.getByText("Next →");
      fireEvent.click(nextButton);

      // Step 1 should show checkmark
      const checkmarks = screen.getAllByText("✓");
      expect(checkmarks).toHaveLength(1);
    });
  });

  describe("Navigation Buttons", () => {
    test("shows Next button on first step", () => {
      render(<Wizard steps={mockSteps} onComplete={mockOnComplete} />);

      const nextButton = screen.getByText("Next →");
      expect(nextButton).toBeInTheDocument();

      const backButton = screen.queryByText("← Back");
      expect(backButton).not.toBeInTheDocument();
    });

    test("shows Back button on second step", () => {
      render(<Wizard steps={mockSteps} onComplete={mockOnComplete} />);

      const nextButton = screen.getByText("Next →");
      fireEvent.click(nextButton);

      const backButton = screen.getByText("← Back");
      expect(backButton).toBeInTheDocument();
    });

    test("shows Done button on last step", () => {
      render(<Wizard steps={mockSteps} onComplete={mockOnComplete} />);

      // Navigate to last step
      const nextButton = screen.getByText("Next →");
      fireEvent.click(nextButton);
      fireEvent.click(nextButton);

      const doneButton = screen.getByText("Done →");
      expect(doneButton).toBeInTheDocument();
      const nextButtonAfter = screen.queryByText("Next →");
      expect(nextButtonAfter).not.toBeInTheDocument();
    });
  });

  describe("Navigation Behavior", () => {
    test("navigates to next step when Next is clicked", () => {
      render(<Wizard steps={mockSteps} onComplete={mockOnComplete} />);

      const nextButton = screen.getByText("Next →");
      fireEvent.click(nextButton);

      const step2Content = screen.getByTestId("step-2");
      expect(step2Content).toBeInTheDocument();
    });

    test("navigates to previous step when Back is clicked", () => {
      render(<Wizard steps={mockSteps} onComplete={mockOnComplete} />);

      const nextButton = screen.getByText("Next →");
      fireEvent.click(nextButton);

      const backButton = screen.getByText("← Back");
      fireEvent.click(backButton);

      const step1Content = screen.getByTestId("step-1");
      expect(step1Content).toBeInTheDocument();
    });

    test("can navigate multiple steps forward", () => {
      render(<Wizard steps={mockSteps} onComplete={mockOnComplete} />);

      const nextButton = screen.getByText("Next →");
      fireEvent.click(nextButton);
      fireEvent.click(nextButton);

      const step3Content = screen.getByTestId("step-3");
      expect(step3Content).toBeInTheDocument();
    });
  });

  describe("Completion", () => {
    test("calls onComplete when Done button is clicked on last step", () => {
      render(<Wizard steps={mockSteps} onComplete={mockOnComplete} />);

      const nextButton = screen.getByText("Next →");
      fireEvent.click(nextButton);
      fireEvent.click(nextButton);

      const doneButton = screen.getByText("Done →");
      fireEvent.click(doneButton);

      expect(mockOnComplete).toHaveBeenCalledTimes(1);
    });

    test("does not call onComplete before reaching last step", () => {
      render(<Wizard steps={mockSteps} onComplete={mockOnComplete} />);

      const nextButton = screen.getByText("Next →");
      fireEvent.click(nextButton);

      expect(mockOnComplete).not.toHaveBeenCalled();
    });
  });

  describe("Edge Cases", () => {
    test("handles single step wizard", () => {
      const singleStep = [
        {
          title: "Only Step",
          content: <div data-testid="single-step">Single Step Content</div>,
        },
      ];

      const { container } = render(<Wizard steps={singleStep} onComplete={mockOnComplete} />);
      const wizard = container.querySelector('.wizard');
      expect(wizard).toBeInTheDocument();

      const stepContent = screen.getByTestId("single-step");
      expect(stepContent).toBeInTheDocument();

      const doneButton = screen.getByText("Done →");
      expect(doneButton).toBeInTheDocument();
    });
  });
});
