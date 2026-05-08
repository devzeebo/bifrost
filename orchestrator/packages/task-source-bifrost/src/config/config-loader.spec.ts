import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { join, mkdir, randomBytes, rm, writeFile } from "node:fs/promises";
import { ConfigLoader } from "./config-loader";

describe("ConfigLoader", () => {
  let tempDir = "";
  let configPath = "";

  beforeEach(async () => {
    tempDir = join("/tmp", `bifrost-test-${randomBytes(8).toString("hex")}`);
    await mkdir(tempDir, { recursive: true });
    configPath = join(tempDir, ".bifrost.yaml");
  });

  afterEach(async () => {
    await rm(tempDir, { recursive: true, force: true });
  });

  describe("load", () => {
    it("should load valid .bifrost.yaml file", async () => {
      const yamlContent = "url: https://bifrost.example.com\nrealm: my-project\n";
      await writeFile(configPath, yamlContent, "utf-8");

      const loader = new ConfigLoader();
      const config = await loader.load(tempDir);

      expect(config).toEqual({
        url: "https://bifrost.example.com",
        realm: "my-project",
      });
    });

    it("should throw when .bifrost.yaml is missing", async () => {
      const loader = new ConfigLoader();

      await expect(loader.load(tempDir)).rejects.toThrow();
    });

    it("should throw when url is missing", async () => {
      const yamlContent = "realm: my-project\n";
      await writeFile(configPath, yamlContent, "utf-8");

      const loader = new ConfigLoader();

      await expect(loader.load(tempDir)).rejects.toThrow(
        "Invalid .bifrost.yaml: missing url or realm",
      );
    });

    it("should throw when realm is missing", async () => {
      const yamlContent = "url: https://bifrost.example.com\n";
      await writeFile(configPath, yamlContent, "utf-8");

      const loader = new ConfigLoader();

      await expect(loader.load(tempDir)).rejects.toThrow(
        "Invalid .bifrost.yaml: missing url or realm",
      );
    });

    it("should throw when file contains invalid YAML", async () => {
      const invalidYaml = "url: https://bifrost.example.com\nrealm: [unclosed\n";
      await writeFile(configPath, invalidYaml, "utf-8");

      const loader = new ConfigLoader();

      await expect(loader.load(tempDir)).rejects.toThrow();
    });

    it("should load with trailing slash in URL", async () => {
      const yamlContent = "url: https://bifrost.example.com/\nrealm: my-project\n";
      await writeFile(configPath, yamlContent, "utf-8");

      const loader = new ConfigLoader();
      const config = await loader.load(tempDir);

      expect(config.url).toBe("https://bifrost.example.com/");
    });
  });
});
