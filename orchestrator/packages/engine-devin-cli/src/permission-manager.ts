import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

export type DevinConfig = {
  permissions?: {
    allow: string[];
    deny: string[];
    ask: string[];
  };
};

export class PermissionManager {
  #configDir: string;

  public constructor() {
    this.#configDir = mkdtempSync(join(tmpdir(), "devin-config-"));
  }

  /**
   * Convert orchestrator tools to Devin permissions
   */
  public static convertToolsToPermissions(tools: AgentTool[]): DevinConfig["permissions"] {
    const allow: string[] = [];
    const deny: string[] = [];

    for (const tool of tools) {
      if (typeof tool === "string") {
        // Simple tool name - map to Devin permission
        const perm = PermissionManager.#mapToolToPermission(tool);
        if (perm) {
          allow.push(perm);
        }
      } else {
        // Tool with allow/deny arrays
        if (tool.allow) {
          for (const pattern of tool.allow) {
            allow.push(PermissionManager.#toolToPermission(tool.name, pattern));
          }
        }
        if (tool.deny) {
          for (const pattern of tool.deny) {
            deny.push(PermissionManager.#toolToPermission(tool.name, pattern));
          }
        }
      }
    }

    return { allow, deny, ask: [] };
  }

  /**
   * Create a temp config file with permissions for this session
   */
  public createConfig(permissions: DevinConfig["permissions"]): string {
    const config: DevinConfig = {
      permissions: permissions ?? { allow: [], deny: [], ask: [] },
    };

    const configPath = join(this.#configDir, "config.json");
    writeFileSync(configPath, JSON.stringify(config, null, 2));
    return configPath;
  }

  /**
   * Clean up temp config directory
   */
  public cleanup(): void {
    try {
      rmSync(this.#configDir, { recursive: true });
    } catch {
      // Ignore cleanup errors
    }
  }

  /**
   * Map orchestrator tool name to Devin permission format
   * Devin permissions: Read(pattern), Write(pattern), Exec(prefix), Fetch(pattern)
   */
  static #mapToolToPermission(tool: string): string | null {
    // Map common tool names to Devin permissions
    const toolMap: Record<string, string> = {
      Read: "Read(**)",
      Write: "Write(**)",
      Edit: "Write(**)", // Edit → Write in Devin
      Bash: "Exec(**)",
      Run: "Exec(**)",
      WebSearch: "Fetch(**)",
      WebBrowse: "Fetch(**)",
    };

    return toolMap[tool] ?? null;
  }

  /**
   * Convert tool + pattern to Devin permission string
   * Devin format: Read(pattern), Write(pattern), Exec(prefix), Fetch(pattern)
   */
  static #toolToPermission(toolName: string, pattern: string): string {
    // Convert orchestrator patterns to Devin permission format
    // Orchestrator: "**/*.ts" → Devin: "Write(**/*.ts)"
    // Orchestrator: "src/**" → Devin: "Read(src/**)"

    const tool = toolName.toLowerCase();
    let action: "Read" | "Write" | "Exec" | "Fetch" = "Read";

    if (tool.includes("write") || tool.includes("edit") || tool.includes("modify")) {
      action = "Write";
    } else if (tool.includes("bash") || tool.includes("exec") || tool.includes("run")) {
      action = "Exec";
    } else if (
      tool.includes("web") ||
      tool.includes("browse") ||
      tool.includes("fetch") ||
      tool.includes("search")
    ) {
      action = "Fetch";
    }

    return `${action}(${pattern})`;
  }
}

type AgentTool =
  | string
  | {
      name: string;
      allow?: string[];
      deny?: string[];
    };
