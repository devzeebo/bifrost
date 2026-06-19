import { spawn } from "node:child_process";
import type { DevinCliResult } from "./devin-types.js";
import { PermissionManager } from "./permission-manager.js";
import type { AgentTool } from "@bifrost-ai/engine";

export class DevinCli {
  #cwd: string;
  #permissionManager: PermissionManager;

  public constructor(cwd: string) {
    this.#cwd = cwd;
    this.#permissionManager = new PermissionManager();
  }

  public async execute(
    prompt: string,
    sessionId?: string,
    tools?: AgentTool[],
  ): Promise<DevinCliResult> {
    const args = DevinCli.#buildArgs(prompt, sessionId, tools);
    const process = spawn("devin", args, {
      cwd: this.#cwd,
      stdio: ["ignore", "pipe", "pipe"],
    });

    const stdout: Buffer[] = [];
    const stderr: Buffer[] = [];

    process.stdout.on("data", (chunk) => stdout.push(chunk));
    process.stderr.on("data", (chunk) => stderr.push(chunk));

    const exitCode = await new Promise<number>((resolve) => {
      process.on("close", resolve);
    });

    const output = Buffer.concat(stdout).toString();
    const error = Buffer.concat(stderr).toString();

    return {
      exitCode,
      stdout: output,
      stderr: error,
      success: exitCode === 0,
    };
  }

  public cleanup(): void {
    this.#permissionManager.cleanup();
  }

  static #buildArgs(prompt: string, sessionId?: string, tools?: AgentTool[]): string[] {
    const args = ["-p", "--"]; // Print mode + prompt separator

    if (sessionId) {
      args.unshift("-r", sessionId); // Resume specific session
    }

    if (tools && tools.length > 0) {
      const permManager = new PermissionManager();
      const permissions = PermissionManager.convertToolsToPermissions(tools);
      const configPath = permManager.createConfig(permissions);
      args.push("--config", configPath);
    }

    args.push(prompt);

    return args;
  }
}
