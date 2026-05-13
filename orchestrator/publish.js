#!/usr/bin/env node

import { execSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { readFile, writeFile } from "node:fs/promises";
const __dirname = dirname(fileURLToPath(import.meta.url));

const setPackageVersion = async (pkgDir, version, updateBifrostDeps = false) => {
  const pkgPath = join(pkgDir, "package.json");
  const pkg = JSON.parse(await readFile(pkgPath, "utf-8"));
  pkg.version = version;

  // Update sibling @bifrost-ai dependencies
  for (const depType of ["dependencies", "devDependencies", "peerDependencies"]) {
    if (pkg[depType]) {
      for (const [name] of Object.entries(pkg[depType])) {
        if (name.startsWith("@bifrost-ai/")) {
          // publish: use exact version, restore: use ^0.0.0
          pkg[depType][name] = updateBifrostDeps ? version : "^0.0.0";
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

execSync("npm version patch --no-git-tag-version");
packageJson = await import("./package.json?cache=1", { with: { type: "json" } }).then(
  (json) => json.default,
);
const targetSemver = packageJson.version;

const pkgDir = (pkgName) => join(__dirname, "packages", pkgName.replace(/.*?\//g, ""));

try {
  // Update versions, build and publish packages
  for (const pkgName of publishOrder) {
    try {
      const currentPath = pkgDir(pkgName);
      const opts = {
        cwd: currentPath,
        stdio: "inherit",
        shell: "/usr/bin/bash",
      };

      // Bump version with build suffix and update sibling deps
      // oxlint-disable-next-line no-await-in-loop
      await setPackageVersion(currentPath, `${targetSemver}-${buildNumber}`, true);

      // Build package
      console.log(`Building ${pkgName}...`);
      execSync("npm run build", opts);

      // Publish package
      console.log(`Publishing ${pkgName}...`);
      execSync("npm publish --tag prerelease --access public", opts);
    } catch (error) {
      console.error(error);
      throw error;
    }
  }
} finally {
  execSync(`npm version ${currentVersion} --no-git-tag-version`, {
    cwd: __dirname,
    stdio: "inherit",
    shell: "/usr/bin/bash",
  });

  // reset the versions locally
  for (const pkgName of publishOrder) {
    try {
      const currentPath = pkgDir(pkgName);
      // oxlint-disable-next-line no-await-in-loop
      await setPackageVersion(currentPath, currentVersion, false);
    } catch {
      // do nothing
    }
  }
}

console.log("✅ All packages published successfully");
