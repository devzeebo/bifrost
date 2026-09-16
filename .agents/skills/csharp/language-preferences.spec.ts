import { createHash } from "node:crypto";
import { mkdir, readFile, readdir, stat, writeFile } from "node:fs/promises";
import { join, relative } from "node:path";
import { load_cursor_skill } from "@devzeebo/agent";
import skill from "./SKILL.md" with { type: "text" };

import {
  type AgentContext,
  a_workspace,
  agent,
  cleanup_workspace,
  executing_the_agent,
  the_prompt,
} from "agent-gwt";
import { describe, expect } from "vite-plus/test";
import test, { withAspect, withTestOptions } from "vitest-gwt";

const ALLOWED_CHANGED_FILE = "Counter.cs";

const COUNTER_PROMPT = `Create a C# file Counter.cs with a Counter class.

Requirements:
- Track a count that starts at 0 via a field
- Include a constructor that initializes the count to 0
- Expose a public Value property (get-only) that returns the current count
- Expose a public Increment() method that increases the count by 1
- Expose a public async method that waits briefly (e.g. Task.Delay) then returns the current count as Task<int>
- Include a public nested class Snapshot with a read-only int Count property
- Include a nested helper class ResetToken that is only for Counter's internal use (empty body is fine)
- Keep the outer type assembly-scoped (not part of a public API surface)
`;

type MemberKind =
  | "publicInnerClass"
  | "publicProperty"
  | "publicMethod"
  | "privateInnerClass"
  | "privateField"
  | "constructor";

const MEMBER_KIND_ORDER: MemberKind[] = [
  "publicInnerClass",
  "publicProperty",
  "publicMethod",
  "privateInnerClass",
  "privateField",
  "constructor",
];

type Context = AgentContext & {
  workspaceFilesBefore: Map<string, string>;
  counterSource: string;
};

describe("language preferences", () => {
  withAspect(agent({ name: "cursor", image: "cursor:dotnet", model: "auto" }));
  withAspect(a_workspace, cleanup_workspace);
  withAspect(a_workspace);

  withTestOptions((opts) => {
    opts.timeout = 10 * 60 * 1000;
  });

  test("applies csharp language preferences when writing a C# class", {
    given: {
      agent_has_no_shell,
      skill_is_installed,
      workspace_is_snapshotted,
      the_prompt: the_prompt(COUNTER_PROMPT),
    },
    when: {
      executing_the_agent,
    },
    then: {
      only_counter_cs_was_modified,
      types_omit_internal,
      members_omit_private,
      async_methods_omit_async_suffix,
      class_members_follow_preferred_order,
    },
  });
});

async function agent_has_no_shell(this: Context) {
  await mkdir(join(this.workspace, ".cursor"));
  await writeFile(
    join(this.workspace, ".cursor/cli.json"),
    JSON.stringify({
      permissions: {
        deny: ["Shell(*)"],
        allow: [],
      },
    }),
  );
}

async function skill_is_installed(this: Context) {
  await load_cursor_skill(this.workspace, skill);
}

async function workspace_is_snapshotted(this: Context): Promise<void> {
  this.workspaceFilesBefore = await snapshotWorkspace(this.workspace);
}

async function only_counter_cs_was_modified(this: Context): Promise<void> {
  await stat(join(this.workspace, ALLOWED_CHANGED_FILE));
  this.counterSource = await readFile(join(this.workspace, ALLOWED_CHANGED_FILE), "utf8");

  const after = await snapshotWorkspace(this.workspace);

  for (const [rel, hash] of this.workspaceFilesBefore) {
    expect(after.has(rel), `${rel} was deleted`).toBe(true);
    expect(after.get(rel), `${rel} was modified`).toBe(hash);
  }

  const allAfter = await walkFiles(this.workspace);
  const allowed = new Set([...this.workspaceFilesBefore.keys(), ALLOWED_CHANGED_FILE]);

  for (const rel of allAfter) {
    expect(allowed.has(rel), `unexpected file: ${rel}`).toBe(true);
  }
}

async function types_omit_internal(this: Context): Promise<void> {
  const source =
    this.counterSource ?? (await readFile(join(this.workspace, ALLOWED_CHANGED_FILE), "utf8"));
  expect(source, "types should omit internal (assembly default)").not.toMatch(
    /\binternal\b\s+(?:static\s+|partial\s+|abstract\s+|sealed\s+)*(?:class|interface|struct|record)\b/,
  );
}

async function members_omit_private(this: Context): Promise<void> {
  const source =
    this.counterSource ?? (await readFile(join(this.workspace, ALLOWED_CHANGED_FILE), "utf8"));
  // Ban explicit private on members; private protected is a different (non-default) modifier.
  expect(source, "members should omit private (type-member default)").not.toMatch(
    /\bprivate\b(?!\s+protected\b)/,
  );
}

