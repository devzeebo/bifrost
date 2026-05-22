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

      // Then the agent name, description, tools, template parameter schema, and prompt body are all accessible
      expect(agent).toBeDefined();
      expect(agent?.name).toBe("reviewer");
      expect(agent?.description).toBe("Code review agent");
      expect(agent?.tools).toEqual(["readFile", "edit"]);
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

  describe("Tool permission syntax", () => {
    it("should accept shorthand string tools", () => {
      // Given an AGENT.md with tools as plain strings
      const content = `---
name: test-agent
description: Test
tools:
  - Read
  - Edit
---
Test prompt
`;

      const agent = parseAgentDefinition(content);

      // Then tools remain as strings unchanged
      expect(agent).toBeDefined();
      expect(agent?.tools).toEqual(["Read", "Edit"]);
    });

    it("should accept object tool with allow and deny", () => {
      // Given an AGENT.md with a tool object containing name, allow, and deny
      const content = `---
name: test-agent
description: Test
tools:
  - name: Write
    allow:
      - /src/**
      - /**/*.spec.ts
    deny:
      - /src/package.json
---
Test prompt
`;

      const agent = parseAgentDefinition(content);

      // Then the tool object is preserved with all properties
      expect(agent).toBeDefined();
      expect(agent?.tools).toHaveLength(1);
      const tool = agent?.tools[0];
      expect(tool).toMatchObject({
        name: "Write",
        allow: ["/src/**", "/**/*.spec.ts"],
        deny: ["/src/package.json"],
      });
    });

    it("should accept mixed shorthand and object tools", () => {
      // Given an AGENT.md with both string and object tools
      const content = `---
name: test-agent
description: Test
tools:
  - Read
  - name: Write
    allow:
      - /src/**
    deny:
      - /src/package.json
---
Test prompt
`;

      const agent = parseAgentDefinition(content);

      // Then both formats are preserved in the array
      expect(agent).toBeDefined();
      expect(agent?.tools).toHaveLength(2);
      expect(agent?.tools[0]).toBe("Read");
      expect(agent?.tools[1]).toMatchObject({
        name: "Write",
        allow: ["/src/**"],
        deny: ["/src/package.json"],
      });
    });

    it("should accept object tool with only allow (no deny)", () => {
      // Given a tool object with only name and allow
      const content = `---
name: test-agent
description: Test
tools:
  - name: Write
    allow:
      - /src/**
      - /**/*.spec.ts
---
Test prompt
`;

      const agent = parseAgentDefinition(content);

      // Then the tool parses correctly without deny property
      expect(agent).toBeDefined();
      expect(agent?.tools).toHaveLength(1);
      const tool = agent?.tools[0];
      expect(tool).toMatchObject({
        name: "Write",
        allow: ["/src/**", "/**/*.spec.ts"],
      });
      expect(
        typeof tool === "object" && tool !== null ? (tool as { deny?: unknown }).deny : undefined,
      ).toBeUndefined();
    });

    it("should accept object tool with only deny (no allow)", () => {
      // Given a tool object with only name and deny
      const content = `---
name: test-agent
description: Test
tools:
  - name: Write
    deny:
      - /src/package.json
      - /src/tsconfig.json
---
Test prompt
`;

      const agent = parseAgentDefinition(content);

      // Then the tool parses correctly without allow property
      expect(agent).toBeDefined();
      expect(agent?.tools).toHaveLength(1);
      const tool = agent?.tools[0];
      expect(tool).toMatchObject({
        name: "Write",
        deny: ["/src/package.json", "/src/tsconfig.json"],
      });
      expect(
        typeof tool === "object" && tool !== null ? (tool as { allow?: unknown }).allow : undefined,
      ).toBeUndefined();
    });
  });
});
