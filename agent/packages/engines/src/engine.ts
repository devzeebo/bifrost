import type {
  Response,
  ResponseCreateParamsNonStreaming,
} from "openai/resources/responses/responses.js";

export type EngineContext = {
  readonly sessionId?: string;
};

export type EngineCall = {
  readonly body: ResponseCreateParamsNonStreaming;
  readonly headers: Readonly<Record<string, string>>;
};

export type EngineResult = {
  readonly body: Response;
  readonly headers: Readonly<Record<string, string>>;
};

export type Engine = {
  readonly name: string;
  readonly prepare?: (call: EngineCall, context: EngineContext) => EngineCall | Promise<EngineCall>;
  readonly receive?: (
    result: EngineResult,
    context: EngineContext,
  ) => EngineResult | Promise<EngineResult>;
};

type EngineDefinition = {
  readonly name: string;
  readonly prepare?: Engine["prepare"];
  readonly receive?: Engine["receive"];
};

const nameMessage = "Engine name is required";
const hookMessage = "Engine must implement prepare or receive";

export const defineEngine = (definition: EngineDefinition): Engine => {
  if (definition.name.trim() === "") {
    throw new Error(nameMessage);
  }
  if (definition.prepare === undefined && definition.receive === undefined) {
    throw new Error(hookMessage);
  }

  return {
    name: definition.name,
    ...(definition.prepare === undefined ? {} : { prepare: definition.prepare }),
    ...(definition.receive === undefined ? {} : { receive: definition.receive }),
  };
};

export const prepareEngines = async (
  call: EngineCall,
  engines: readonly Engine[],
  context: EngineContext,
): Promise<EngineCall> => {
  let current = call;
  for (const engine of engines) {
    if (engine.prepare === undefined) {
      continue;
    }
    current = await engine.prepare(current, context);
  }
  return current;
};

export const receiveEngines = async (
  result: EngineResult,
  engines: readonly Engine[],
  context: EngineContext,
): Promise<EngineResult> => {
  let current = result;
  for (const engine of engines) {
    if (engine.receive === undefined) {
      continue;
    }
    current = await engine.receive(current, context);
  }
  return current;
};
