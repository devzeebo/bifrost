import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { mkdir, rm, writeFile } from "node:fs/promises";
import { randomBytes } from "node:crypto";
import { join } from "node:path";
import { CredentialLoader } from "./credential-loader";

describe("CredentialLoader", () => {
  let mockHomeDir = "";

  beforeEach(async () => {
    mockHomeDir = join("/tmp", `bifrost-test-${randomBytes(8).toString("hex")}`);
    await mkdir(join(mockHomeDir, ".config", "bifrost"), { recursive: true });
  });

  afterEach(async () => {
    await rm(mockHomeDir, { recursive: true, force: true });
  });

  describe("loadToken", () => {
    it("should load token for exact URL match", async () => {
      const credentialsContent =
        "credentials:\n  https://bifrost.example.com:\n    token: test-pat-123\n";
      const credentialsPath = join(mockHomeDir, ".config", "bifrost", "credentials.yaml");
      await writeFile(credentialsPath, credentialsContent, "utf-8");

      const loader = new CredentialLoader();
      loader.homeDir = mockHomeDir;

      const token = await loader.loadToken("https://bifrost.example.com");

      expect(token).toBe("test-pat-123");
    });

    it("should normalize trailing slash when looking up token", async () => {
      const credentialsContent =
        "credentials:\n  https://bifrost.example.com:\n    token: test-pat-789\n";
      const credentialsPath = join(mockHomeDir, ".config", "bifrost", "credentials.yaml");
      await writeFile(credentialsPath, credentialsContent, "utf-8");

      const loader = new CredentialLoader();
      loader.homeDir = mockHomeDir;

      const token = await loader.loadToken("https://bifrost.example.com/");

      expect(token).toBe("test-pat-789");
    });

    it("should support multiple server URLs", async () => {
      const credentialsContent =
        "credentials:\n  https://bifrost.example.com:\n    token: pat-1\n  http://localhost:8080:\n    token: pat-2\n";
      const credentialsPath = join(mockHomeDir, ".config", "bifrost", "credentials.yaml");
      await writeFile(credentialsPath, credentialsContent, "utf-8");

      const loader = new CredentialLoader();
      loader.homeDir = mockHomeDir;

      const token1 = await loader.loadToken("https://bifrost.example.com");
      const token2 = await loader.loadToken("http://localhost:8080");

      expect(token1).toBe("pat-1");
      expect(token2).toBe("pat-2");
    });

    it("should throw when URL not found in credentials", async () => {
      const credentialsContent =
        "credentials:\n  https://bifrost.example.com:\n    token: test-pat-123\n";
      const credentialsPath = join(mockHomeDir, ".config", "bifrost", "credentials.yaml");
      await writeFile(credentialsPath, credentialsContent, "utf-8");

      const loader = new CredentialLoader();
      loader.homeDir = mockHomeDir;

      await expect(loader.loadToken("https://other.example.com")).rejects.toThrow(
        "No token found for URL: https://other.example.com",
      );
    });

    it("should throw when credentials map is missing", async () => {
      const invalidYaml = "invalid: yaml content";
      const credentialsPath = join(mockHomeDir, ".config", "bifrost", "credentials.yaml");
      await writeFile(credentialsPath, invalidYaml, "utf-8");

      const loader = new CredentialLoader();
      loader.homeDir = mockHomeDir;

      await expect(loader.loadToken("https://bifrost.example.com")).rejects.toThrow(
        "Invalid credentials.yaml: missing credentials map",
      );
    });
  });
});
