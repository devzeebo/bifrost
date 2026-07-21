import type { CSSProperties } from "react";
import type { OpenWorkItem } from "@bifrost-ai/ui-events";

import { StatusBadge } from "./StatusBadge.js";

type WorkItemRowProps = {
  item: OpenWorkItem;
  depth: number;
  isWorkflow: boolean;
  expanded?: boolean;
  hasChildren?: boolean;
  onToggle?: () => void;
  isLastChild?: boolean;
};

export function WorkItemRow({
  item,
  depth,
  isWorkflow,
  expanded = true,
  hasChildren = false,
  onToggle,
  isLastChild = false,
}: WorkItemRowProps) {
  return (
    <div
      className={`work-row ${isWorkflow ? "work-row-workflow" : ""} ${isLastChild ? "work-row-last" : ""}`}
      style={{ "--depth": depth } as CSSProperties}
      data-work-item-id={item.workItemId}
    >
      {depth > 0 ? <span className="tree-guide" aria-hidden="true" /> : null}
      <div className="work-row-main">
        {isWorkflow && hasChildren ? (
          <button
            type="button"
            className="expand-btn"
            aria-expanded={expanded}
            aria-label={expanded ? `Collapse ${item.name}` : `Expand ${item.name}`}
            onClick={onToggle}
          >
            {expanded ? "▾" : "▸"}
          </button>
        ) : (
          <span className="expand-spacer" />
        )}
        <div className="work-row-body">
          <span className="work-name">{item.name}</span>
          <span className="work-kind">{item.kind}</span>
          <StatusBadge status={item.status} />
        </div>
      </div>
    </div>
  );
}
