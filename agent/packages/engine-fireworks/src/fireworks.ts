import { defineEngine, type Engine, type EngineCall, type EngineContext } from "@agent/engines";

const sessionAffinityHeader = "x-session-affinity";

const withSessionAffinity = (call: EngineCall, context: EngineContext): EngineCall => {
  if (context.sessionId === undefined || context.sessionId === "") {
    return call;
  }
  return {
    body: {
      ...call.body,
      prompt_cache_key: context.sessionId,
    },
    headers: {
      ...call.headers,
      [sessionAffinityHeader]: context.sessionId,
    },
  };
};

export const fireworksEngine: Engine = defineEngine({
  name: "fireworks",
  prepare: withSessionAffinity,
});

export default fireworksEngine;
