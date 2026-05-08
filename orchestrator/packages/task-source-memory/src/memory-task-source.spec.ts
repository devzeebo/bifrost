import { describe, expect, it } from "vitest";
import { MemoryTaskSource } from "./memory-task-source.js";

describe("MemoryTaskSource", () => {
  describe("watchTasks", () => {
    it("should yield tasks with id, agentId, taskState, and metadata", async () => {
      const source = new MemoryTaskSource();

      await source.addTask({
        id: "task-1",
        agentId: "agent-1",
        taskState: { foo: "bar" },
        metadata: { tags: ["bug"] },
      });

      const tasks: string[] = [];
      for await (const task of source.watchTasks()) {
        tasks.push(task.id);
        expect(task.id).toBe("task-1");
        expect(task.agentId).toBe("agent-1");
        expect(task.taskState).toEqual({ foo: "bar" });
        expect(task.metadata).toEqual({ tags: ["bug"] });
        break;
      }

      expect(tasks).toHaveLength(1);
    });

    it("should mark task as IN_PROGRESS when yielded", async () => {
      const source = new MemoryTaskSource();

      await source.addTask({
        id: "task-1",
        agentId: "agent-1",
        taskState: {},
        metadata: {},
      });

      for await (const task of source.watchTasks()) {
        const internal = source.getInternalTask(task.id);
        expect(internal?.status).toBe("IN_PROGRESS");
        break;
      }
    });

    it("should not yield the same task twice", async () => {
      const source = new MemoryTaskSource();

      await source.addTask({
        id: "task-1",
        agentId: "agent-1",
        taskState: {},
        metadata: {},
      });

      let yieldedCount = 0;
      for await (const _task of source.watchTasks()) {
        yieldedCount++;
      }

      expect(yieldedCount).toBe(1);
    });
  });

  describe("completeTask", () => {
    it("should mark task as COMPLETED", async () => {
      const source = new MemoryTaskSource();

      await source.addTask({
        id: "task-1",
        agentId: "agent-1",
        taskState: {},
        metadata: {},
      });

      await source.completeTask("task-1");

      const internal = source.getInternalTask("task-1");
      expect(internal?.status).toBe("COMPLETED");
    });

    it("should throw if task not found", async () => {
      const source = new MemoryTaskSource();

      await expect(source.completeTask("unknown")).rejects.toThrow("Task unknown not found");
    });
  });

  describe("failTask", () => {
    it("should mark task as FAILED with error message", async () => {
      const source = new MemoryTaskSource();

      await source.addTask({
        id: "task-1",
        agentId: "agent-1",
        taskState: {},
        metadata: {},
      });

      await source.failTask("task-1", "Test error");

      const internal = source.getInternalTask("task-1");
      expect(internal?.status).toBe("FAILED");
      expect(internal?.error).toBe("Test error");
    });

    it("should throw if task not found", async () => {
      const source = new MemoryTaskSource();

      await expect(source.failTask("unknown", "error")).rejects.toThrow("Task unknown not found");
    });
  });

  describe("setState", () => {
    it("should update taskState", async () => {
      const source = new MemoryTaskSource();

      await source.addTask({
        id: "task-1",
        agentId: "agent-1",
        taskState: { foo: "bar" },
        metadata: {},
      });

      await source.setState("task-1", { foo: "baz", newField: "value" });

      const internal = source.getInternalTask("task-1");
      expect(internal?.taskState).toEqual({ foo: "baz", newField: "value" });
    });

    it("should throw if task not found", async () => {
      const source = new MemoryTaskSource();

      await expect(source.setState("unknown", {})).rejects.toThrow("Task unknown not found");
    });
  });

  describe("orchestration lifecycle", () => {
    it("should support full task lifecycle: add → watch → setState → complete", async () => {
      const source = new MemoryTaskSource();

      // Add task
      await source.addTask({
        id: "task-1",
        agentId: "agent-1",
        taskState: { step: 1 },
        metadata: { priority: "high" },
      });

      // Watch task
      for await (const task of source.watchTasks()) {
        expect(task.id).toBe("task-1");

        // Engine updates state
        await source.setState(task.id, { step: 2 });

        const internal = source.getInternalTask(task.id);
        expect(internal?.taskState).toEqual({ step: 2 });

        // Complete task
        await source.completeTask(task.id);

        expect(source.getInternalTask(task.id)?.status).toBe("COMPLETED");
        break;
      }
    });

    it("should support failed task lifecycle: add → watch → fail", async () => {
      const source = new MemoryTaskSource();

      await source.addTask({
        id: "task-1",
        agentId: "agent-1",
        taskState: {},
        metadata: {},
      });

      for await (const task of source.watchTasks()) {
        await source.failTask(task.id, "Execution failed");

        expect(source.getInternalTask(task.id)?.status).toBe("FAILED");
        expect(source.getInternalTask(task.id)?.error).toBe("Execution failed");
        break;
      }
    });
  });
});
