export const BASE_IMAGE = "clanker-cleanroom/base";

/** Home directory inside every agent image; world-writable so any host uid can use it. */
export const CONTAINER_HOME = "/home/agent";
/** Bind-mount target for the test workspace inside every agent image. */
export const CONTAINER_WORKSPACE = "/workspace";
/** Read-only bind-mount for staged agent input files. */
export const CONTAINER_INPUT = "/agent/input";
/** Read-write bind-mount for agent output files. */
export const CONTAINER_OUTPUT = "/agent/output";
