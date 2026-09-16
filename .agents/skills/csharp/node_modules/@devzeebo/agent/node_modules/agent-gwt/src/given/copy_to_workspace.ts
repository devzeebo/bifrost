import { copyFile, mkdir, readdir, stat } from "node:fs/promises";
import { dirname, isAbsolute, join, relative, resolve, sep } from "node:path";
import { fileURLToPath } from "node:url";

export type CopyToWorkspaceOptions = {
  readonly from?: string;
  readonly base?: string;
};

export async function copy_to_workspace(
  workspace: string,
  globs: readonly string[],
  options?: CopyToWorkspaceOptions,
): Promise<void> {
  if (globs.length === 0) {
    throw new Error("copy_to_workspace: globs must not be empty");
  }

  const from = await resolveSourceRoot(options);
  const resolvedWorkspace = resolve(workspace);
  const base = options?.base;
  const copies: Array<{ source: string; destination: string }> = [];
  const destinationSources = new Map<string, string>();

  for (const glob of globs) {
    const matches = await expandGlob(from, glob);
    if (matches.length === 0) {
      throw new Error(`copy_to_workspace: glob "${glob}" matched no files under ${from}`);
    }

    for (const relativePath of matches) {
      const destinationRelative = base === undefined ? relativePath : stripBase(relativePath, base);
      assertSafeRelative(destinationRelative, "destination");

      const source = resolve(from, relativePath);
      const destination = resolve(resolvedWorkspace, destinationRelative);
      if (!isInsideRoot(resolvedWorkspace, destination)) {
        throw new Error(`copy_to_workspace: destination escapes workspace: ${destinationRelative}`);
      }

      const existingSource = destinationSources.get(destinationRelative);
      if (existingSource !== undefined) {
        if (existingSource === source) {
          continue;
        }
        throw new Error(
          `copy_to_workspace: destination "${destinationRelative}" maps to multiple files`,
        );
      }

      destinationSources.set(destinationRelative, source);
      copies.push({ source, destination });
    }
  }

  for (const { source, destination } of copies) {
    await mkdir(dirname(destination), { recursive: true });
    await copyFile(source, destination);
  }
}

async function resolveSourceRoot(options: CopyToWorkspaceOptions | undefined): Promise<string> {
  const from = options?.from;
  if (from !== undefined && isAbsolute(from)) {
    return resolve(from);
  }

  const specDir = await currentSpecDirectory();
  if (from === undefined) {
    return specDir;
  }

  return resolve(specDir, from);
}

async function currentSpecDirectory(): Promise<string> {
  const { expect } = await import("vitest");
  const testPath = expect.getState().testPath;
  if (testPath === undefined || testPath === "") {
    throw new Error(
      "copy_to_workspace: cannot resolve the spec directory; pass options.from or call from a Vitest test",
    );
  }

  const specFile = testPath.startsWith("file:") ? fileURLToPath(testPath) : testPath;
  return dirname(specFile);
}

async function expandGlob(from: string, glob: string): Promise<string[]> {
  const posixGlob = glob.replaceAll("\\", "/");
  const matcher = globToRegExp(posixGlob);
  const prefixSegments = globStaticPrefix(posixGlob);
  const walkRoot = prefixSegments.length === 0 ? from : join(from, ...prefixSegments);
  if (!isInsideRootOrEqual(from, walkRoot)) {
    throw new Error(`copy_to_workspace: glob "${glob}" escapes source root`);
  }

  let walkInfo;
  try {
    walkInfo = await stat(walkRoot);
  } catch (error: unknown) {
    if (isEnoent(error)) {
      return [];
    }
    throw error;
  }

  if (walkInfo.isFile()) {
    const relativePath = toPosixRelative(from, walkRoot);
    if (!matcher.test(relativePath)) {
      return [];
    }
    return [relativePath];
  }

  if (!walkInfo.isDirectory()) {
    return [];
  }

  const names = await readdir(walkRoot, { recursive: true });
  const matches: string[] = [];

  for (const name of names) {
    const absolutePath = join(walkRoot, name);
    if (!isInsideRoot(from, absolutePath)) {
      throw new Error(`copy_to_workspace: matched path escapes source root: ${absolutePath}`);
    }

    const info = await stat(absolutePath);
    const relativePath = toPosixRelative(from, absolutePath);
    if (!info.isFile() || !matcher.test(relativePath)) {
      continue;
    }

    matches.push(relativePath);
  }

  return matches;
}

