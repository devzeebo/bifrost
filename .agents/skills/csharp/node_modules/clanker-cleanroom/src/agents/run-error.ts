import type { DockerRunResult } from "./types.js";

export type AgentRunErrorOptions = {
  /** Display name for the message, e.g. "Cursor". */
  agent: string;
  image: string;
  result: DockerRunResult;
  /** Failure message the CLI itself reported, when it printed one. */
  detail?: string | undefined;
};

/** Error for a non-zero `docker run` exit, with a build hint when docker could not find the image. */
export function agentRunError(options: AgentRunErrorOptions): Error {
  const { exitCode, stdout, stderr } = options.result;
  const headline =
    options.detail === undefined
      ? `${options.agent} agent exited with code ${exitCode}.`
      : `${options.agent} agent exited with code ${exitCode}: ${options.detail}`;
  const hint =
    stderr.includes("Unable to find image") || stderr.includes("not found")
      ? `\nDocker image ${options.image} not found; build it with buildImages() in vitest globalSetup.`
      : "";

  return new Error(`${headline}${hint}\nstderr:\n${stderr}\nstdout:\n${stdout}`);
}
