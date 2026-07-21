import { useDispatch, useSelector } from "react-redux";

import type { RootState } from "../store/store.js";
import { toggleWorkflowExpanded } from "../store/uiSlice.js";
import { selectWorkItemTree } from "../store/workItemsSlice.js";
import { WorkItemRow } from "./WorkItemRow.js";

export function WorkItemTree() {
  const dispatch = useDispatch();
  const roots = useSelector((state: RootState) => selectWorkItemTree(state));
  const expandedMap = useSelector((state: RootState) => state.ui.expandedWorkflowIds);

  if (roots.length === 0) {
    return <p className="empty">No open work items.</p>;
  }

  return (
    <div className="work-tree" role="tree">
      {roots.map((root) => {
        const isWorkflow = root.kind === "workflow";
        const expanded = isWorkflow ? (expandedMap[root.workItemId] ?? true) : true;
        const hasChildren = root.children.length > 0;

        return (
          <div
            key={root.workItemId}
            className="work-group"
            role="treeitem"
            aria-expanded={isWorkflow ? expanded : undefined}
          >
            <WorkItemRow
              item={root}
              depth={0}
              isWorkflow={isWorkflow}
              expanded={expanded}
              hasChildren={hasChildren}
              onToggle={() => {
                dispatch(toggleWorkflowExpanded(root.workItemId));
              }}
            />
            {isWorkflow && expanded
              ? root.children.map((child, index) => (
                  <WorkItemRow
                    key={child.workItemId}
                    item={child}
                    depth={1}
                    isWorkflow={false}
                    isLastChild={index === root.children.length - 1}
                  />
                ))
              : null}
          </div>
        );
      })}
    </div>
  );
}