function globStaticPrefix(glob: string): string[] {
  const segments: string[] = [];
  for (const segment of glob.split("/")) {
    if (segment === "" || segment.includes("*") || segment.includes("?")) {
      break;
    }
    segments.push(segment);
  }
  return segments;
}

function toPosixRelative(from: string, absolutePath: string): string {
  return relative(from, absolutePath).split(sep).join("/");
}

function isInsideRootOrEqual(root: string, absolutePath: string): boolean {
  return resolve(root) === resolve(absolutePath) || isInsideRoot(root, absolutePath);
}

function isInsideRoot(root: string, absolutePath: string): boolean {
  const rel = relative(resolve(root), resolve(absolutePath));
  return rel !== "" && !rel.startsWith(`..${sep}`) && rel !== ".." && !rel.startsWith("../");
}

function assertSafeRelative(relativePath: string, label: string): void {
  const segments = relativePath.split("/");
  if (
    segments.length === 0 ||
    segments.some((segment) => segment === "" || segment === "." || segment === "..")
  ) {
    throw new Error(`copy_to_workspace: ${label} is not a safe relative path: ${relativePath}`);
  }
}

function stripBase(relativePath: string, base: string): string {
  const pathSegments = relativePath.split("/");
  const baseSegments = base
    .replaceAll("\\", "/")
    .split("/")
    .filter((segment) => segment !== "");

  if (!matchesBasePrefix(pathSegments, baseSegments)) {
    throw new Error(`copy_to_workspace: path "${relativePath}" does not match base "${base}"`);
  }

  const destinationSegments = pathSegments.slice(baseSegments.length);
  if (
    destinationSegments.length === 0 ||
    destinationSegments.some((segment) => segment === "" || segment === "..")
  ) {
    throw new Error(
      `copy_to_workspace: stripping base "${base}" from "${relativePath}" left an empty destination`,
    );
  }

  return destinationSegments.join("/");
}

function matchesBasePrefix(
  pathSegments: readonly string[],
  baseSegments: readonly string[],
): boolean {
  if (pathSegments.length <= baseSegments.length) {
    return false;
  }

  for (const [index, baseSegment] of baseSegments.entries()) {
    const pathSegment = pathSegments[index];
    if (pathSegment === undefined) {
      return false;
    }
    if (baseSegment !== "*" && baseSegment !== pathSegment) {
      return false;
    }
  }

  return true;
}

function globToRegExp(glob: string): RegExp {
  const pattern = glob.replaceAll("\\", "/");
  let regex = "^";
  let index = 0;

  while (index < pattern.length) {
    const char = pattern[index];
    if (char === undefined) {
      break;
    }

    if (char === "*" && pattern[index + 1] === "*") {
      if (pattern[index + 2] === "/") {
        regex += "(?:.*/)?";
        index += 3;
        continue;
      }

      regex += ".*";
      index += 2;
      continue;
    }

    if (char === "*") {
      regex += "[^/]*";
      index += 1;
      continue;
    }

    if (char === "?") {
      regex += "[^/]";
      index += 1;
      continue;
    }

    regex += escapeRegExp(char);
    index += 1;
  }

  return new RegExp(`${regex}$`);
}

function escapeRegExp(char: string): string {
  return char.replaceAll(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function isEnoent(error: unknown): boolean {
  return typeof error === "object" && error !== null && "code" in error && error.code === "ENOENT";
}
