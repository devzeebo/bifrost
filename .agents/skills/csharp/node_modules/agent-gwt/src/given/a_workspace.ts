import { mkdir, mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

import type { AgentContext } from "../types.js";

export const AGENTS_GWT_TMP_ROOT = join(tmpdir(), ".agents-gwt");

export async function a_workspace(this: AgentContext): Promise<void> {
  await mkdir(AGENTS_GWT_TMP_ROOT, { recursive: true });
  this.workspace = await mkdtemp(join(AGENTS_GWT_TMP_ROOT, "ws-"));
}

export async function cleanup_workspace(this: AgentContext): Promise<void> {
  if (this.workspace === undefined || this.workspace === "") {
    return;
  }

  await rm(this.workspace, { recursive: true, force: true });
}
