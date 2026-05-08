import Handlebars from 'handlebars';

/**
 * Render a Handlebars template with taskState values.
 * FR-14: Orchestration Lifecycle - step 8
 * FR-5: Handlebars tokens in prompt body must match declared parameters
 * NFR-7: Reproducibility - deterministic and side-effect free
 *
 * @param promptBody - The Handlebars template from AGENT.md
 * @param taskState - The taskState values for substitution
 * @returns Rendered prompt string
 */
export const renderPrompt = (promptBody: string, taskState: Record<string, unknown>): string => {
  // Register any custom helpers if needed
  // {{#if}} is built-in to Handlebars

  // Compile and render the template
  // Handlebars.compile creates a template function that is deterministic
  const template = Handlebars.compile(promptBody, {
    strict: false, // Don't throw on missing variables - render as empty string
    knownHelpers: { if: true }, // Declare built-in helpers
  });

  // Render with taskState - this operation is side-effect free
  return template(taskState);
};
