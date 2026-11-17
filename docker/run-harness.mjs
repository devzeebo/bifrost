#!/usr/bin/env node
/**
 * Worker harness entrypoint: reads run-spec.json from BIFROST_WORKSPACE,
 * runs the agent harness (or passthrough), writes outputs.json, exits with status.
 */
import { readFile, writeFile, readdir, mkdir } from 'node:fs/promises'
import path from 'node:path'
import { pathToFileURL } from 'node:url'

const workspace = process.env.BIFROST_WORKSPACE?.trim() || process.cwd()
const runSpecPath = path.join(workspace, 'run-spec.json')
const outputsPath = path.join(workspace, 'outputs.json')
const mode = (process.env.BIFROST_HARNESS_MODE || 'agent').trim().toLowerCase()

let runSpec
try {
  runSpec = JSON.parse(await readFile(runSpecPath, 'utf8'))
} catch (error) {
  console.error(
    `harness failed to start: failed to read run-spec.json: ${error instanceof Error ? error.message : error}`,
  )
  process.exit(1)
}

const data = runSpec?.data ?? {}
const inputs = data?.inputs ?? {}
const skillsDir = path.join(workspace, 'skills')

async function loadSkillInstructions() {
  const parts = []
  let entries
  try {
    entries = await readdir(skillsDir, { withFileTypes: true })
  } catch {
    return ''
  }
  for (const entry of entries) {
    if (!entry.isDirectory()) {
      continue
    }
    const skillPath = path.join(skillsDir, entry.name, 'SKILL.md')
    try {
      const markdown = await readFile(skillPath, 'utf8')
      parts.push(`# Skill ${entry.name}\n\n${markdown}`)
    } catch {
      // missing file is ignored here; worker already failed the run if fetch/write failed
    }
  }
  return parts.join('\n\n')
}

function buildPrompt() {
  if (typeof inputs.prompt === 'string' && inputs.prompt.trim()) {
    return inputs.prompt
  }
  if (typeof inputs.goal === 'string' && inputs.goal.trim()) {
    return inputs.goal
  }
  return JSON.stringify(inputs, null, 2)
}

async function writeOutputs(value) {
  await writeFile(outputsPath, `${JSON.stringify(value ?? null, null, 2)}\n`, 'utf8')
}

if (mode === 'passthrough') {
  try {
    await writeOutputs(inputs)
    process.exit(0)
  } catch (error) {
    console.error(`failed to write outputs.json: ${error instanceof Error ? error.message : error}`)
    process.exit(1)
  }
}

const agentRoot = process.env.BIFROST_AGENT_ROOT?.trim() || '/opt/bifrost/agent'

let createHarness
let createOpenAIModelClient
try {
  const harnessUrl = pathToFileURL(path.join(agentRoot, 'packages/harness/dist/index.mjs')).href
  const harness = await import(harnessUrl)
  createHarness = harness.createHarness
  createOpenAIModelClient = harness.createOpenAIModelClient
} catch (error) {
  console.error(
    `harness failed to start: agent harness not available at ${agentRoot}: ${error instanceof Error ? error.message : error}`,
  )
  process.exit(1)
}

const transcriptFolder = path.join(workspace, 'transcripts')
await mkdir(transcriptFolder, { recursive: true })

const instructions = await loadSkillInstructions()
const model =
  process.env.BIFROST_HARNESS_MODEL?.trim() ||
  process.env.OPENAI_MODEL?.trim() ||
  'accounts/fireworks/models/llama-v3p1-70b-instruct'
const maxTurns = Number.parseInt(process.env.BIFROST_HARNESS_MAX_TURNS || '8', 10)

let engines = []
try {
  const fireworksUrl = pathToFileURL(
    path.join(agentRoot, 'packages/engine-fireworks/dist/index.mjs'),
  ).href
  const fireworks = await import(fireworksUrl)
  const engine = fireworks.default ?? fireworks.fireworksEngine
  if (engine) {
    engines = [engine]
  }
} catch {
  // engines optional when the model client can run without them
}

const apiKey =
  process.env.OPENAI_API_KEY?.trim() ||
  process.env.BIFROST_AI_API_KEY?.trim() ||
  process.env.BIFROST_API_KEY?.trim()

if (!apiKey) {
  console.error('harness failed to start: OPENAI_API_KEY (or BIFROST_AI_API_KEY) is not configured')
  process.exit(1)
}

if (process.env.BIFROST_AI_BASE_URL?.trim() && !process.env.OPENAI_BASE_URL?.trim()) {
  process.env.OPENAI_BASE_URL = process.env.BIFROST_AI_BASE_URL.trim()
}

let result
try {
  const client = createOpenAIModelClient({
    engines,
    apiKey,
  })
  const harness = createHarness({
    client,
    model,
    tools: [],
    maxTurns: Number.isFinite(maxTurns) && maxTurns > 0 ? maxTurns : 8,
    transcriptFolder,
    ...(instructions ? { instructions } : {}),
  })
  result = await harness.run(buildPrompt())
} catch (error) {
  console.error(`harness failed: ${error instanceof Error ? error.message : error}`)
  process.exit(1)
}

switch (result.status) {
  case 'completed':
  case 'refused':
    try {
      await writeOutputs({ result: result.text })
      process.exit(result.status === 'completed' ? 0 : 1)
    } catch (error) {
      console.error(
        `failed to write outputs.json: ${error instanceof Error ? error.message : error}`,
      )
      process.exit(1)
    }
    break
  case 'max_turns':
    console.error('harness reached the maximum number of turns')
    process.exit(1)
    break
  case 'failed':
    console.error(`harness failed: ${result.error?.message ?? 'unknown error'}`)
    process.exit(1)
    break
  default:
    console.error(`harness failed: unexpected status ${result.status}`)
    process.exit(1)
}
