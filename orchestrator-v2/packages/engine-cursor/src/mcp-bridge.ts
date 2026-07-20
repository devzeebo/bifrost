import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import {
  resolveToolkit,
  stubEngineContext,
  type ToolkitContext,
  type ToolkitDefinition,
  type ToolkitFactory,
} from "@bifrost-ai/engine";
import { jsonSchemaToZodShape } from "./json-schema-to-zod.js";

function readEnv(name: string): string {
  const value = process.env[name];
  if (!value) {
    throw new Error(`Missing required environment variable: ${name}`);
  }
  return value;
}

function parseToolkitContext(raw: string): ToolkitContext {
  const parsed = JSON.parse(raw) as Partial<ToolkitContext>;
  if (typeof parsed.workItemId !== "string" || typeof parsed.workingDir !== "string") {
    throw new Error("BIFROST_TOOLKIT_CONTEXT must include workItemId and workingDir");
  }
  return {
    workItemId: parsed.workItemId,
    workingDir: parsed.workingDir,
  };
}

async function loadToolkit(moduleRef: string): Promise<ToolkitDefinition | ToolkitFactory> {
  const loaded = await import(moduleRef);
  const toolkit = loaded.default ?? loaded;

  if (typeof toolkit !== "function" && (typeof toolkit !== "object" || toolkit === null)) {
    throw new Error(
      `Toolkit module ${moduleRef} must export a ToolkitDefinition or ToolkitFactory`,
    );
  }

  return toolkit;
}

async function main(): Promise<void> {
  const moduleRef = readEnv("BIFROST_TOOLKIT_MODULE");
  const toolkitContext = parseToolkitContext(readEnv("BIFROST_TOOLKIT_CONTEXT"));
  const context = stubEngineContext(toolkitContext);
  const toolkit = await loadToolkit(moduleRef);
  const definition = resolveToolkit(toolkit, context);

  const server = new McpServer({
    name: definition.name,
    version: definition.version,
  });

  for (const toolDefinition of definition.tools) {
    server.registerTool(
      toolDefinition.name,
      {
        description: toolDefinition.description,
        inputSchema: jsonSchemaToZodShape(toolDefinition.inputSchema),
      },
      async (args) => {
        const result = await toolDefinition.execute(args as Record<string, unknown>, context);
        return {
          content: result.content,
          isError: result.isError,
        };
      },
    );
  }

  await server.connect(new StdioServerTransport());
}

main().catch((error: unknown) => {
  console.error(error);
  process.exit(1);
});
