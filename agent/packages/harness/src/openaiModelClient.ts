import OpenAI from "openai";

import type { ModelClient } from "./modelClient.ts";

type OpenAIModelClientOptions = {
  readonly apiKey?: string;
};

export const createOpenAIModelClient = (options: OpenAIModelClientOptions = {}): ModelClient => {
  const client = new OpenAI(options.apiKey === undefined ? {} : { apiKey: options.apiKey });

  return {
    createResponse: async (request) => {
      const response = await client.responses.create({
        model: request.model,
        input: [...request.input],
        store: false,
        stream: false,
        ...(request.instructions === undefined ? {} : { instructions: request.instructions }),
        ...(request.tools.length === 0 ? {} : { tools: [...request.tools] }),
      });

      return {
        status: response.status ?? "",
        outputText: response.output_text,
        output: response.output,
      };
    },
  };
};
