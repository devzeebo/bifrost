import { describe, expect, it } from "vitest";
import { validateTaskState } from "./validator";

describe("Template Parameters Validator - US-6", () => {
  describe("Required parameter validation", () => {
    it("should pass when all required parameters are present and non-empty", () => {
      // Given a Level 3 agent with a declared template.parameters schema
      const schema = {
        language: { name: "string" },
        testFramework: { name: "string" },
        testStyle: { name: "string" },
      };

      // And a UoW whose taskState satisfies all required parameters
      const taskState = {
        language: { name: "python", prompt: "Write Python code" },
        testFramework: { name: "pytest", prompt: "Use pytest" },
        testStyle: { name: "gherkin", prompt: "BDD style" },
      };

      // When the orchestrator dispatches
      const result = validateTaskState(taskState, schema);

      // Then validation passes
      expect(result.valid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it("should fail when required parameter is missing", () => {
      // Given a UoW whose taskState is missing a required parameter
      const schema = {
        language: { name: "string" },
        testFramework: { name: "string" },
      };

      const taskState = {
        language: { name: "python" },
        // testFramework is missing
      };

      // When validate-args runs
      const result = validateTaskState(taskState, schema);

      // Then validation fails
      expect(result.valid).toBe(false);
      expect(result.errors).toContain("Missing required parameter: testFramework");
    });

    it("should fail when required field is empty string", () => {
      // Given a UoW taskState where a required field is present but set to empty string
      const schema = {
        language: { name: "string" },
      };

      const taskState = {
        language: { name: "" },
      };

      // When validate-args runs
      const result = validateTaskState(taskState, schema);

      // Then validation fails as if the field were absent
      expect(result.valid).toBe(false);
      expect(result.errors).toContain("Missing required parameter: language.name");
    });
  });

  describe("Optional parameter validation (ending with ?)", () => {
    it("should pass when optional parameter is absent", () => {
      // Given a template parameter declared as optional (name ends with ?)
      const schema = {
        "context?": {
          prDescription: "string",
          "additionalNotes?": "string",
        },
      };

      // When taskState omits the optional parameter entirely
      const taskState = {};

      // Then no validation error is raised
      const result = validateTaskState(taskState, schema);
      expect(result.valid).toBe(true);
    });

    it("should pass when optional parameter is provided with required sub-fields", () => {
      // Given a template parameter declared as optional
      const schema = {
        "context?": {
          prDescription: "string",
          "additionalNotes?": "string",
        },
      };

      // When taskState provides that optional parameter
      const taskState = {
        context: {
          prDescription: "Fix bug in auth",
          additionalNotes: "Urgent",
        },
      };

      // Then all non-? sub-fields must be present and non-empty
      const result = validateTaskState(taskState, schema);
      expect(result.valid).toBe(true);
    });

    it("should fail when optional parameter is provided but missing required sub-field", () => {
      // Given a template parameter that is an optional object
      const schema = {
        "context?": {
          prDescription: "string",
          "additionalNotes?": "string",
        },
      };

      // And the UoW taskState provides that object
      // But the object is missing a required sub-field
      const taskState = {
        context: {
          // prDescription is missing (required)
          additionalNotes: "Some notes",
        },
      };

      // When validate-args runs
      const result = validateTaskState(taskState, schema);

      // Then validation fails identifying the missing sub-field by its dot-notation path
      expect(result.valid).toBe(false);
      expect(result.errors).toContain("Missing required parameter: context.prDescription");
    });
  });

  describe("Nested parameter validation", () => {
    it("should validate nested required parameters", () => {
      const schema = {
        language: {
          name: "string",
          version: "string",
        },
      };

      const taskState = {
        language: {
          name: "python",
          // version is missing
        },
      };

      const result = validateTaskState(taskState, schema);
      expect(result.valid).toBe(false);
      expect(result.errors).toContain("Missing required parameter: language.version");
    });
  });
});
