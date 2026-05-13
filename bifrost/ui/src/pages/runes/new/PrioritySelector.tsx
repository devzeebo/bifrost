"use client";

import { Toggle } from "@base-ui/react/toggle";
import { ToggleGroup } from "@base-ui/react/toggle-group";

type PrioritySelectorProps = {
  priority: number;
  onPriorityChange: (value: number) => void;
};

export const PrioritySelector = ({ priority, onPriorityChange }: PrioritySelectorProps) => (
  <div>
    <div className="text-xs uppercase tracking-wider block mb-3 font-bold">Priority</div>
    <ToggleGroup
      value={[String(priority)]}
      onValueChange={([nextPriorityString]) => {
        const nextPriority = Number(nextPriorityString);
        if (!Number.isNaN(nextPriority)) {
          onPriorityChange(nextPriority);
        }
      }}
      className="grid grid-cols-4 gap-2"
    >
      {[
        { value: 4, label: "P1" },
        { value: 3, label: "P2" },
        { value: 2, label: "P3" },
        { value: 1, label: "P4" },
      ].map((priorityOption) => (
        <Toggle
          key={priorityOption.value}
          value={String(priorityOption.value)}
          className="px-3 py-2 text-sm font-bold uppercase tracking-wider"
          style={{
            backgroundColor:
              priority === priorityOption.value ? "var(--color-amber)" : "var(--color-bg)",
            border: "2px solid var(--color-border)",
            color: priority === priorityOption.value ? "white" : "var(--color-text)",
          }}
        >
          {priorityOption.label}
        </Toggle>
      ))}
    </ToggleGroup>
  </div>
);
