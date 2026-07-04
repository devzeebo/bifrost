import { randomUUID } from "node:crypto";

import type { InFlightEntry } from "./types.js";

export class DispatchTracker {
  private readonly byDispatchId = new Map<string, InFlightEntry>();
  private readonly byWorkItemId = new Map<string, InFlightEntry>();

  register(dispatchId: string, entry: InFlightEntry): void {
    this.byDispatchId.set(dispatchId, entry);
    this.byWorkItemId.set(entry.workItemId, entry);
  }

  lookupByDispatchId(dispatchId: string): InFlightEntry | undefined {
    return this.byDispatchId.get(dispatchId);
  }

  lookupByWorkItemId(workItemId: string): InFlightEntry | undefined {
    return this.byWorkItemId.get(workItemId);
  }

  resolve(workItemId: string): InFlightEntry | undefined {
    const entry = this.byWorkItemId.get(workItemId);
    if (entry === undefined) {
      return undefined;
    }
    this.remove(workItemId, entry);
    return entry;
  }

  failByPeer(peerId: string): InFlightEntry[] {
    const orphaned: InFlightEntry[] = [];
    for (const [workItemId, entry] of this.byWorkItemId) {
      if (entry.peerId === peerId) {
        orphaned.push(entry);
        this.remove(workItemId, entry);
      }
    }
    return orphaned;
  }

  hasInFlight(): boolean {
    return this.byWorkItemId.size > 0;
  }

  private remove(workItemId: string, entry: InFlightEntry): void {
    this.byWorkItemId.delete(workItemId);
    for (const [dispatchId, tracked] of this.byDispatchId) {
      if (tracked.workItemId === workItemId && tracked.peerId === entry.peerId) {
        this.byDispatchId.delete(dispatchId);
      }
    }
  }
}

export function createDispatchId(): string {
  return randomUUID();
}
