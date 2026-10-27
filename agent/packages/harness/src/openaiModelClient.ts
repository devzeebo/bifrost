import { prepareEngines, receiveEngines, type Engine, type EngineCall } from "@bifrost-ai/engines";
import OpenAI from "openai";

import type { ModelClient } from "./modelClient.ts";
import { readLineUsage } from "./usage.ts";

type OpenAIModelClientOptions = {
  readonly apiKey?: string;
  readonly engines?: readonly Engine[];
};

const headerRecord = (headers: Headers): Record<string, string> =>
  Object.fromEntries(headers.entries());

export const createOpenAIModelClient = (options: OpenAIModelClientOptions = {}): ModelClient => {
  const client = new OpenAI(options.apiKey === undefined ? {} : { apiKey: options.apiKey });
  const engines = options.engines ?? [];

  return {
    createResponse: async (request) => {
      const call: EngineCall = {
        body: {
          model: request.model,
          input: [...request.input],
          store: false,
          stream: false,
          ...(request.instructions === undefined ? {} : { instructions: request.instructions }),
          ...(request.tools.length === 0 ? {} : { tools: [...request.tools] }),
        },
        headers: {},
      };
      const prepared = await prepareEngines(call, engines, { sessionId: request.sessionId });
      const { data, response } = await client.responses
        .create(prepared.body, { headers: prepared.headers })
        .withResponse();
      const received = await receiveEngines(
        { body: data, headers: headerRecord(response.headers) },
        engines,
        { sessionId: request.sessionId },
      );
      const usage = readLineUsage(received.body.usage);
      return {
        status: received.body.status ?? "",
        outputText: received.body.output_text,
        output: received.body.output,
        ...(usage === undefined ? {} : { usage }),
      };
    },
  };
};
