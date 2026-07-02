import { describe, expect } from "vite-plus/test";
import test from "vitest-gwt";

import { canonicalize } from "./canonicalize.js";
import { generateKeyPair } from "./keys.js";
import { buildSigningMaterial, signPayload, signRawMaterial, verifyEnvelope } from "./sign.js";
import type { FramePayload, PeerIdentity, SignedEnvelope } from "./types.js";
import type { KeyObject } from "node:crypto";

type Context = {
  signer: PeerIdentity;
  verifier: PeerIdentity;
  trustedKeys: Map<string, KeyObject>;
  payload: FramePayload;
  envelope: SignedEnvelope;
  verified: boolean;
  tampered: SignedEnvelope;
  wrongKeyVerified: boolean;
  nonCanonicalVerified: boolean;
};

describe("signPayload and verifyEnvelope", () => {
  test("round-trips sign and verify", {
    given: {
      keypairs_and_payload,
    },
    when: {
      signing_and_verifying,
    },
    then: {
      verification_succeeds,
    },
  });

  test("rejects tampered payload", {
    given: {
      keypairs_and_payload,
      signed_envelope,
    },
    when: {
      tampering_payload,
      verifying_tampered,
    },
    then: {
      tampered_verification_fails,
    },
  });

  test("rejects wrong public key", {
    given: {
      keypairs_and_payload,
      signed_envelope,
      unrelated_keypair,
    },
    when: {
      verifying_with_wrong_key,
    },
    then: {
      wrong_key_verification_fails,
    },
  });

  test("rejects non-canonical signing material", {
    given: {
      keypairs_and_payload,
      signed_envelope,
    },
    when: {
      verifying_with_non_canonical_signature,
    },
    then: {
      non_canonical_verification_fails,
    },
  });
});

function keypairs_and_payload(this: Context) {
  this.signer = generateKeyPair("signer");
  this.verifier = this.signer;
  this.trustedKeys = new Map([[this.signer.keyId, this.signer.publicKey]]);
  this.payload = { kind: "heartbeat", runnerId: "hello" };
}

function unrelated_keypair(this: Context) {
  const other = generateKeyPair("other");
  this.trustedKeys = new Map([[other.keyId, other.publicKey]]);
}

function signed_envelope(this: Context) {
  this.envelope = signPayload(this.payload, this.signer);
}

function signing_and_verifying(this: Context) {
  this.envelope = signPayload(this.payload, this.signer);
  this.verified = verifyEnvelope(this.envelope, this.trustedKeys);
}

function tampering_payload(this: Context) {
  this.tampered = {
    ...this.envelope,
    payload: { kind: "heartbeat", runnerId: "tampered" },
  };
}

function verifying_tampered(this: Context) {
  this.verified = verifyEnvelope(this.tampered, this.trustedKeys);
}

function verifying_with_wrong_key(this: Context) {
  this.wrongKeyVerified = verifyEnvelope(this.envelope, this.trustedKeys);
}

function verifying_with_non_canonical_signature(this: Context) {
  const nonCanonicalMaterial = JSON.stringify({
    timestamp: this.envelope.timestamp,
    payload: this.envelope.payload,
    keyId: this.envelope.keyId,
    algorithm: this.envelope.algorithm,
  });
  const badSignature = signRawMaterial(nonCanonicalMaterial, this.signer);
  const nonCanonicalEnvelope: SignedEnvelope = {
    ...this.envelope,
    signature: badSignature,
  };
  this.nonCanonicalVerified = verifyEnvelope(nonCanonicalEnvelope, this.trustedKeys);
}

function verification_succeeds(this: Context) {
  expect(this.verified).toBe(true);
}

function tampered_verification_fails(this: Context) {
  expect(this.verified).toBe(false);
}

function wrong_key_verification_fails(this: Context) {
  expect(this.wrongKeyVerified).toBe(false);
}

function non_canonical_verification_fails(this: Context) {
  expect(this.nonCanonicalVerified).toBe(false);
  expect(buildSigningMaterial(this.envelope)).not.toBe(
    JSON.stringify({
      timestamp: this.envelope.timestamp,
      payload: this.envelope.payload,
      keyId: this.envelope.keyId,
      algorithm: this.envelope.algorithm,
    }),
  );
  expect(
    canonicalize({
      algorithm: this.envelope.algorithm,
      keyId: this.envelope.keyId,
      payload: this.envelope.payload,
      timestamp: this.envelope.timestamp,
    }),
  ).toBe(buildSigningMaterial(this.envelope));
}
