#!/usr/bin/env node

import { execFileSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { readdir, readFile, writeFile } from "node:fs/promises";

const __dirname = dirname(fileURLToPath(import.meta.url));
const rootPkgPath = join(__dirname, "package.json");
const packagesDir = join(__dirname, "packages");

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

const bifrostDeps = (pkg) => {
  const deps = {};
  for (const depType of ["dependencies", "peerDependencies"]) {
    if (pkg[depType]) {
      Object.assign(deps, pkg[depType]);
    }
  }
  return Object.keys(deps).filter((name) => name.startsWith("@bifrost-ai/"));
};

const discoverPublishablePackages = async () => {
  const entries = await readdir(packagesDir, { withFileTypes: true });
  const packages = [];

  for (const entry of entries) {
    if (!entry.isDirectory()) {
      continue;
    }

    const dir = join(packagesDir, entry.name);
    const pkgPath = join(dir, "package.json");

    let contents;
    try {
      // oxlint-disable-next-line no-await-in-loop
      contents = await readFile(pkgPath, "utf-8");
    } catch {
      continue;
    }

    let pkg;
    try {
      pkg = JSON.parse(contents);
    } catch {
      continue;
    }

    if (typeof pkg.name !== "string" || pkg.name.length === 0) {
      continue;
    }

    if (pkg.private || pkg.name.includes("example")) {
      continue;
    }

    packages.push({ name: pkg.name, dir, pkgPath, pkg });
  }

  return packages;
};

const sortByDependencyOrder = (packages) => {
  const names = new Set(packages.map((pkg) => pkg.name));
  const deps = new Map(
    packages.map((pkg) => [pkg.name, bifrostDeps(pkg.pkg).filter((name) => names.has(name))]),
  );
  const inDegree = new Map(packages.map((pkg) => [pkg.name, deps.get(pkg.name).length]));
  const queue = packages.filter((pkg) => inDegree.get(pkg.name) === 0).map((pkg) => pkg.name);
  const sorted = [];

  while (queue.length > 0) {
    const name = queue.shift();
    sorted.push(name);

    for (const [pkgName, pkgDeps] of deps) {
      if (!pkgDeps.includes(name)) {
        continue;
      }

      const nextDegree = inDegree.get(pkgName) - 1;
      inDegree.set(pkgName, nextDegree);
      if (nextDegree === 0) {
        queue.push(pkgName);
      }
    }
  }

  if (sorted.length !== packages.length) {
    throw new Error("Circular dependency detected among publishable packages");
  }

  return sorted;
};

const publishablePackages = await discoverPublishablePackages();
const publishOrder = sortByDependencyOrder(publishablePackages);
const packageByName = new Map(publishablePackages.map((pkg) => [pkg.name, pkg]));

const originalRootContents = await readFile(rootPkgPath, "utf-8");
const currentVersion = JSON.parse(originalRootContents).version;
const targetSemver = bumpPatch(currentVersion);

const timestamp = Date.now();
const buildNumber = `build.${timestamp}`;
const publishVersion = `${targetSemver}-${buildNumber}`;

// Snapshot original package.json contents before any mutations
const originalContents = new Map();
for (const pkgName of publishOrder) {
  const { pkgPath } = packageByName.get(pkgName);
  // oxlint-disable-next-line no-await-in-loop
  originalContents.set(pkgName, await readFile(pkgPath, "utf-8"));
}

try {
  await setPackageVersion(rootPkgPath, targetSemver);

  for (const pkgName of publishOrder) {
    const { pkgPath } = packageByName.get(pkgName);
    // oxlint-disable-next-line no-await-in-loop
    await setPackageVersion(pkgPath, publishVersion);
  }

  console.log(`Building all packages (${publishVersion})...`);
  execFileSync("vp", ["run", "-r", "--parallel", "build"], {
    cwd: __dirname,
    stdio: "inherit",
  });

  for (const pkgName of publishOrder) {
    const { dir } = packageByName.get(pkgName);
    const opts = {
      cwd: dir,
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
      const { pkgPath } = packageByName.get(pkgName);
      // oxlint-disable-next-line no-await-in-loop
      await writeFile(pkgPath, originalContents.get(pkgName));
    } catch {
      // do nothing
    }
  }
}

console.log("✅ All packages published successfully");
