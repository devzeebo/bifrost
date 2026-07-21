import type { OpenWorkItem, OpenWorkItemStatus, UiAction } from "@bifrost-ai/ui-events";
import {
  isNonTerminalOpenWorkItemStatus,
  workItemsHydrated,
  workItemsRemoved,
  workItemsUpserted,
} from "@bifrost-ai/ui-events";

export type UiEventListener = (action: UiAction) => void;

/**
 * In-process bus for Redux-shaped UI actions. Keeps an open-work projection
 * so new WebSocket clients can hydrate before receiving live events.
 */
export class UiEventBus {
  readonly #items = new Map<string, OpenWorkItem>();
  readonly #listeners = new Set<UiEventListener>();

  subscribe(listener: UiEventListener): () => void {
    this.#listeners.add(listener);
    return () => {
      this.#listeners.delete(listener);
    };
  }

  snapshot(): OpenWorkItem[] {
    return [...this.#items.values()];
  }

  hydrateAction(): ReturnType<typeof workItemsHydrated> {
    return workItemsHydrated(this.snapshot());
  }

  /** Replace projection without broadcasting (used before per-client hydrate). */
  replaceProjection(items: OpenWorkItem[]): void {
    this.#items.clear();
    for (const item of items) {
      this.#items.set(item.workItemId, item);
    }
  }

  upsert(item: OpenWorkItem): void {
    this.#items.set(item.workItemId, item);
    this.#publish(workItemsUpserted(item));
  }

  remove(workItemId: string): void {
    if (!this.#items.has(workItemId)) {
      return;
    }
    this.#items.delete(workItemId);
    this.#publish(workItemsRemoved(workItemId));
  }

  /**
   * Update status of an already-projected item (e.g. draft → live on start).
   * No-op if the item is unknown.
   */
  updateStatus(workItemId: string, status: OpenWorkItemStatus): void {
    const existing = this.#items.get(workItemId);
    if (existing === undefined) {
      return;
    }
    this.upsert({ ...existing, status });
  }

  /**
   * Mark an item completed/failed. Keeps it if a non-terminal ancestor remains
   * visible; otherwise removes it and prunes orphaned terminal descendants.
   */
  markTerminal(workItemId: string, status: "completed" | "failed"): void {
    const existing = this.#items.get(workItemId);
    if (existing === undefined) {
      this.remove(workItemId);
      return;
    }

    const updated = { ...existing, status };
    this.#items.set(workItemId, updated);

    if (this.#hasNonTerminalAncestor(workItemId)) {
      this.#publish(workItemsUpserted(updated));
      return;
    }

    this.#publish(workItemsUpserted(updated));
    this.#pruneInvisible();
  }

  get(workItemId: string): OpenWorkItem | undefined {
    return this.#items.get(workItemId);
  }

  #hasNonTerminalAncestor(workItemId: string): boolean {
    let current = this.#items.get(workItemId);
    const seen = new Set<string>();
    while (current?.parentWorkItemId !== undefined) {
      if (seen.has(current.parentWorkItemId)) {
        return false;
      }
      seen.add(current.parentWorkItemId);
      const parent = this.#items.get(current.parentWorkItemId);
      if (parent === undefined) {
        return false;
      }
      if (isNonTerminalOpenWorkItemStatus(parent.status)) {
        return true;
      }
      current = parent;
    }
    return false;
  }

  #pruneInvisible(): void {
    const remaining = [...this.#items.values()];
    const keep = new Set<string>();

    for (const item of remaining) {
      if (isNonTerminalOpenWorkItemStatus(item.status)) {
        keep.add(item.workItemId);
      }
    }

    let grew = true;
    while (grew) {
      grew = false;
      for (const item of remaining) {
        if (keep.has(item.workItemId)) {
          continue;
        }
        if (item.parentWorkItemId !== undefined && keep.has(item.parentWorkItemId)) {
          keep.add(item.workItemId);
          grew = true;
        }
      }
    }

    for (const item of remaining) {
      if (!keep.has(item.workItemId)) {
        this.remove(item.workItemId);
      }
    }
  }

  #publish(action: UiAction): void {
    for (const listener of this.#listeners) {
      listener(action);
    }
  }
}
