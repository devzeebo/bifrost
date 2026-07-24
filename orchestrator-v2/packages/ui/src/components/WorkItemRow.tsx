import type { CSSProperties } from "react";
import type { OpenWorkItem } from "@bifrost-ai/ui-events";

import { StatusBadge } from "./StatusBadge.js";

type WorkItemRowProps = {
  item: OpenWorkItem;
  depth: number;
  depDepth?: number;
  isWorkflow: boolean;
  expanded?: boolean;
  hasChildren?: boolean;
  onToggle?: () => void;
  isLastChild?: boolean;
  index?: number;
};

export function WorkItemRow({
  item,
  depth,
  depDepth = 0,
  isWorkflow,
  expanded = true,
  hasChildren = false,
  onToggle,
  isLastChild = false,
  index = 0,
}: WorkItemRowProps) {
  const indentDepth = depth + depDepth;

  return (
    <article
      className={`work-card ${isWorkflow ? "work-card-workflow" : "work-card-child"} ${isLastChild ? "work-card-last" : ""}`}
      style={
        {
          "--depth": indentDepth,
          "--stagger": index,
        } as CSSProperties
      }
      data-work-item-id={item.workItemId}
      data-status={item.status}
    >
      {depth > 0 ? <span className="tree-guide" aria-hidden="true" /> : null}
      <div className="work-card-main">
        {isWorkflow && hasChildren ? (
          <button
            type="button"
            className="expand-btn"
            aria-expanded={expanded}
            aria-label={expanded ? `Collapse ${item.name}` : `Expand ${item.name}`}
            onClick={onToggle}
          >
            <span className={`expand-chevron ${expanded ? "is-open" : ""}`} aria-hidden="true" />
          </button>
        ) : (
          <span className="expand-spacer" />
        )}
        <div className="work-card-body">
          <div className="work-card-title-row">
            <h2 className="work-name">{item.name}</h2>
            <StatusBadge status={item.status} />
          </div>
          <p className="work-id">{item.workItemId}</p>
          <p className="work-kind">{item.kind}</p>
        </div>
      </div>
    </article>
  );
}
