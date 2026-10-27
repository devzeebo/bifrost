import { pathToFileURL } from "node:url";
import { resolve } from "node:path";

import type { Engine } from "@bifrost-ai/engines";

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null && !Array.isArray(value);

const isHook = (value: unknown): boolean => value === undefined || typeof value === "function";

const isEngine = (value: unknown): value is Engine => {
  if (!isRecord(value)) {
    return false;
  }
  const prepare = value["prepare"];
  const receive = value["receive"];
  return (
    typeof value["name"] === "string" &&
    value["name"].trim() !== "" &&
    isHook(prepare) &&
    isHook(receive) &&
    (typeof prepare === "function" || typeof receive === "function")
  );
};

const enginesFromExport = (value: unknown): readonly Engine[] | undefined => {
  if (Array.isArray(value) && value.every(isEngine)) {
    return value;
  }
  if (isRecord(value) && Array.isArray(value["engines"]) && value["engines"].every(isEngine)) {
    return value["engines"];
  }
  if (isEngine(value)) {
    return [value];
  }
  return undefined;
};

export const loadEngines = async (paths: readonly string[]): Promise<Engine[]> => {
  const engines: Engine[] = [];
  for (const enginePath of paths) {
    const loaded: unknown = await import(pathToFileURL(resolve(enginePath)).href);
    const exported = isRecord(loaded) ? loaded["default"] : undefined;
    const list = enginesFromExport(exported);
    if (list === undefined) {
      throw new Error(
        `Engine module ${enginePath} must default-export an Engine, Engine[], or { engines: Engine[] }`,
      );
    }
    engines.push(...list);
  }
  return engines;
};
