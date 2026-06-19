import { beforeEach, describe, expect, it, afterEach } from "vitest";
import { PermissionManager } from "./permission-manager.js";

describe("PermissionManager", () => {
  let permissionManager: PermissionManager = null!;

  beforeEach(() => {
    permissionManager = new PermissionManager();
  });

  afterEach(() => {
    permissionManager.cleanup();
  });

  describe("convertToolsToPermissions", () => {
    it("should convert simple tool names to Devin permissions", () => {
      const tools = ["Read", "Write", "Bash"];
      const permissions = PermissionManager.convertToolsToPermissions(tools);

      expect(permissions?.allow).toEqual(["Read(**)", "Write(**)", "Exec(**)"]);
      expect(permissions?.deny).toEqual([]);
    });

    it("should handle tools with allow patterns", () => {
      const tools = [
        {
          name: "Write",
          allow: ["src/**/*.ts", "lib/**/*.ts"],
          deny: ["**/*.test.ts"],
        },
      ];
      const permissions = PermissionManager.convertToolsToPermissions(tools);

      expect(permissions?.allow).toContain("Write(src/**/*.ts)");
      expect(permissions?.allow).toContain("Write(lib/**/*.ts)");
      expect(permissions?.deny).toContain("Write(**/*.test.ts)");
    });

    it("should handle empty tools array", () => {
      const permissions = PermissionManager.convertToolsToPermissions([]);

      expect(permissions?.allow).toEqual([]);
      expect(permissions?.deny).toEqual([]);
      expect(permissions?.ask).toEqual([]);
    });

    it("should map tool names with action keywords correctly", () => {
      const tools = ["Bash", "Edit", "WebSearch"];
      const permissions = PermissionManager.convertToolsToPermissions(tools);

      expect(permissions?.allow).toContain("Exec(**)");
      expect(permissions?.allow).toContain("Write(**)"); // Edit → Write in Devin
      expect(permissions?.allow).toContain("Fetch(**)"); // WebSearch → Fetch
    });
  });

  describe("createConfig", () => {
    it("should create a config file with permissions", () => {
      const permissions = {
        allow: ["Read(src/**)", "Exec(npm run)"],
        deny: ["Exec(rm)"],
        ask: [],
      };

      const configPath = permissionManager.createConfig("task-123", permissions);

      expect(configPath).toBe("/tmp/bifrost-ai/engine-devin/task-123.config.json");
    });

    it("should create config with default permissions if none provided", () => {
      const permissions = { allow: [], deny: [], ask: [] };
      const configPath = permissionManager.createConfig("task-456", permissions);

      expect(configPath).toBe("/tmp/bifrost-ai/engine-devin/task-456.config.json");
    });
  });

  describe("cleanup", () => {
    it("should clean up config file", () => {
      const manager = new PermissionManager();

      // Create a config
      const permissions = { allow: ["Read(**)"], deny: [], ask: [] };
      manager.createConfig("task-cleanup", permissions);

      // Cleanup should not throw
      expect(() => manager.cleanup()).not.toThrow();
    });
  });
});
