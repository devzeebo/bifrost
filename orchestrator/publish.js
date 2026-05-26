#!/usr/bin/env node

import { execFileSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { readFile, writeFile } from "node:fs/promises";
const __dirname = dirname(fileURLToPath(import.meta.url));

const setPackageVersion = async (pkgDir, version) => {
  const pkgPath = join(pkgDir, "package.json");
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
  "@bifrost-ai/task-source",
  "@bifrost-ai/engine",
  "@bifrost-ai/task-source-bifrost",
  "@bifrost-ai/engine-claude-code",
  "@bifrost-ai/orchestrator", // Main CLI entry point
];

let packageJson = await import("./package.json?cache=0", { with: { type: "json" } }).then(
  (json) => json.default,
);
const currentVersion = packageJson.version;

const timestamp = Date.now();
const buildNumber = `build.${timestamp}`;

execFileSync("npm", ["version", "patch", "--no-git-tag-version"], {
  cwd: __dirname,
  stdio: "inherit",
});
packageJson = await import("./package.json?cache=1", { with: { type: "json" } }).then(
  (json) => json.default,
);
const targetSemver = packageJson.version;

const pkgDir = (pkgName) => join(__dirname, "packages", pkgName.replace(/.*?\//g, ""));

// Snapshot original package.json contents before any mutations
const originalContents = new Map();
for (const pkgName of publishOrder) {
  const pkgPath = join(pkgDir(pkgName), "package.json");
  // oxlint-disable-next-line no-await-in-loop
  originalContents.set(pkgName, await readFile(pkgPath, "utf-8"));
}

try {
  // Update versions, build and publish packages
  for (const pkgName of publishOrder) {
    try {
      const currentPath = pkgDir(pkgName);
      const opts = {
        cwd: currentPath,
        stdio: "inherit",
      };

      // Bump version with build suffix and update sibling deps
      // oxlint-disable-next-line no-await-in-loop
      await setPackageVersion(currentPath, `${targetSemver}-${buildNumber}`);

      // Build package
      console.log(`Building ${pkgName}...`);
      execFileSync("npm", ["run", "build"], opts);

      // Publish package
      console.log(`Publishing ${pkgName}...`);
      execFileSync("npm", ["publish", "--tag", "prerelease", "--access", "public"], opts);
    } catch (error) {
      console.error(error);
      throw error;
    }
  }
} finally {
  execFileSync("npm", ["version", currentVersion, "--no-git-tag-version"], {
    cwd: __dirname,
    stdio: "inherit",
  });

  // Restore original package.json contents verbatim
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
