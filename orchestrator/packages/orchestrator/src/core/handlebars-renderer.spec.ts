import { describe, expect, it } from "vitest";
import { renderPrompt } from "./handlebars-renderer";

describe("renderPrompt", () => {
  describe("FR-14: Render Handlebars prompt with taskState values", () => {
    it("should replace simple Handlebars tokens with taskState values", () => {
      const promptBody = "Write {{language.name}} code using {{testFramework.name}}.";
      const taskState = {
        language: { name: "Python", prompt: "Write Python code" },
        testFramework: { name: "pytest", prompt: "Use pytest framework" },
      };

      const rendered = renderPrompt(promptBody, { taskId: "task-1", taskState });

      expect(rendered).toContain("Python");
      expect(rendered).toContain("pytest");
      expect(rendered).not.toContain("{{");
    });

    it("should replace taskId token with the task id", () => {
      const promptBody = "Working on task {{taskId}}.";

      const rendered = renderPrompt(promptBody, { taskId: "task-abc-123", taskState: {} });

      expect(rendered).toBe("Working on task task-abc-123.");
    });

    it("should render nested object paths", () => {
      const promptBody = "PR: {{context.prDescription}}, Notes: {{context.additionalNotes}}";
      const taskState = {
        context: {
          prDescription: "Fix authentication bug",
          additionalNotes: "Urgent - blocking release",
        },
      };

      const rendered = renderPrompt(promptBody, { taskId: "task-1", taskState });

      expect(rendered).toContain("Fix authentication bug");
      expect(rendered).toContain("Urgent - blocking release");
    });

    it("should render empty string for missing optional parameters", () => {
      const promptBody = "Write tests. {{context.additionalNotes}}";

      const rendered = renderPrompt(promptBody, { taskId: "task-1", taskState: {} });

      expect(rendered).toBe("Write tests. ");
    });

    it("should support {{#if}} blocks for optional parameters", () => {
      const promptBody =
        "{{#if context.prDescription}}PR: {{context.prDescription}}{{/if}} Write tests.";
      const taskState = { context: { prDescription: "Add unit tests" } };

      const rendered = renderPrompt(promptBody, { taskId: "task-1", taskState });

      expect(rendered).toContain("PR: Add unit tests");
      expect(rendered).toContain("Write tests");
    });

    it("should exclude {{#if}} content when parameter is absent", () => {
      const promptBody =
        "{{#if context.prDescription}}PR: {{context.prDescription}}{{/if}} Write tests.";

      const rendered = renderPrompt(promptBody, { taskId: "task-1", taskState: {} });

      expect(rendered).not.toContain("PR:");
      expect(rendered).toContain("Write tests");
    });
  });

  describe("FR-5: Handlebars tokens in prompt body must match declared parameters", () => {
    it("should fail gracefully on undeclared tokens", () => {
      const promptBody = "Use {{framework}} for {{language}}";
      const taskState = { language: "Python" };

      const rendered = renderPrompt(promptBody, { taskId: "task-1", taskState });

      expect(rendered).toContain("Python");
      expect(rendered).toContain("for");
    });
  });

  describe("NFR-7: Reproducibility", () => {
    it("should produce identical output for same inputs", () => {
      const promptBody = "Write {{language}} tests with {{framework}}";
      const taskState = { language: "Python", framework: "pytest" };

      const rendered1 = renderPrompt(promptBody, { taskId: "task-1", taskState });
      const rendered2 = renderPrompt(promptBody, { taskId: "task-1", taskState });

      expect(rendered1).toBe(rendered2);
    });

    it("should be side-effect free", () => {
      const promptBody = "Use {{language}}";
      const taskState = { language: "Python" };
      const original = { ...taskState };

      renderPrompt(promptBody, { taskId: "task-1", taskState });

      expect(taskState).toEqual(original);
    });
  });
});
