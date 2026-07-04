#!/usr/bin/env node

import { execFileSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { readFile, writeFile } from "node:fs/promises";

const __dirname = dirname(fileURLToPath(import.meta.url));
const rootPkgPath = join(__dirname, "package.json");

const bumpPatch = (version) => {
  const match = /^(\d+)\.(\d+)\.(\d+)$/.exec(version);
  if (!match) {
    throw new Error(`Invalid semver: ${version}`);
  }
  return `${match[1]}.${match[2]}.${Number(match[3]) + 1}`;
};

const setPackageVersion = async (pkgPath, version) => {
  const pkg = JSON.parse(await readFile(pkgPath, "utf-8"));
  pkg.version = version;

  for (const depType of ["dependencies", "devDependencies", "peerDependencies"]) {
    if (pkg[depType]) {
      for (const [name] of Object.entries(pkg[depType])) {
        if (name.startsWith("@bifrost-ai/")) {
          pkg[depType][name] = version;
        }
      }
    }
  }

  await writeFile(pkgPath, `${JSON.stringify(pkg, null, 2)}\n`);
};

// Package publish order (dependencies first)
const publishOrder = [
  "@bifrost-ai/interfaces-task-source",
  "@bifrost-ai/engine",
  "@bifrost-ai/protocol",
  "@bifrost-ai/interfaces-task",
  "@bifrost-ai/orchestrator",
  "@bifrost-ai/runner",
  "@bifrost-ai/agent-3-task",
];

const pkgDir = (pkgName) => join(__dirname, "packages", pkgName.replace(/.*?\//g, ""));

const originalRootContents = await readFile(rootPkgPath, "utf-8");
const currentVersion = JSON.parse(originalRootContents).version;
const targetSemver = bumpPatch(currentVersion);

const timestamp = Date.now();
const buildNumber = `build.${timestamp}`;
const publishVersion = `${targetSemver}-${buildNumber}`;

// Snapshot original package.json contents before any mutations
const originalContents = new Map();
for (const pkgName of publishOrder) {
  const pkgPath = join(pkgDir(pkgName), "package.json");
  // oxlint-disable-next-line no-await-in-loop
  originalContents.set(pkgName, await readFile(pkgPath, "utf-8"));
}

try {
  await setPackageVersion(rootPkgPath, targetSemver);

  for (const pkgName of publishOrder) {
    // oxlint-disable-next-line no-await-in-loop
    await setPackageVersion(join(pkgDir(pkgName), "package.json"), publishVersion);
  }

  console.log(`Building all packages (${publishVersion})...`);
  execFileSync("vp", ["run", "-r", "--parallel", "build"], {
    cwd: __dirname,
    stdio: "inherit",
  });

  for (const pkgName of publishOrder) {
    const currentPath = pkgDir(pkgName);
    const opts = {
      cwd: currentPath,
      stdio: "inherit",
    };

    console.log(`Publishing ${pkgName}...`);
    execFileSync(
      "vp",
      [
        "exec",
        "pnpm",
        "publish",
        "--tag",
        "prerelease",
        "--access",
        "public",
        "--no-git-checks",
        "--ignore-scripts",
      ],
      opts,
    );
  }
} finally {
  await writeFile(rootPkgPath, originalRootContents);

  for (const pkgName of publishOrder) {
    try {
      const pkgPath = join(pkgDir(pkgName), "package.json");
      // oxlint-disable-next-line no-await-in-loop
      await writeFile(pkgPath, originalContents.get(pkgName));
    } catch {
      // do nothing
    }
  }
}

console.log("✅ All packages published successfully");
