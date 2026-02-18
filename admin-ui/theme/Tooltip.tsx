import { Tooltip as BaseTooltip } from "@base-ui/react";
import { tailwind } from "./tailwind";

export const Tooltip = {
  Root: BaseTooltip.Root,
  Trigger: BaseTooltip.Trigger,
  Portal: BaseTooltip.Portal,
  Positioner: BaseTooltip.Positioner,
  Popup: tailwind(
    BaseTooltip.Popup,
    "px-3 py-1.5 text-xs font-medium rounded bg-[var(--bg-tertiary)] border border-[var(--border)] text-[var(--text-primary)] shadow-md origin-[var(--transform-origin)] transition-[transform,opacity] data-[starting-style]:scale-90 data-[starting-style]:opacity-0 data-[ending-style]:scale-90 data-[ending-style]:opacity-0",
  ),
  Arrow: BaseTooltip.Arrow,
} as const;
