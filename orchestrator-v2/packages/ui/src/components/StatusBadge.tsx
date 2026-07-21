import type { OpenWorkItemStatus } from "@bifrost-ai/ui-events";

type StatusBadgeProps = {
  status: OpenWorkItemStatus;
};

export function StatusBadge({ status }: StatusBadgeProps) {
  return <span className={`status status-${status}`}>{status}</span>;
}
