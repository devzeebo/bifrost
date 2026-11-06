import "@clanker-cleanroom/cursor/register";

import { access, mkdir, readFile, writeFile } from "node:fs/promises";
import { join } from "node:path";
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

const CHECK_ID = "bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb";
const CRITERION = "Replies stay in plain language";
const SHARPENED = "Answers use everyday words";
const SCENARIO = "Given a jargon-heavy ask, the reply stays plain";

const AUTHORING_PROMPT = `You are authoring Bifrost workshop script checks behind the scenes.

Write exactly three JSON files in the workspace root:

1) proposal.json — an AddEval check authoring result for:
   - criterion statement: ${JSON.stringify(CRITERION)}
   - scenario: ${JSON.stringify(SCENARIO)}
   - check id: ${CHECK_ID}

   Shape:
   {
     "assistantText": string,
     "checks": [
       {
         "id": "${CHECK_ID}",
         "kind": "Script",
         "statement": string,
         "script": string
       }
     ]
   }

   Rules:
   - assistantText must say the eval is ready to run
   - statement must be one plain sentence that includes the criterion wording
   - script must be TypeScript with: export default function check(transcript: string, context: string): boolean
   - do not invent a second check

2) rederived.json — same shape after the criterion is sharpened to ${JSON.stringify(SHARPENED)}
   (scenario unchanged). Keep the same check id. Update statement and script for the new wording.
   assistantText may note re-derive. kind stays Script.

3) human-review.json — same check id swapped to human review:
   {
     "checks": [
       {
         "id": "${CHECK_ID}",
         "kind": "HumanReview",
         "statement": string,
         "script": null
       }
     ]
   }
   statement still tied to the sharpened criterion. script must be null.

Do not write any other files. Do not use the shell.
`;

type CheckPayload = {
  id?: string;
  kind?: string;
  statement?: string;
  script?: string | null;
};

type ProposalPayload = {
  assistantText?: string;
  checks?: CheckPayload[];
};

type Context = AgentContext & {
  proposal: ProposalPayload;
  rederived: ProposalPayload;
  humanReview: { checks?: CheckPayload[] };
};

describe("script check authoring", () => {
  withAspect(agent({ name: "cursor", image: "cursor:node26", model: "auto" }));
  withAspect(a_workspace, cleanup_workspace);
  withAspect(a_workspace);

  withTestOptions((opts) => {
    opts.timeout = 10 * 60 * 1000;
  });

  test("authors typescript script checks with stable identity and human-review swap", {
    given: {
      agent_has_no_shell,
      the_prompt: the_prompt(AUTHORING_PROMPT),
    },
    when: {
      executing_the_agent,
      reading_authored_files,
    },
    then: {
      proposal_is_ready_to_run_with_typescript_script,
      rederive_keeps_check_id_and_updates_wording,
      human_review_swap_keeps_id_and_clears_script,
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
    "utf8",
  );
}

async function reading_authored_files(this: Context) {
  for (const name of ["proposal.json", "rederived.json", "human-review.json"]) {
    await access(join(this.workspace, name));
  }

  this.proposal = JSON.parse(
    await readFile(join(this.workspace, "proposal.json"), "utf8"),
  ) as ProposalPayload;
  this.rederived = JSON.parse(
    await readFile(join(this.workspace, "rederived.json"), "utf8"),
  ) as ProposalPayload;
  this.humanReview = JSON.parse(
    await readFile(join(this.workspace, "human-review.json"), "utf8"),
  ) as Context["humanReview"];
}

function proposal_is_ready_to_run_with_typescript_script(this: Context) {
  const check = this.proposal.checks?.[0];
  expect(this.proposal.assistantText?.toLowerCase()).toContain("ready to run");
  expect(check?.id).toBe(CHECK_ID);
  expect(check?.kind).toBe("Script");
  expect(check?.statement?.toLowerCase()).toContain(CRITERION.toLowerCase());
  expect(check?.script).toContain(
    "export default function check(transcript: string, context: string): boolean",
  );
}

function rederive_keeps_check_id_and_updates_wording(this: Context) {
  const check = this.rederived.checks?.[0];
  expect(check?.id).toBe(CHECK_ID);
  expect(check?.kind).toBe("Script");
  expect(check?.statement?.toLowerCase()).toContain(SHARPENED.toLowerCase());
  expect(check?.script).toContain(
    "export default function check(transcript: string, context: string): boolean",
  );
  expect(check?.script).not.toEqual(this.proposal.checks?.[0]?.script);
}

function human_review_swap_keeps_id_and_clears_script(this: Context) {
  const check = this.humanReview.checks?.[0];
  expect(check?.id).toBe(CHECK_ID);
  expect(check?.kind).toBe("HumanReview");
  expect(check?.statement?.toLowerCase()).toContain(SHARPENED.toLowerCase());
  expect(check?.script).toBeNull();
}
