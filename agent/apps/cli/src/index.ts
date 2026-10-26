#!/usr/bin/env node
import { realpathSync } from "node:fs";
import { resolve } from "node:path";
import { pathToFileURL } from "node:url";

import { runCli } from "./runCli.ts";

export { loadTools } from "./loadTools.ts";
export { parseCli } from "./parseCli.ts";
export { runCli } from "./runCli.ts";

const isDirectExecution = (entry: string | undefined): boolean => {
  if (entry === undefined) {
    return false;
  }

  try {
    const entryUrl = pathToFileURL(realpathSync(resolve(entry))).href;
    return import.meta.url === entryUrl;
  } catch {
    return false;
  }
};

if (isDirectExecution(process.argv[1])) {
  process.exitCode = await runCli(process.argv.slice(2));
}
