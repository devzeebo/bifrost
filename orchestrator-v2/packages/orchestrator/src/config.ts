import { createPublicKey, type KeyObject } from "node:crypto";

export type AuthorizedRunnerEntry = {
  keyId: string;
  publicKeyPem: string;
};

export function loadAuthorizedRunners(
  entries: readonly AuthorizedRunnerEntry[],
): ReadonlyMap<string, KeyObject> {
  const trusted = new Map<string, KeyObject>();
  for (const entry of entries) {
    trusted.set(entry.keyId, createPublicKey(entry.publicKeyPem));
  }
  return trusted;
}
