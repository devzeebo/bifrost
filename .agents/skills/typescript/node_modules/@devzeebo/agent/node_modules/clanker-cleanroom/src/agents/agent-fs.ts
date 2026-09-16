import { mkdir, mkdtemp, readdir, readFile, rm, stat, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { dirname, join, relative, resolve, sep } from "node:path";

export type AgentFsOptions = {
  /** Directory under which to create the ephemeral root (defaults to `os.tmpdir()`). */
  readonly tmpDir?: string;
};

/**
 * Host-backed file tree staged into the container at {@link AgentFs.containerPath}.
 * Roots are created lazily under a temp directory (swap-friendly later via a provider).
 */
export class AgentFs {
  readonly containerPath: string;
  private root: string | undefined;
  private readonly tmpPrefix: string;

  constructor(containerPath: string, options: AgentFsOptions = {}) {
    this.containerPath = containerPath;
    this.tmpPrefix = join(options.tmpDir ?? tmpdir(), "clanker-io-");
  }

  /** Ensure the host root exists and return its absolute path (for Docker mounts). */
  async ensure(): Promise<string> {
    if (this.root === undefined) {
      this.root = await mkdtemp(this.tmpPrefix);
    }
    return this.root;
  }

  async write(relativePath: string, data: string | Uint8Array): Promise<void> {
    const root = await this.ensure();
    const absolutePath = resolveSafe(root, relativePath);
    await mkdir(dirname(absolutePath), { recursive: true });
    await writeFile(absolutePath, data);
  }

  async read(relativePath: string): Promise<Buffer> {
    const root = await this.ensure();
    const absolutePath = resolveSafe(root, relativePath);
    return readFile(absolutePath);
  }

  async readText(relativePath: string): Promise<string> {
    return (await this.read(relativePath)).toString("utf8");
  }

  /** Relative POSIX paths of all files under the root. */
  async list(): Promise<string[]> {
    const root = await this.ensure();
    const names = await readdir(root, { recursive: true });
    const files: string[] = [];

    for (const name of names) {
      const absolutePath = join(root, name);
      if (!isInsideRoot(root, absolutePath)) {
        throw new Error(`AgentFs: listed path escapes root: ${absolutePath}`);
      }

      const info = await stat(absolutePath);
      if (!info.isFile()) {
        continue;
      }

      files.push(toPosixRelative(root, absolutePath));
    }

    return files.sort();
  }

  /** Remove all contents; keeps (or creates) the empty root directory. */
  async clear(): Promise<void> {
    const root = await this.ensure();
    const entries = await readdir(root);
    await Promise.all(
      entries.map((entry) => rm(join(root, entry), { recursive: true, force: true })),
    );
  }
}

function resolveSafe(root: string, relativePath: string): string {
  assertSafeRelative(relativePath);
  const absolutePath = resolve(root, ...relativePath.replaceAll("\\", "/").split("/"));
  if (!isInsideRoot(root, absolutePath)) {
    throw new Error(`AgentFs: path escapes root: ${relativePath}`);
  }
  return absolutePath;
}

function assertSafeRelative(relativePath: string): void {
  if (relativePath.includes("\0")) {
    throw new Error(`AgentFs: path contains null byte: ${relativePath}`);
  }

  const normalized = relativePath.replaceAll("\\", "/");
  const segments = normalized.split("/");
  if (
    segments.length === 0 ||
    segments.some((segment) => segment === "" || segment === "." || segment === "..")
  ) {
    throw new Error(`AgentFs: not a safe relative path: ${relativePath}`);
  }
}

function toPosixRelative(root: string, absolutePath: string): string {
  return relative(root, absolutePath).split(sep).join("/");
}

function isInsideRoot(root: string, absolutePath: string): boolean {
  const rel = relative(resolve(root), resolve(absolutePath));
  return rel !== "" && !rel.startsWith(`..${sep}`) && rel !== ".." && !rel.startsWith("../");
}
