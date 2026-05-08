import { mkdir, writeFile, readFile, stat } from "node:fs/promises";
import { join, resolve } from "node:path";

export type AgentWithRepoScripts = {
  name: string;
  hooks: {
    Start: Array<{ name: string; scriptPath: string; isRepoScript: boolean }>;
    Stop: Array<{ name: string; scriptPath: string; isRepoScript: boolean }>;
  };
};

/**
 * Install repo scripts to the working repository.
 * US-5: First run installs repo scripts into the working repository
 * FR-8: Working Repository Layout (after install)
 * FR-9: Agent Package Layout
 *
 * @param projectDir - The working repository root
 * @param agents - List of agents with their hooks
 * @param orchestratorPackagesPath - Path to orchestrator packages/ directory
 */
export const installRepoScripts = async (
  projectDir: string,
  agents: AgentWithRepoScripts[],
  orchestratorPackagesPath: string,
): Promise<void> => {
  for (const agent of agents) {
    for (const lifecycle of ["Start", "Stop"] as const) {
      const hooks = lifecycle === "Start" ? agent.hooks.Start : agent.hooks.Stop;

      for (const hook of hooks) {
        // Skip framework hooks - only install repo scripts
        if (!hook.isRepoScript) {
          continue;
        }

        // FR-9: Hook execution order within each .d/ directory: alphabetical by filename
        // Target path: .ai/<agent-name>/hooks/<lifecycle>.d/<hook-name>.mjs
        const targetDir = resolve(projectDir, ".ai", agent.name, "hooks", `${lifecycle}.d`);
        const targetPath = resolve(targetDir, `${hook.name}.mjs`);

        // Check if script already exists (US-5: idempotency)
        try {
          await stat(targetPath);
          console.log(`Already present: ${targetPath}`);
          continue;
        } catch {
          // File doesn't exist, proceed with installation
        }

        // FR-9: Repo scripts are provided in agent package at hooks/<lifecycle>.d/<hook-name>.mjs
        // Source path: <orchestrator-packages>/<agent-name>/hooks/<lifecycle>.d/<hook-name>.mjs
        const sourcePath = resolve(orchestratorPackagesPath, agent.name, hook.scriptPath);

        // Read the source script content
        const content = await readFile(sourcePath, "utf-8");

        // Create target directory
        await mkdir(targetDir, { recursive: true });

        // FR-8: Repo scripts are hard-copied (never symlinked)
        await writeFile(targetPath, content, "utf-8");

        console.log(`Installed: ${targetPath}`);
      }
    }
  }
};
