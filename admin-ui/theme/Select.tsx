import { Select as BaseSelect } from "@base-ui/react";
import { tailwind } from "./tailwind";

export const Select = {
  Root: BaseSelect.Root,
  Trigger: tailwind(
    BaseSelect.Trigger,
    "inline-flex items-center justify-between gap-2 min-w-[10rem] px-4 py-2 text-sm font-medium rounded-md cursor-pointer transition-colors bg-[var(--bg-tertiary)] border border-[var(--border)] text-[var(--text-primary)] hover:bg-[var(--border)] focus:outline-2 focus:outline-[var(--accent)] focus:outline-offset-2",
  ),
  Value: BaseSelect.Value,
  Icon: BaseSelect.Icon,
  Portal: BaseSelect.Portal,
  Positioner: BaseSelect.Positioner,
  Popup: tailwind(
    BaseSelect.Popup,
    "rounded-md bg-[var(--bg-secondary)] border border-[var(--border)] py-1 shadow-lg max-h-64 overflow-y-auto origin-[var(--transform-origin)] transition-[transform,opacity] data-[starting-style]:scale-90 data-[starting-style]:opacity-0 data-[ending-style]:scale-90 data-[ending-style]:opacity-0",
  ),
  Item: tailwind(
    BaseSelect.Item,
    "grid grid-cols-[1rem_1fr] items-center gap-2 px-4 py-2 text-sm cursor-default select-none outline-none text-[var(--text-primary)] data-[highlighted]:bg-[var(--bg-tertiary)]",
  ),
  ItemIndicator: BaseSelect.ItemIndicator,
  ItemText: BaseSelect.ItemText,
  ScrollUpArrow: BaseSelect.ScrollUpArrow,
  ScrollDownArrow: BaseSelect.ScrollDownArrow,
  Group: BaseSelect.Group,
  GroupLabel: tailwind(
    BaseSelect.GroupLabel,
    "px-4 py-2 text-xs font-medium text-[var(--text-secondary)] uppercase tracking-wide",
  ),
  Separator: tailwind(BaseSelect.Separator, "my-1 h-px bg-[var(--border)]"),
} as const;
