import { CONTAINER_OUTPUT } from "../base/constants.js";
import { TRAJECTORY_FILE } from "./constants.js";

/** Container path where the agent CLI streams NDJSON via shell redirect. */
export const CONTAINER_TRAJECTORY_PATH = `${CONTAINER_OUTPUT}/${TRAJECTORY_FILE}`;

/**
 * Wrap agent argv so stdout streams to {@link CONTAINER_TRAJECTORY_PATH}.
 * Prompt and flags stay as separate argv entries (no shell quoting).
 */
export function wrapCommandWithTrajectoryRedirect(command: readonly string[]): string[] {
  return ["sh", "-c", `exec "$@" > ${CONTAINER_TRAJECTORY_PATH}`, "sh", ...command];
}
