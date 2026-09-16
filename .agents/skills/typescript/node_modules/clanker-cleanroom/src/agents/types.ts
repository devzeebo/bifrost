import type { TrajectoryEvent, TrajectoryKind } from "./trajectory/types.js";

export type TokenUsage = {
  inputTokens: number | null;
  outputTokens: number | null;
  cacheReadTokens: number | null;
  cacheWriteTokens: number | null;
};

/** Normalized metrics from an agent run. Dialog/transcript is not included. */
export type AgentRunResult = {
  durationMs: number | null;
  costUsd: number | null;
  usage: TokenUsage;
};

export type RunAgentOptions = {
  workspace: string;
  prompt: string;
  model?: string;
  /** Override the agent's default image (e.g. for one-off local tags). */
  image?: string;
};

export type AgentRunBindingsOptions = RunAgentOptions & {
  image: string;
};

export type AgentOptions = {
  model?: string;
  /** Docker image tag to ensure and run (defaults to the resolved agent's image). */
  image?: string;
};

export type DockerRunResult = {
  exitCode: number | null;
  stdout: string;
  stderr: string;
};

export type DockerRunOptions = {
  /** Forward docker stdout/stderr to the parent process while still capturing. */
  inheritOutput?: boolean;
  /**
   * Extra environment for the `docker` CLI process itself. Pair with
   * `envPassthrough` to hand a secret to the container without it ever
   * appearing on the host command line.
   */
  env?: Record<string, string>;
};

export type DockerRunner = (args: string[], options?: DockerRunOptions) => Promise<DockerRunResult>;

export type DockerVolumeMount = {
  host: string;
  container: string;
  mode?: "ro" | "rw";
};

export type BuildDockerRunArgsOptions = {
  image: string;
  uid: number;
  gid: number;
  workdir: string;
  command: string[];
  /** `-e NAME=value` — value is visible on the host command line. */
  env?: Record<string, string>;
  /** `-e NAME` — value is read from the docker CLI's own environment, never on argv. */
  envPassthrough?: string[];
  volumes?: DockerVolumeMount[];
};

export type EnsureDockerImageOptions = {
  dockerRunner?: DockerRunner;
};

export type AgentPrepareResult = {
  volumes?: DockerVolumeMount[];
  /** Values for the docker CLI process (never on argv). */
  env?: Record<string, string>;
};

export type AgentBinding = {
  image: string;
  displayName: string;
  /** Provider id recorded on normalized trajectories. */
  trajectoryKind: TrajectoryKind;
  /** Map raw CLI NDJSON events → normalized trajectory events. */
  adaptEvents: (rawEvents: readonly unknown[]) => TrajectoryEvent[];
  command: (opts: { prompt: string; model?: string }) => string[];
  /**
   * Resolve host-side secrets into mounts + docker-CLI env.
   * Workspace → CONTAINER_WORKSPACE and I/O mounts are always added by the shared runner.
   */
  prepare: (opts: { workspace: string }) => Promise<AgentPrepareResult>;
  /** Map trajectory NDJSON → normalized metrics (throw on agent-reported failure). */
  parseResult: (trajectory: string) => AgentRunResult;
  describeFailure?: (trajectory: string) => string | undefined;
};

export function emptyTokenUsage(): TokenUsage {
  return {
    inputTokens: null,
    outputTokens: null,
    cacheReadTokens: null,
    cacheWriteTokens: null,
  };
}

export function readTokenCount(value: unknown): number | null {
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}
