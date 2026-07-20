import { Type } from "typebox";
import { defineTool, type ToolDefinition } from "@earendil-works/pi-coding-agent";
import type {
  EngineContext,
  ResolvedToolkitDefinition,
  ToolkitDefinition,
  ToolkitFactory,
} from "@bifrost-ai/engine";
import createDebug from "debug";

const debug = createDebug("bifrost:engine:pi:toolkit");

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

/**
 * Convert a JSON Schema object into a TypeBox schema for Pi `defineTool`.
 * Supports common primitive property types used by Bifrost toolkits.
 */
export function jsonSchemaToTypeBox(
  schema: Record<string, unknown>,
): ReturnType<typeof Type.Object> {
  const properties = (schema.properties ?? {}) as Record<string, Record<string, unknown>>;
  const required = new Set((schema.required as string[] | undefined) ?? []);
  const shape: Record<string, unknown> = {};

  for (const [key, property] of Object.entries(properties)) {
    const description = typeof property.description === "string" ? property.description : undefined;
    let field;

    if (property.type === "string") {
      field = Type.String(description !== undefined ? { description } : {});
    } else if (property.type === "boolean") {
      field = Type.Boolean(description !== undefined ? { description } : {});
    } else if (property.type === "number" || property.type === "integer") {
      field = Type.Number(description !== undefined ? { description } : {});
    } else if (property.type === "array") {
      field = Type.Array(Type.Any(), description !== undefined ? { description } : {});
    } else {
      field = Type.Any(description !== undefined ? { description } : {});
    }

    if (!required.has(key)) {
      field = Type.Optional(field);
    }

    shape[key] = field;
  }

  return Type.Object(shape as Parameters<typeof Type.Object>[0]);
}

/**
 * Bind a Bifrost toolkit to Pi custom tools.
 * Tool names keep the `mcp__{toolkit}__{tool}` form so AGENT.md stays engine-agnostic.
 */
export function bindToolkitToPi(
  definition: ResolvedToolkitDefinition,
  context: EngineContext,
): ToolDefinition[] {
  return definition.tools.map((toolDefinition) => {
    const name = `mcp__${definition.name}__${toolDefinition.name}`;
    const parameters = jsonSchemaToTypeBox(toolDefinition.inputSchema);

    return defineTool({
      name,
      label: toolDefinition.name,
      description: toolDefinition.description,
      promptSnippet: toolDefinition.description,
      parameters,
      execute: async (toolCallId, params) => {
        debug("custom tool start name=%s id=%s", name, toolCallId);
        const startedAt = Date.now();
        try {
          const result = await toolDefinition.execute(params as Record<string, unknown>, context);

          const content = result.content.map((block) => ({
            type: "text" as const,
            text: result.isError === true ? `Error: ${block.text}` : block.text,
          }));

          debug(
            "custom tool end name=%s id=%s isError=%s elapsedMs=%s",
            name,
            toolCallId,
            result.isError === true,
            Date.now() - startedAt,
          );

          return {
            content,
            details: {},
          };
        } catch (error) {
          debug(
            "custom tool error name=%s id=%s elapsedMs=%s error=%s",
            name,
            toolCallId,
            Date.now() - startedAt,
            error instanceof Error ? error.message : String(error),
          );
          throw error;
        }
      },
    });
  });
}
