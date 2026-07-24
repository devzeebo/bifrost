import type { OpenWorkItemStatus } from "@bifrost-ai/ui-events";

type StatusBadgeProps = {
  status: OpenWorkItemStatus;
};

const STATUS_LABELS: Record<OpenWorkItemStatus, string> = {
  draft: "draft",
  ready: "ready",
  in_progress: "in progress",
  completed: "completed",
  failed: "failed",
};

export function StatusBadge({ status }: StatusBadgeProps) {
  return <span className={`status status-${status}`}>{STATUS_LABELS[status]}</span>;
}
