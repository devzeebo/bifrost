import type {
  CreateDraftWorkItemInput,
  DependencyRelationship,
  WorkItemDependency,
  WorkItemMetadataPatch,
  WorkItemSourceClient,
  WorkItemStatus,
} from "@bifrost-ai/interfaces-work";

import type { RpcClient } from "./rpc-client.js";

export function createRpcWorkItemSourceClient(rpc: RpcClient): WorkItemSourceClient {
  return {
    async completeWorkItem(workItemId: string) {
      await rpc.call("workItem.complete", { workItemId });
    },
    async failWorkItem(workItemId: string, message: string) {
      await rpc.call("workItem.fail", { workItemId, message });
    },
    async pauseWorkItem(workItemId: string) {
      await rpc.call("workItem.pause", { workItemId });
    },
    async createDraftWorkItem(input: CreateDraftWorkItemInput) {
      const result = await rpc.call("workItemSource.createDraftWorkItem", { input });
      if (
        typeof result !== "object" ||
        result === null ||
        typeof (result as { workItemId?: unknown }).workItemId !== "string"
      ) {
        throw new Error("workItemSource.createDraftWorkItem returned invalid workItemId");
      }
      return (result as { workItemId: string }).workItemId;
    },
    async startWorkItem(workItemId: string) {
      await rpc.call("workItemSource.startWorkItem", { workItemId });
    },
    async setDependency(
      blockerId: string,
      relationship: DependencyRelationship,
      blockedId: string,
    ) {
      await rpc.call("workItemSource.setDependency", { blockerId, relationship, blockedId });
    },
    async getDependencies(workItemId: string) {
      const result = await rpc.call("workItemSource.getDependencies", { workItemId });
      if (!Array.isArray(result)) {
        throw new Error("workItemSource.getDependencies returned invalid dependencies");
      }
      return result as WorkItemDependency[];
    },
    async getWorkItemStatus(workItemId: string) {
      const result = await rpc.call("workItemSource.getWorkItemStatus", { workItemId });
      if (
        typeof result !== "object" ||
        result === null ||
        typeof (result as { status?: unknown }).status !== "string"
      ) {
        throw new Error("workItemSource.getWorkItemStatus returned invalid status");
      }
      return (result as { status: WorkItemStatus }).status;
    },
    async setState(workItemId: string, state: Record<string, unknown>) {
      await rpc.call("workItemSource.setState", { workItemId, state });
    },
    async updateWorkItemMetadata(workItemId: string, patch: WorkItemMetadataPatch) {
      await rpc.call("workItemSource.updateWorkItemMetadata", { workItemId, patch });
    },
  };
}
