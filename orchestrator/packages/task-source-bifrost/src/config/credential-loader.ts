import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { homedir } from "node:os";
import { parse } from "yaml";
import type { BifrostCredentials } from "../types.js";

export class CredentialLoader {
  homeDir: string = process.env.BIFROST_TEST_HOME ?? homedir();

  async loadToken(url: string): Promise<string> {
    const credentialsPath = join(this.homeDir, ".config", "bifrost", "credentials.yaml");
    const content = await readFile(credentialsPath, "utf-8");
    const credentials = parse(content) as unknown;

    if (!this.isValidCredentials(credentials)) {
      throw new Error("Invalid credentials.yaml: missing credentials map");
    }

    const normalizedUrl = this.normalizeUrl(url);
    const entry = credentials.credentials[normalizedUrl];

    if (!entry || typeof entry.token !== "string") {
      throw new Error(`No token found for URL: ${normalizedUrl}`);
    }

    return entry.token;
  }

  private isValidCredentials(
    credentials: unknown,
  ): credentials is BifrostCredentials {
    return (
      typeof credentials === "object" &&
      credentials !== null &&
      "credentials" in credentials &&
      typeof (credentials as { credentials: unknown }).credentials === "object"
    );
  }

  private normalizeUrl(url: string): string {
    return url.replace(/\/$/, "");
  }
}
