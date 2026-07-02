import { randomUUID } from "node:crypto";

import type { InFlightEntry } from "./types.js";

export class DispatchTracker {
  private readonly byDispatchId = new Map<string, InFlightEntry>();
  private readonly byTaskId = new Map<string, InFlightEntry>();

  register(dispatchId: string, entry: InFlightEntry): void {
    this.byDispatchId.set(dispatchId, entry);
    this.byTaskId.set(entry.taskId, entry);
  }

  lookupByDispatchId(dispatchId: string): InFlightEntry | undefined {
    return this.byDispatchId.get(dispatchId);
  }

  lookupByTaskId(taskId: string): InFlightEntry | undefined {
    return this.byTaskId.get(taskId);
  }

  resolve(taskId: string): InFlightEntry | undefined {
    const entry = this.byTaskId.get(taskId);
    if (entry === undefined) {
      return undefined;
    }
    this.remove(taskId, entry);
    return entry;
  }

  failByPeer(peerId: string): InFlightEntry[] {
    const orphaned: InFlightEntry[] = [];
    for (const [taskId, entry] of this.byTaskId) {
      if (entry.peerId === peerId) {
        orphaned.push(entry);
        this.remove(taskId, entry);
      }
    }
    return orphaned;
  }

  hasInFlight(): boolean {
    return this.byTaskId.size > 0;
  }

  private remove(taskId: string, entry: InFlightEntry): void {
    this.byTaskId.delete(taskId);
    for (const [dispatchId, tracked] of this.byDispatchId) {
      if (tracked.taskId === taskId && tracked.peerId === entry.peerId) {
        this.byDispatchId.delete(dispatchId);
      }
    }
  }
}

export function createDispatchId(): string {
  return randomUUID();
}
