import { parse } from "yaml";
import { join, readFile } from "node:path";
import type { BifrostConfig } from "../types";

export class ConfigLoader {
  public async load(projectRoot: string = process.cwd()): Promise<BifrostConfig> {
    const configPath = join(projectRoot, ".bifrost.yaml");
    const content = await readFile(configPath, "utf-8");
    const config = parse(content) as unknown;

    if (!this.isValidConfig(config)) {
      throw new Error("Invalid .bifrost.yaml: missing url or realm");
    }

    return { url: config.url, realm: config.realm };
  }

  public static isValidConfig(config: unknown): config is { url: string; realm: string } {
    return (
      typeof config === "object" &&
      config !== null &&
      "url" in config &&
      "realm" in config &&
      typeof (config as { url: unknown }).url === "string" &&
      typeof (config as { realm: unknown }).realm === "string"
    );
  }
}
