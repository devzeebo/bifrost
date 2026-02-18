import { Combobox as BaseCombobox } from "@base-ui/react";
import { tailwind } from "./tailwind";

export const Combobox = {
  Root: BaseCombobox.Root,
  Input: tailwind(
    BaseCombobox.Input,
    "w-full px-4 py-2 text-sm rounded-md bg-[var(--bg-tertiary)] border border-[var(--border)] text-[var(--text-primary)] placeholder:text-[var(--text-secondary)] focus:outline-2 focus:outline-[var(--accent)] focus:outline-offset-2",
  ),
  Trigger: tailwind(
    BaseCombobox.Trigger,
    "flex items-center justify-center w-6 h-6 text-[var(--text-secondary)] hover:text-[var(--text-primary)]",
  ),
  Clear: tailwind(
    BaseCombobox.Clear,
    "flex items-center justify-center w-6 h-6 text-[var(--text-secondary)] hover:text-[var(--text-primary)]",
  ),
  Portal: BaseCombobox.Portal,
  Positioner: BaseCombobox.Positioner,
  Popup: tailwind(
    BaseCombobox.Popup,
    "rounded-md bg-[var(--bg-secondary)] border border-[var(--border)] py-1 shadow-lg max-h-64 overflow-y-auto origin-[var(--transform-origin)] transition-[transform,opacity] data-[starting-style]:scale-90 data-[starting-style]:opacity-0 data-[ending-style]:scale-90 data-[ending-style]:opacity-0",
  ),
  List: BaseCombobox.List,
  Item: tailwind(
    BaseCombobox.Item,
    "grid grid-cols-[1rem_1fr] items-center gap-2 px-4 py-2 text-sm cursor-default select-none outline-none text-[var(--text-primary)] data-[highlighted]:bg-[var(--bg-tertiary)]",
  ),
  ItemIndicator: BaseCombobox.ItemIndicator,
  Empty: tailwind(BaseCombobox.Empty, "px-4 py-2 text-sm text-[var(--text-secondary)]"),
} as const;
