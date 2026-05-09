"use client";

import { Toggle } from "@base-ui/react/toggle";
import { ToggleGroup } from "@base-ui/react/toggle-group";

type StatusSelectorProps = {
  status: "draft" | "open";
  onStatusChange: (value: "draft" | "open") => void;
};

export const StatusSelector = ({ status, onStatusChange }: StatusSelectorProps) => (
  <div>
    <div className="text-xs uppercase tracking-wider block mb-3 font-bold">Status</div>
    <ToggleGroup
      value={[status]}
      onValueChange={([nextStatus]) => {
        if (nextStatus === "draft" || nextStatus === "open") {
          onStatusChange(nextStatus);
        }
      }}
      className="grid grid-cols-2 gap-2"
    >
      {["draft", "open"].map((statusOption) => (
        <Toggle
          key={statusOption}
          value={statusOption}
          className="px-3 py-2 text-sm font-bold uppercase tracking-wider"
          style={{
            backgroundColor: status === statusOption ? "var(--color-amber)" : "var(--color-bg)",
            border: "2px solid var(--color-border)",
            color: status === statusOption ? "white" : "var(--color-text)",
          }}
        >
          {statusOption}
        </Toggle>
      ))}
    </ToggleGroup>
  </div>
);
