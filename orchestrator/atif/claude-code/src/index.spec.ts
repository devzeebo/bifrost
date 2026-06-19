/**
 * Tests for @atif/claude-code converter
 */

import { describe, it, expect } from "vitest";
import {
  parseJsonlString,
  convertJsonlStringToAtif,
  isUserEntry,
  isAssistantEntry,
  isTextBlock,
} from "./index.js";
import type { StepObject } from "@atif/core";

describe("atif/claude-code", () => {
  const sampleJsonl = `{"type":"user","uuid":"user-1","timestamp":"2026-06-08T19:41:35.584Z","sessionId":"test-session","version":"2.1.159","userType":"external","entrypoint":"cli","cwd":"/home/devzeebo/test","gitBranch":"main","slug":"test-slug","parentUuid":null,"isSidechain":false,"message":{"role":"user","content":[{"type":"text","text":"Hello, can you help me?"}]}}
{"type":"assistant","uuid":"assistant-1","timestamp":"2026-06-08T19:41:37.511Z","sessionId":"test-session","version":"2.1.159","userType":"external","entrypoint":"cli","cwd":"/home/devzeebo/test","gitBranch":"main","slug":"test-slug","parentUuid":"user-1","isSidechain":false,"message":{"model":"claude-sonnet-4-6","id":"msg_01","type":"message","role":"assistant","content":[{"type":"text","text":"I'd be happy to help you! What do you need?"}],"stop_reason":"end_turn","stop_sequence":null,"stop_details":null,"usage":{"input_tokens":10,"output_tokens":20,"cache_read_input_tokens":5},"diagnostics":null},"requestId":"req_01"}
{"type":"user","uuid":"user-2","timestamp":"2026-06-08T19:41:40.584Z","sessionId":"test-session","version":"2.1.159","userType":"external","entrypoint":"cli","cwd":"/home/devzeebo/test","gitBranch":"main","slug":"test-slug","parentUuid":"assistant-1","isSidechain":false,"message":{"role":"user","content":[{"type":"text","text":"Tell me a joke"}]}}`;

  describe("parseJsonlString", () => {
    it("should parse JSONL string into entries", () => {
      const entries = parseJsonlString(sampleJsonl);

      expect(entries).toHaveLength(3);
      expect(entries[0]?.type).toBe("user");
      expect(entries[1]?.type).toBe("assistant");
      expect(entries[2]?.type).toBe("user");
    });

    it("should handle empty lines", () => {
      const jsonlWithEmptyLines = `${sampleJsonl}\n\n`;
      const entries = parseJsonlString(jsonlWithEmptyLines);

      expect(entries).toHaveLength(3);
    });
  });

  describe("type guards", () => {
    it("should identify user entries", () => {
      const entries = parseJsonlString(sampleJsonl);
      const userEntry = entries.find(isUserEntry);

      expect(userEntry).toBeDefined();
      expect(userEntry?.type).toBe("user");
    });

    it("should identify assistant entries", () => {
      const entries = parseJsonlString(sampleJsonl);
      const assistantEntry = entries.find(isAssistantEntry);

      expect(assistantEntry).toBeDefined();
      expect(assistantEntry?.type).toBe("assistant");
    });
  });

  describe("content block type guards", () => {
    it("should identify text blocks", () => {
      const entries = parseJsonlString(sampleJsonl);
      const userEntry = entries.find(isUserEntry);

      expect(userEntry).toBeDefined();
      const textBlocks = userEntry?.message.content.filter(isTextBlock);
      expect(textBlocks).toHaveLength(1);
      expect(textBlocks?.[0]?.text).toBe("Hello, can you help me?");
    });
  });

  describe("convertJsonlStringToAtif", () => {
    it("should convert JSONL to ATIF trajectory", () => {
      const trajectory = convertJsonlStringToAtif(sampleJsonl);

      expect(trajectory).toBeDefined();
      expect(trajectory.schema_version).toBe("ATIF-v1.7");
      expect(trajectory.session_id).toBe("test-session");
      expect(trajectory.agent.name).toBe("claude-code");
      expect(trajectory.agent.version).toBe("2.1.159");
      expect(trajectory.steps).toHaveLength(3);
    });

    it("should build user steps correctly", () => {
      const trajectory = convertJsonlStringToAtif(sampleJsonl);

      const userStep = trajectory.steps.find((step: StepObject) => step.source === "user");
      expect(userStep).toBeDefined();
      expect(userStep?.message).toBe("Hello, can you help me?");
    });

    it("should build agent steps correctly", () => {
      const trajectory = convertJsonlStringToAtif(sampleJsonl);

      const agentStep = trajectory.steps.find((step: StepObject) => step.source === "agent");
      expect(agentStep).toBeDefined();
      expect(agentStep?.model_name).toBe("claude-sonnet-4-6");
      expect(agentStep?.metrics?.prompt_tokens).toBe(10);
      expect(agentStep?.metrics?.completion_tokens).toBe(20);
    });

    it("should aggregate metrics correctly", () => {
      const trajectory = convertJsonlStringToAtif(sampleJsonl);

      expect(trajectory.final_metrics).toBeDefined();
      expect(trajectory.final_metrics?.total_steps).toBe(3);
    });
  });
});
