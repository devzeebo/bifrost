# 20250624-013. Session Continuation Pattern

Date: 2025-06-24
Version: 1

## Status

Proposed

## Context

Follow-up loops require multiple LLM calls within same conversation session. Each follow-up needs previous context (assistant responses, tool calls, tokens). Framework must maintain session continuity across engine executions.

## Decision

Engine returns `sessionId` in EngineResult. Orchestrator passes `sessionId` to subsequent engine.execute() calls. Engine manages session state (context window, conversation history). Session persists across follow-up attempts.

```typescript
export type EngineResult = {
  success: boolean;
  skipFulfill: boolean;
  lastMessage: string | null;
  stats: ExecutionStats | null;
  sessionId?: string; // Session identifier for continuation
};

export type Engine = {
  execute: (context: EngineContext, sessionId?: string) => Promise<EngineResult>;
};

// Follow-up loop with session continuity
let sessionId: string | undefined = undefined;

while (attemptsUsed <= maxFollowUps) {
  const engineResult = await engine.execute(
    engineContext,
    sessionId, // Pass previous session ID
  );

  sessionId = engineResult.sessionId; // Extract new session ID
}
```

## Consequences

**Positive:**

- Conversation continuity across attempts
- Context window managed by engine
- Efficient token usage (no re-prompting)
- Natural conversation flow

**Negative:**

- Session ID opaque to orchestrator
- No session inspection/debugging hooks
- Engine responsible for session cleanup
- Cannot modify conversation between attempts

## Changelog

- Implement session continuation pattern for follow-up loop conversation continuity
