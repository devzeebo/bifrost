import {
  createHash,
  createPrivateKey,
  createPublicKey,
  generateKeyPairSync,
  type KeyObject,
} from "node:crypto";

import type { PeerIdentity } from "./types.js";

export type LoadKeyPairOptions = {
  privateKeyPem: string;
  publicKeyPem: string;
  keyId: string;
};

export function fingerprintPublicKey(publicKey: KeyObject): string {
  const der = publicKey.export({ format: "der", type: "spki" });
  return createHash("sha256").update(der).digest("base64url").slice(0, 16);
}

export function generateKeyPair(keyId?: string): PeerIdentity {
  const { publicKey, privateKey } = generateKeyPairSync("ed25519");
  return {
    keyId: keyId ?? fingerprintPublicKey(publicKey),
    publicKey,
    privateKey,
  };
}

export function loadKeyPair(options: LoadKeyPairOptions): PeerIdentity {
  return {
    keyId: options.keyId,
    publicKey: createPublicKey(options.publicKeyPem),
    privateKey: createPrivateKey(options.privateKeyPem),
  };
}

export function loadTrustedPublicKey(options: {
  keyId: string;
  publicKeyPem: string;
}): ReadonlyMap<string, KeyObject> {
  return new Map([[options.keyId, createPublicKey(options.publicKeyPem)]]);
}

export function exportPublicKeyPem(publicKey: KeyObject): string {
  return publicKey.export({ format: "pem", type: "spki" }).toString();
}

export function exportPrivateKeyPem(privateKey: KeyObject): string {
  return privateKey.export({ format: "pem", type: "pkcs8" }).toString();
}
