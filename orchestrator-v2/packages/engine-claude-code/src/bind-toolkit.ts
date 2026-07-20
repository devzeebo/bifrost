import { createSdkMcpServer, tool } from "@anthropic-ai/claude-agent-sdk";
import type { McpSdkServerConfigWithInstance } from "@anthropic-ai/claude-agent-sdk";
import type {
  EngineContext,
  ResolvedToolkitDefinition,
  ToolkitDefinition,
  ToolkitFactory,
} from "@bifrost-ai/engine";
import { z } from "zod";

export async function loadToolkitModule(
  moduleRef: string,
): Promise<ToolkitDefinition | ToolkitFactory> {
  const loaded = await import(moduleRef);
  const toolkit = loaded.default ?? loaded;

  if (typeof toolkit !== "function" && (typeof toolkit !== "object" || toolkit === null)) {
    throw new Error(
      `Toolkit module ${moduleRef} must export a ToolkitDefinition or ToolkitFactory`,
    );
  }

  return toolkit;
}

function jsonSchemaToZodShape(schema: Record<string, unknown>): z.ZodRawShape {
  const properties = (schema.properties ?? {}) as Record<string, Record<string, unknown>>;
  const required = new Set((schema.required as string[] | undefined) ?? []);
  const shape = {} as Record<string, z.ZodTypeAny>;

  for (const [key, property] of Object.entries(properties)) {
    let field: z.ZodTypeAny = z.any();

    if (property.type === "string") {
      field = z.string();
    } else if (property.type === "boolean") {
      field = z.boolean();
    } else if (property.type === "number" || property.type === "integer") {
      field = z.number();
    }

    if (!required.has(key)) {
      field = field.optional();
    }

    if (typeof property.description === "string") {
      field = field.describe(property.description);
    }

    shape[key] = field;
  }

  return shape;
}

export function bindToolkitToClaude(
  definition: ResolvedToolkitDefinition,
  context: EngineContext,
): McpSdkServerConfigWithInstance {
  return createSdkMcpServer({
    name: definition.name,
    version: definition.version,
    tools: definition.tools.map((toolDefinition) =>
      tool(
        toolDefinition.name,
        toolDefinition.description,
        jsonSchemaToZodShape(toolDefinition.inputSchema),
        async (args) => toolDefinition.execute(args, context),
      ),
    ),
  });
}
