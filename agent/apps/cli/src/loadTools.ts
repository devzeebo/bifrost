import { pathToFileURL } from "node:url";
import { resolve } from "node:path";

import type { Tool } from "@bifrost-ai/tools";

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null && !Array.isArray(value);

const isTool = (value: unknown): value is Tool => {
  if (!isRecord(value)) {
    return false;
  }
  return (
    typeof value["name"] === "string" &&
    typeof value["description"] === "string" &&
    isRecord(value["parameters"]) &&
    typeof value["execute"] === "function"
  );
};

const toolsFromExport = (value: unknown): readonly Tool[] | undefined => {
  if (Array.isArray(value) && value.every(isTool)) {
    return value;
  }
  if (isRecord(value) && Array.isArray(value["tools"]) && value["tools"].every(isTool)) {
    return value["tools"];
  }
  return undefined;
};

export const loadTools = async (paths: readonly string[]): Promise<Tool[]> => {
  const tools: Tool[] = [];
  for (const toolPath of paths) {
    const loaded: unknown = await import(pathToFileURL(resolve(toolPath)).href);
    const exported = isRecord(loaded) ? loaded["default"] : undefined;
    const list = toolsFromExport(exported);
    if (list === undefined) {
      throw new Error(`Tools module ${toolPath} must default-export Tool[] or { tools: Tool[] }`);
    }
    tools.push(...list);
  }
  return tools;
};
