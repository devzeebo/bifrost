#!/usr/bin/env tsx
import { runCli } from "./runCli.ts";

const code = await runCli(process.argv.slice(2));
process.exitCode = code;
