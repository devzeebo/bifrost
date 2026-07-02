import type { FramePayload, SignedEnvelope } from "./types.js";

export function encodeEnvelope(envelope: SignedEnvelope): string {
  return JSON.stringify(envelope);
}

export function decodeEnvelope(raw: string): SignedEnvelope | null {
  try {
    const parsed: unknown = JSON.parse(raw);
    if (!isSignedEnvelope(parsed)) {
      return null;
    }
    return parsed;
  } catch {
    return null;
  }
}

export function isFramePayload(value: unknown): value is FramePayload {
  if (value === null || typeof value !== "object" || !("kind" in value)) {
    return false;
  }

  const record = value as Record<string, unknown>;
  const kind = record.kind;
  switch (kind) {
    case "rpc.request":
      return (
        typeof record.id === "string" && typeof record.method === "string" && "params" in record
      );
    case "rpc.response":
      return typeof record.id === "string";
    case "rpc.stream":
      return (
        typeof record.id === "string" &&
        typeof record.seq === "number" &&
        (record.event === "data" || record.event === "end" || record.event === "error")
      );
    case "heartbeat":
      return typeof record.runnerId === "string";
    default:
      return false;
  }
}

function isSignedEnvelope(value: unknown): value is SignedEnvelope {
  if (value === null || typeof value !== "object") {
    return false;
  }

  const envelope = value as Partial<SignedEnvelope>;
  return (
    typeof envelope.signature === "string" &&
    typeof envelope.keyId === "string" &&
    envelope.algorithm === "ed25519" &&
    typeof envelope.timestamp === "number" &&
    envelope.payload !== undefined &&
    isFramePayload(envelope.payload)
  );
}
