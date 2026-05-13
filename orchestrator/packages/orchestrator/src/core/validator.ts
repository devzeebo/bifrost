export type ValidationResult = {
  valid: boolean;
  errors: string[];
};

/**
 * Validate taskState against template.parameters schema.
 * FR-5: template.parameters Schema Rules
 * US-6: Dispatch an agent with a pre-populated unit of work
 */
export const validateTaskState = (
  taskState: Record<string, unknown>,
  schema: Record<string, unknown>,
): ValidationResult => {
  const errors: string[] = [];

  const validateValue = (value: unknown, schemaNode: unknown, path: string): void => {
    // If schemaNode is not an object, it's a scalar type hint - just check existence
    if (typeof schemaNode !== "object" || schemaNode === null) {
      // oxlint-disable-next-line no-undefined
      if (value === undefined || value === null || value === "") {
        errors.push(`Missing required parameter: ${path}`);
      }
      return;
    }

    // Schema node is an object - validate recursively
    const schemaObj = schemaNode as Record<string, unknown>;

    // If value is missing/null/empty, check if path is optional
    // oxlint-disable-next-line no-undefined
    if (value === undefined || value === null || value === "") {
      return; // Handled by parent check
    }

    // Value exists - validate its structure
    if (typeof value !== "object" || value === null) {
      // Value is scalar but schema expects object - already caught above
      return;
    }

    const valueObj = value as Record<string, unknown>;

    // Recursively validate each schema key
    for (const [key, subSchema] of Object.entries(schemaObj)) {
      const isOptional = key.endsWith("?");
      let baseKey = "";
      if (isOptional) {
        baseKey = key.slice(0, -1);
      } else {
        baseKey = key;
      }
      let fullPath = "";
      if (path) {
        fullPath = `${path}.${baseKey}`;
      } else {
        fullPath = baseKey;
      }

      // Check if the key exists in value (with or without ? suffix)
      const subValue = valueObj[baseKey] ?? valueObj[key];

      // oxlint-disable-next-line no-undefined
      if (subValue === undefined || subValue === null || subValue === "") {
        if (!isOptional) {
          errors.push(`Missing required parameter: ${fullPath}`);
        }
      } else {
        validateValue(subValue, subSchema, fullPath);
      }
    }
  };

  // Validate each top-level schema parameter
  for (const [key, schemaNode] of Object.entries(schema)) {
    const isOptional = key.endsWith("?");
    const baseKey = isOptional ? key.slice(0, -1) : key;

    // Check if parameter exists in taskState (with or without ? suffix)
    const value = taskState[baseKey] ?? taskState[key];

    // oxlint-disable-next-line no-undefined
    if (value === undefined || value === null || value === "") {
      if (!isOptional) {
        errors.push(`Missing required parameter: ${baseKey}`);
      }
    } else {
      validateValue(value, schemaNode, baseKey);
    }
  }

  return {
    valid: errors.length === 0,
    errors,
  };
};
