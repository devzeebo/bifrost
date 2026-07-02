import { sign, verify, type KeyObject } from "node:crypto";

import { canonicalize } from "./canonicalize.js";
import {
  SIGNING_ALGORITHM,
  type FramePayload,
  type SignedEnvelope,
  type UnsignedEnvelope,
} from "./types.js";
import type { PeerIdentity } from "./types.js";

export function buildSigningMaterial(envelope: UnsignedEnvelope): string {
  return canonicalize({
    algorithm: envelope.algorithm,
    keyId: envelope.keyId,
    payload: envelope.payload,
    timestamp: envelope.timestamp,
  });
}

export function signPayload(
  payload: FramePayload,
  identity: PeerIdentity,
  timestamp = Date.now(),
): SignedEnvelope {
  const unsigned: UnsignedEnvelope = {
    algorithm: SIGNING_ALGORITHM,
    keyId: identity.keyId,
    payload,
    timestamp,
  };
  const material = buildSigningMaterial(unsigned);
  const signature = sign(null, Buffer.from(material, "utf8"), identity.privateKey);

  return {
    ...unsigned,
    signature: signature.toString("base64"),
  };
}

export function verifyEnvelope(
  envelope: SignedEnvelope,
  trustedPublicKeys: ReadonlyMap<string, KeyObject>,
): boolean {
  if (envelope.algorithm !== SIGNING_ALGORITHM) {
    return false;
  }

  const publicKey = trustedPublicKeys.get(envelope.keyId);
  if (publicKey === undefined) {
    return false;
  }

  const unsigned: UnsignedEnvelope = {
    algorithm: envelope.algorithm,
    keyId: envelope.keyId,
    payload: envelope.payload,
    timestamp: envelope.timestamp,
  };
  const material = buildSigningMaterial(unsigned);

  let signature: Buffer;
  try {
    signature = Buffer.from(envelope.signature, "base64");
  } catch {
    return false;
  }

  return verify(null, Buffer.from(material, "utf8"), publicKey, signature);
}

export function signRawMaterial(material: string, identity: PeerIdentity): string {
  return sign(null, Buffer.from(material, "utf8"), identity.privateKey).toString("base64");
}