async function async_methods_omit_async_suffix(this: Context): Promise<void> {
  const source =
    this.counterSource ?? (await readFile(join(this.workspace, ALLOWED_CHANGED_FILE), "utf8"));
  expect(source, "async methods should not use an Async suffix").not.toMatch(/\b\w+Async\s*\(/);
}

async function class_members_follow_preferred_order(this: Context): Promise<void> {
  const source =
    this.counterSource ?? (await readFile(join(this.workspace, ALLOWED_CHANGED_FILE), "utf8"));
  const kinds = outerClassMemberKinds(source);
  const rank = (kind: MemberKind) => MEMBER_KIND_ORDER.indexOf(kind);

  expect(kinds, "expected public nested class, properties, methods, nested helper, field, ctor").toEqual(
    expect.arrayContaining([
      "publicInnerClass",
      "publicProperty",
      "publicMethod",
      "privateInnerClass",
      "privateField",
      "constructor",
    ]),
  );

  for (let i = 1; i < kinds.length; i++) {
    const prev = kinds[i - 1]!;
    const curr = kinds[i]!;
    expect(
      rank(curr),
      `member order violated: ${prev} before ${curr} (want public nested → public props → public methods → nested helpers → fields → ctor)`,
    ).toBeGreaterThanOrEqual(rank(prev));
  }
}

function outerClassMemberKinds(source: string): MemberKind[] {
  const body = outerClassBody(source);
  const kinds: MemberKind[] = [];
  let i = 0;
  let depth = 0;

  while (i < body.length) {
    const ch = body[i]!;

    if (ch === "{") {
      depth++;
      i++;
      continue;
    }
    if (ch === "}") {
      depth--;
      i++;
      continue;
    }
    if (depth !== 0) {
      i++;
      continue;
    }

    if (/\s/.test(ch)) {
      i++;
      continue;
    }

    const slice = body.slice(i);
    const nested = slice.match(
      /^(public\s+)?(?:static\s+|partial\s+|abstract\s+|sealed\s+|readonly\s+)*(?:class|struct|record|interface)\b/,
    );
    if (nested) {
      kinds.push(nested[1] !== undefined ? "publicInnerClass" : "privateInnerClass");
      i = skipMember(body, i);
      continue;
    }

    const ctor = slice.match(/^(\w+)\s*\(/);
    if (ctor?.[1] === "Counter") {
      kinds.push("constructor");
      i = skipMember(body, i);
      continue;
    }

    const propOrMethod = slice.match(
      /^(public\s+)?(?:static\s+|async\s+|virtual\s+|override\s+|sealed\s+|new\s+|partial\s+)*(?:[\w.<>\[\],\s?]+\s+)?(\w+)\s*(=>|[({;])/,
    );
    if (propOrMethod) {
      const isPublic = propOrMethod[1] !== undefined;
      const name = propOrMethod[2]!;
      const opener = propOrMethod[3]!;
      if (name === "Counter" && opener === "(") {
        kinds.push("constructor");
      } else if (opener === "(") {
        if (isPublic) {
          kinds.push("publicMethod");
        }
        // Non-public methods are outside the preferred order checklist; still skip the member.
      } else if (isPublic || opener === "{" || opener === "=>") {
        kinds.push(isPublic ? "publicProperty" : "privateField");
      } else {
        kinds.push("privateField");
      }
      i = skipMember(body, i);
      continue;
    }

    // Field: Type name; or Type name =
    const field = slice.match(/^(?:readonly\s+|volatile\s+)?[\w.<>\[\],\s?]+\s+\w+\s*[=;]/);
    if (field) {
      kinds.push("privateField");
      i = skipMember(body, i);
      continue;
    }

    i++;
  }

  return kinds;
}

function outerClassBody(source: string): string {
  const match = source.match(
    /\b(?:class|record|struct)\s+Counter\b[^{]*\{([\s\S]*)\}\s*$/,
  );
  if (match?.[1] === undefined) {
    throw new Error("could not find outer Counter class body");
  }
  return match[1];
}

function skipMember(body: string, start: number): number {
  let i = start;
  while (i < body.length && body[i] !== "{" && body[i] !== ";" && body.slice(i, i + 2) !== "=>") {
    if (body[i] === "(") {
      let depth = 1;
      i++;
      while (i < body.length && depth > 0) {
        if (body[i] === "(") depth++;
        else if (body[i] === ")") depth--;
        i++;
      }
      continue;
    }
    i++;
  }
  if (body.slice(i, i + 2) === "=>") {
    while (i < body.length && body[i] !== ";") {
      i++;
    }
    return i < body.length ? i + 1 : i;
  }
  if (body[i] === ";") {
    return i + 1;
  }
  if (body[i] === "{") {
    let depth = 1;
    i++;
    while (i < body.length && depth > 0) {
      if (body[i] === "{") depth++;
      else if (body[i] === "}") depth--;
      i++;
    }
  }
  return i;
}

async function snapshotWorkspace(workspace: string): Promise<Map<string, string>> {
  const snapshot = new Map<string, string>();

  for (const rel of await walkFiles(workspace)) {
    if (rel === ALLOWED_CHANGED_FILE) {
      continue;
    }

    snapshot.set(rel, await hashFile(join(workspace, rel)));
  }

  return snapshot;
}

async function hashFile(path: string): Promise<string> {
  const content = await readFile(path);
  return createHash("sha256").update(content).digest("hex");
}

async function walkFiles(root: string): Promise<string[]> {
  const files: string[] = [];

  async function walk(dir: string): Promise<void> {
    const entries = await readdir(dir, { withFileTypes: true });

    for (const entry of entries) {
      if (entry.name === "node_modules" || entry.name === "obj" || entry.name === "bin") {
        continue;
      }

      const absolute = join(dir, entry.name);

      if (entry.isDirectory()) {
        await walk(absolute);
        continue;
      }

      if (entry.isFile()) {
        files.push(relative(root, absolute));
      }
    }
  }

  await walk(root);
  return files.sort();
}
