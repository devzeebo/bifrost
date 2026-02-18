import { Popover as BasePopover } from "@base-ui/react";
import { tailwind } from "./tailwind";

export const Popover = {
  Root: BasePopover.Root,
  Trigger: tailwind(
    BasePopover.Trigger,
    "inline-flex items-center justify-center px-4 py-2 text-sm font-medium rounded-md cursor-pointer transition-colors bg-[var(--bg-tertiary)] border border-[var(--border)] text-[var(--text-primary)] hover:bg-[var(--border)] focus:outline-2 focus:outline-[var(--accent)] focus:outline-offset-2",
  ),
  Portal: BasePopover.Portal,
  Positioner: BasePopover.Positioner,
  Popup: tailwind(
    BasePopover.Popup,
    "rounded-md bg-[var(--bg-secondary)] border border-[var(--border)] p-4 shadow-lg origin-[var(--transform-origin)] transition-[transform,opacity] data-[starting-style]:scale-90 data-[starting-style]:opacity-0 data-[ending-style]:scale-90 data-[ending-style]:opacity-0",
  ),
  Title: tailwind(BasePopover.Title, "text-sm font-semibold mb-2 text-[var(--text-primary)]"),
  Description: tailwind(BasePopover.Description, "text-sm text-[var(--text-secondary)]"),
  Close: tailwind(
    BasePopover.Close,
    "mt-3 inline-flex items-center justify-center px-3 py-1.5 text-sm font-medium rounded-md cursor-pointer transition-colors bg-[var(--bg-tertiary)] border border-[var(--border)] text-[var(--text-primary)] hover:bg-[var(--border)]",
  ),
  Arrow: BasePopover.Arrow,
} as const;
