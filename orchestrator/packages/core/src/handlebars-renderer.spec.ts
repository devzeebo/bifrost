import { describe, it, expect } from 'vitest';
import { renderPrompt } from './handlebars-renderer.js';

describe('Handlebars Prompt Renderer', () => {
  describe('FR-14: Render Handlebars prompt with taskState values', () => {
    it('should replace simple Handlebars tokens with taskState values', () => {
      // Given a prompt body with Handlebars tokens
      const promptBody = 'Write {{language.name}} code using {{testFramework.name}}.';

      // And taskState with matching values
      const taskState = {
        language: { name: 'Python', prompt: 'Write Python code' },
        testFramework: { name: 'pytest', prompt: 'Use pytest framework' },
      };

      // When rendering
      const rendered = renderPrompt(promptBody, taskState);

      // Then tokens are replaced with values
      expect(rendered).toContain('Python');
      expect(rendered).toContain('pytest');
      expect(rendered).not.toContain('{{');
    });

    it('should render nested object paths', () => {
      const promptBody = 'PR: {{context.prDescription}}, Notes: {{context.additionalNotes}}';
      const taskState = {
        context: {
          prDescription: 'Fix authentication bug',
          additionalNotes: 'Urgent - blocking release',
        },
      };

      const rendered = renderPrompt(promptBody, taskState);

      expect(rendered).toContain('Fix authentication bug');
      expect(rendered).toContain('Urgent - blocking release');
    });

    it('should render empty string for missing optional parameters', () => {
      // Given absent optional Handlebars tokens render as empty string
      const promptBody = 'Write tests. {{context.additionalNotes}}';
      const taskState = {
        // context is optional and absent
      };

      // When rendering
      const rendered = renderPrompt(promptBody, taskState);

      // Then absent optional field renders as empty string
      expect(rendered).toBe('Write tests. ');
    });

    it('should support {{#if}} blocks for optional parameters', () => {
      const promptBody =
        '{{#if context.prDescription}}PR: {{context.prDescription}}{{/if}} Write tests.';
      const taskState = {
        context: {
          prDescription: 'Add unit tests',
        },
      };

      const rendered = renderPrompt(promptBody, taskState);

      expect(rendered).toContain('PR: Add unit tests');
      expect(rendered).toContain('Write tests');
    });

    it('should exclude {{#if}} content when parameter is absent', () => {
      const promptBody =
        '{{#if context.prDescription}}PR: {{context.prDescription}}{{/if}} Write tests.';
      const taskState = {};

      const rendered = renderPrompt(promptBody, taskState);

      expect(rendered).not.toContain('PR:');
      expect(rendered).toContain('Write tests');
    });
  });

  describe('FR-5: Handlebars tokens in prompt body must match declared parameters', () => {
    it('should fail gracefully on undeclared tokens', () => {
      // This is validated during AGENT.md parsing, not rendering
      // Rendering should handle missing keys gracefully
      const promptBody = 'Use {{framework}} for {{language}}';
      const taskState = {
        language: 'Python',
        // framework is missing
      };

      const rendered = renderPrompt(promptBody, taskState);

      // Missing tokens render as empty string
      expect(rendered).toContain('Python');
      expect(rendered).toContain('for'); // "Use  for Python" - framework is empty
    });
  });

  describe('NFR-7: Reproducibility', () => {
    it('should produce identical output for same inputs', () => {
      const promptBody = 'Write {{language}} tests with {{framework}}';
      const taskState = { language: 'Python', framework: 'pytest' };

      const rendered1 = renderPrompt(promptBody, taskState);
      const rendered2 = renderPrompt(promptBody, taskState);

      // Given same AGENT.md, same taskState, same projectDir
      // Two dispatches produce identical rendered prompts
      expect(rendered1).toBe(rendered2);
    });

    it('should be side-effect free', () => {
      const promptBody = 'Use {{language}}';
      const taskState = { language: 'Python' };

      const originalTaskState = { ...taskState };
      renderPrompt(promptBody, taskState);

      // Handlebars rendering is deterministic and side-effect free
      expect(taskState).toEqual(originalTaskState);
    });
  });
});
