import { spawn } from "node:child_process";
import type { DevinCliResult } from "./devin-types.js";

export class DevinCli {
  #cwd: string;

  public constructor(cwd: string) {
    this.#cwd = cwd;
  }

  public async execute(prompt: string, sessionId?: string): Promise<DevinCliResult> {
    const args = DevinCli.#buildArgs(prompt, sessionId);
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

  static #buildArgs(prompt: string, sessionId?: string): string[] {
    const args = ["-p", "--"]; // Print mode + prompt separator

    if (sessionId) {
      args.unshift("-r", sessionId); // Resume specific session
    }

    args.push(prompt);

    return args;
  }
}
