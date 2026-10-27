#!/usr/bin/env node
/**
 * A/B Fireworks prompt-cache probe: fetch vs OpenAI SDK vs engine sticky keys.
 *
 * Usage (from agent/):
 *   node scripts/fireworks-cache-test.mjs
 *   MODEL=glm-5p3-flash SESSION=cache-test-1 node scripts/fireworks-cache-test.mjs
 */
import { config } from "dotenv";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import OpenAI from "openai";

const __dirname = dirname(fileURLToPath(import.meta.url));
const agentRoot = resolve(__dirname, "..");
config({ path: resolve(agentRoot, ".env"), quiet: true });

const apiKey = process.env.OPENAI_API_KEY?.trim();
const baseURL = (process.env.OPENAI_BASE_URL?.trim() || "https://api.fireworks.ai/inference/v1").replace(
  /\/$/,
  "",
);
const model = process.env.MODEL?.trim() || process.argv[2] || "glm-5p3-flash";
const sessionId = process.env.SESSION?.trim() || "cache-test-script";

if (!apiKey) {
  console.error("OPENAI_API_KEY is required (set in agent/.env)");
  process.exit(1);
}

const STATIC_PREFIX = [
  "You are a careful assistant used only for a prompt-cache probe.",
  "Ignore the meaning of the user suffix; echo CACHE_PROBE and the suffix digit.",
  "Rules:",
  "1. Do not call tools.",
  "2. Keep the reply under 20 tokens.",
  "3. Prefer the exact form: CACHE_PROBE N",
  // Pad so the shared prefix is large enough for a meaningful cache hit.
  "Context dump (stable): ",
  "alpha ".repeat(400),
].join("\n");

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

const cachedFromUsage = (usage) => {
  if (!usage || typeof usage !== "object") return null;
  const details = usage.input_tokens_details ?? usage.prompt_tokens_details;
  if (!details || typeof details !== "object") return null;
  const value = details.cached_tokens;
  return typeof value === "number" ? value : null;
};

const summarize = (label, { status, affinity, headers, usage, bodyExtra }) => {
  const promptTokens =
    headers["fireworks-prompt-tokens"] ??
    usage?.input_tokens ??
    usage?.prompt_tokens ??
    null;
  const headerCached = headers["fireworks-cached-prompt-tokens"] ?? null;
  const usageCached = cachedFromUsage(usage);
  console.log(
    JSON.stringify(
      {
        label,
        status,
        affinity,
        fireworksPromptTokens: promptTokens,
        fireworksCachedPromptTokens: headerCached,
        usageCachedTokens: usageCached,
        usage,
        ...(bodyExtra === undefined ? {} : { bodyExtra }),
      },
      null,
      2,
    ),
  );
  return {
    headerCached: headerCached === null ? null : Number(headerCached),
    usageCached,
  };
};

const headerRecord = (headers) => {
  const out = {};
  for (const [k, v] of headers.entries()) {
    out[k.toLowerCase()] = v;
  }
  return out;
};

const withAffinity = (call, sid) => {
  if (!sid) return call;
  return {
    body: call.body,
    headers: { ...call.headers, "x-session-affinity": sid },
  };
};

const withPromptCacheKey = (call, sid) => {
  if (!sid) return call;
  return {
    body: { ...call.body, prompt_cache_key: sid, user: sid },
    headers: call.headers,
  };
};

const responsesBody = (suffix, extras = {}) => ({
  model,
  store: false,
  stream: false,
  input: `${STATIC_PREFIX}\n\nUser suffix: ${suffix}`,
  ...extras,
});

const toolsProbe = [
  {
    type: "function",
    name: "noop_probe",
    description: "Unused tool present only to match harness tool-shaped prompts.",
    strict: true,
    parameters: {
      type: "object",
      properties: {
        note: { type: "string" },
      },
      required: ["note"],
      additionalProperties: false,
    },
  },
];

async function fetchResponses(label, body, headers) {
  const res = await fetch(`${baseURL}/responses`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`,
      ...headers,
    },
    body: JSON.stringify(body),
  });
  const text = await res.text();
  let data;
  try {
    data = JSON.parse(text);
  } catch {
    data = { raw: text };
  }
  return summarize(label, {
    status: res.status,
    affinity: headers["x-session-affinity"] ?? null,
    headers: headerRecord(res.headers),
    usage: data.usage ?? null,
  });
}

async function fetchChat(label, messages, headers) {
  const res = await fetch(`${baseURL}/chat/completions`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`,
      ...headers,
    },
    body: JSON.stringify({
      model,
      messages,
      max_tokens: 32,
    }),
  });
  const text = await res.text();
  let data;
  try {
    data = JSON.parse(text);
  } catch {
    data = { raw: text };
  }
  return summarize(label, {
    status: res.status,
    affinity: headers["x-session-affinity"] ?? null,
    headers: headerRecord(res.headers),
    usage: data.usage ?? null,
  });
}

