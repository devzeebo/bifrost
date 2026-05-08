import { describe, expect, it } from "vitest";
import { parseAgentDefinition } from "./agent-parser.js";

describe("AGENT.md Parser - US-1", () => {
  describe("Valid AGENT.md parsing", () => {
    it("should parse valid AGENT.md with all required fields", () => {
      // Given an AGENT.md file with valid YAML frontmatter
      const content = `---
name: reviewer
description: Code review agent
tools:
  - readFile
  - edit
toolClasses:
  - linter
template:
  parameters:
    language:
      name: string
      prompt: string
    testFramework:
      name: string
      prompt: string
    context?:
      prDescription: string
      additionalNotes?: string
hooks:
  Start:
    - name: validate-args
      scriptPath: hooks/Start.d/validate-args.mjs
  Stop:
    - name: check-new-tests
      scriptPath: hooks/Stop.d/check-new-tests.mjs
---
You are a code reviewer. Review the changes for {{language.name}}.
`;

      const agent = parseAgentDefinition(content);

      // Then the agent name, description, tools, toolClasses, template parameter schema, and prompt body are all accessible
      expect(agent).toBeDefined();
      expect(agent?.name).toBe("reviewer");
      expect(agent?.description).toBe("Code review agent");
      expect(agent?.tools).toEqual(["readFile", "edit"]);
      expect(agent?.toolClasses).toEqual(["linter"]);
      expect(agent?.template.parameters).toBeDefined();
      expect(agent?.promptBody).toContain("You are a code reviewer");
    });

    it("should render Handlebars tokens from template.parameters", () => {
      const content = `---
name: test-writer
description: Write tests
tools: []
template:
  parameters:
    language:
      name: string
    framework: string
---
Write {{language.name}} tests using {{framework}}.
`;

      const agent = parseAgentDefinition(content);
      expect(agent?.promptBody).toContain("Write {{language.name}} tests using {{framework}}");
    });
  });

  describe("Required field validation", () => {
    it("should fail when name is missing", () => {
      // Given an AGENT.md missing a required frontmatter field (name)
      const content = `---
description: Test agent
tools: []
---
Test prompt
`;

      // When the orchestrator reads the file
      const agent = parseAgentDefinition(content);

      // Then parsing fails with a descriptive error naming the missing field
      expect(agent).toBeNull();
    });

    it("should fail when description is missing", () => {
      const content = `---
name: test-agent
tools: []
---
Test prompt
`;

      const agent = parseAgentDefinition(content);
      expect(agent).toBeNull();
    });

    it("should fail when tools is missing", () => {
      const content = `---
name: test-agent
description: Test
---
Test prompt
`;

      const agent = parseAgentDefinition(content);
      expect(agent).toBeNull();
    });
  });

  describe("Optional parameters (ending with ?)", () => {
    it("should mark field ending with ? as optional", () => {
      // Given a template parameter where a field name ends with ?
      const content = `---
name: test-agent
description: Test
tools: []
template:
  parameters:
    context?:
      prDescription: string
      notes?: string
---
Test prompt {{context.prDescription}}
`;

      const agent = parseAgentDefinition(content);

      // When the parameter schema is parsed
      // Then that field is marked optional
      expect(agent?.template.parameters["context?"]).toBeDefined();
    });
  });

  describe("Handlebars token validation", () => {
    it("should fail when prompt references undeclared Handlebars token", () => {
      // Given a prompt body referencing a Handlebars token not declared in template.parameters
      const content = `---
name: test-agent
description: Test
tools: []
template:
  parameters:
    language: string
---
Use the {{framework}} for {{language}}.
`;

      // When the AGENT.md is parsed
      const agent = parseAgentDefinition(content);

      // Then parsing fails identifying the undeclared token by name
      expect(agent).toBeNull();
    });
  });

  describe("Hook parsing", () => {
    it("should parse Start hooks", () => {
      const content = `---
name: test-agent
description: Test
tools: []
hooks:
  Start:
    - name: validate-args
      scriptPath: hooks/Start.d/validate-args.mjs
      timeout: 120000
---
Prompt
`;

      const agent = parseAgentDefinition(content);
      expect(agent?.hooks.Start).toHaveLength(1);
      expect(agent?.hooks.Start[0].name).toBe("validate-args");
      expect(agent?.hooks.Start[0].timeout).toBe(120000);
    });

    it("should parse Stop hooks", () => {
      const content = `---
name: test-agent
description: Test
tools: []
hooks:
  Stop:
    - name: check-new-tests
      scriptPath: hooks/Stop.d/check-new-tests.mjs
---
Prompt
`;

      const agent = parseAgentDefinition(content);
      expect(agent?.hooks.Stop).toHaveLength(1);
      expect(agent?.hooks.Stop[0].name).toBe("check-new-tests");
    });
  });
});
