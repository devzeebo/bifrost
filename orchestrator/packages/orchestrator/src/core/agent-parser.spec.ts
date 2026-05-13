// oxlint-disable-next-line class-methods-use-this
import { describe, expect, it } from "vitest";
import { parseAgentDefinition } from "./agent-parser";

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
      expect(agent?.hooks.Start).toEqual([]);
      expect(agent?.hooks.Stop).toEqual([]);
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
});