const client = new OpenAI({ apiKey, baseURL });

async function sdkResponses(label, call) {
  const { data, response } = await client.responses
    .create(call.body, { headers: call.headers })
    .withResponse();
  return summarize(label, {
    status: response.status,
    affinity: call.headers["x-session-affinity"] ?? null,
    headers: headerRecord(response.headers),
    usage: data.usage ?? null,
    bodyExtra: {
      prompt_cache_key: call.body.prompt_cache_key ?? null,
      user: call.body.user ?? null,
    },
  });
}

const hit = (metrics) =>
  (metrics.headerCached !== null && metrics.headerCached > 0) ||
  (metrics.usageCached !== null && metrics.usageCached > 0);

async function runPair(title, requestOnce) {
  console.log(`\n=== ${title} ===`);
  const first = await requestOnce("1");
  await sleep(500);
  const second = await requestOnce("1");
  console.log(
    JSON.stringify(
      {
        pair: title,
        firstHit: hit(first),
        secondHit: hit(second),
        secondHeaderCached: second.headerCached,
        secondUsageCached: second.usageCached,
      },
      null,
      2,
    ),
  );
  return { first, second };
}

async function main() {
  console.log(
    JSON.stringify(
      {
        baseURL,
        model,
        sessionId,
        prefixChars: STATIC_PREFIX.length,
      },
      null,
      2,
    ),
  );

  // A: fetch Responses + affinity header
  await runPair("A fetch Responses + x-session-affinity", async (suffix) => {
    const body = responsesBody(suffix);
    return fetchResponses(`A-${suffix}`, body, { "x-session-affinity": sessionId });
  });

  // B: SDK Responses + affinity header
  await runPair("B SDK Responses + x-session-affinity", async (suffix) => {
    const call = withAffinity(
      { body: responsesBody(suffix), headers: {} },
      sessionId,
    );
    return sdkResponses(`B-${suffix}`, call);
  });

  // C: SDK + engine-style prepare (header only)
  await runPair("C SDK + engine prepare (header only)", async (suffix) => {
    const call = withAffinity(
      { body: responsesBody(suffix), headers: {} },
      sessionId,
    );
    return sdkResponses(`C-${suffix}`, call);
  });

  // D: SDK + header + prompt_cache_key/user
  await runPair("D SDK + affinity + prompt_cache_key/user", async (suffix) => {
    const call = withPromptCacheKey(
      withAffinity({ body: responsesBody(suffix), headers: {} }, sessionId),
      `${sessionId}-d`,
    );
    return sdkResponses(`D-${suffix}`, call);
  });

  // E: chat/completions control
  await runPair("E fetch chat/completions + x-session-affinity", async (suffix) => {
    const messages = [
      { role: "system", content: STATIC_PREFIX },
      { role: "user", content: `User suffix: ${suffix}` },
    ];
    return fetchChat(`E-${suffix}`, messages, {
      "x-session-affinity": `${sessionId}-chat`,
    });
  });

  // F: harness-like multi-turn with tools
  console.log("\n=== F harness-like multi-turn (tools + growing input) ===");
  const fSession = `${sessionId}-multi`;
  const f1 = withAffinity(
    {
      body: {
        model,
        store: false,
        stream: false,
        tools: toolsProbe,
        input: [{ role: "user", content: `${STATIC_PREFIX}\n\nSay CACHE_PROBE 1 only.` }],
      },
      headers: {},
    },
    fSession,
  );
  const f1Result = await client.responses.create(f1.body, { headers: f1.headers }).withResponse();
  const f1Metrics = summarize("F-turn1", {
    status: f1Result.response.status,
    affinity: fSession,
    headers: headerRecord(f1Result.response.headers),
    usage: f1Result.data.usage ?? null,
  });

  await sleep(500);

  const priorItems = Array.isArray(f1Result.data.output) ? f1Result.data.output : [];
  const f2Input = [
    { role: "user", content: `${STATIC_PREFIX}\n\nSay CACHE_PROBE 1 only.` },
    ...priorItems,
    { role: "user", content: "Now say CACHE_PROBE 2 only." },
  ];
  const f2 = withAffinity(
    {
      body: {
        model,
        store: false,
        stream: false,
        tools: toolsProbe,
        input: f2Input,
      },
      headers: {},
    },
    fSession,
  );
  const f2Result = await client.responses.create(f2.body, { headers: f2.headers }).withResponse();
  const f2Metrics = summarize("F-turn2", {
    status: f2Result.response.status,
    affinity: fSession,
    headers: headerRecord(f2Result.response.headers),
    usage: f2Result.data.usage ?? null,
  });
  console.log(
    JSON.stringify(
      {
        pair: "F multi-turn",
        turn1Hit: hit(f1Metrics),
        turn2Hit: hit(f2Metrics),
        turn2HeaderCached: f2Metrics.headerCached,
        turn2UsageCached: f2Metrics.usageCached,
      },
      null,
      2,
    ),
  );
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
