import { readFile, writeFile } from 'node:fs/promises'
import path from 'node:path'
import { pathToFileURL } from 'node:url'

const workspace = process.env.BIFROST_WORKSPACE?.trim() || '/workspace'
const runSpecPath = path.join(workspace, 'run-spec.json')
const bodyPath = path.join(workspace, 'body.mjs')
const outputsPath = path.join(workspace, 'outputs.json')

let runSpec
try {
  runSpec = JSON.parse(await readFile(runSpecPath, 'utf8'))
} catch (error) {
  console.error(`failed to read run-spec.json: ${error instanceof Error ? error.message : error}`)
  process.exit(1)
}

let mod
try {
  mod = await import(pathToFileURL(bodyPath).href)
} catch (error) {
  console.error(`failed to import body.mjs: ${error instanceof Error ? error.message : error}`)
  process.exit(1)
}

if (typeof mod.handler !== 'function') {
  console.error('script body must export a function named handler')
  process.exit(1)
}

let result
try {
  result = await mod.handler(runSpec)
} catch (error) {
  console.error(`handler failed: ${error instanceof Error ? error.message : error}`)
  process.exit(1)
}

try {
  await writeFile(outputsPath, `${JSON.stringify(result ?? null, null, 2)}\n`, 'utf8')
} catch (error) {
  console.error(`failed to write outputs.json: ${error instanceof Error ? error.message : error}`)
  process.exit(1)
}
