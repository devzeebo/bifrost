import { z } from "zod";

export function jsonSchemaToZodShape(schema: Record<string, unknown>): z.ZodRawShape {
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
