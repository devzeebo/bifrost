import { Menu as BaseMenu } from "@base-ui/react";
import { tailwind } from "./tailwind";

export const Menu = {
  Root: BaseMenu.Root,
  Trigger: tailwind(
    BaseMenu.Trigger,
    "inline-flex items-center justify-center gap-2 px-4 py-2 text-sm font-medium rounded-md cursor-pointer transition-colors bg-[var(--bg-tertiary)] border border-[var(--border)] text-[var(--text-primary)] hover:bg-[var(--border)] focus:outline-2 focus:outline-[var(--accent)] focus:outline-offset-2",
  ),
  Portal: BaseMenu.Portal,
  Positioner: BaseMenu.Positioner,
  Popup: tailwind(
    BaseMenu.Popup,
    "rounded-md bg-[var(--bg-secondary)] border border-[var(--border)] py-1 shadow-lg origin-[var(--transform-origin)] transition-[transform,opacity] data-[starting-style]:scale-90 data-[starting-style]:opacity-0 data-[ending-style]:scale-90 data-[ending-style]:opacity-0",
  ),
  Arrow: BaseMenu.Arrow,
  Item: tailwind(
    BaseMenu.Item,
    "grid grid-cols-[1rem_1fr] items-center gap-2 px-4 py-2 text-sm cursor-default select-none outline-none text-[var(--text-primary)] data-[highlighted]:bg-[var(--bg-tertiary)]",
  ),
  Group: BaseMenu.Group,
  GroupLabel: tailwind(
    BaseMenu.GroupLabel,
    "px-4 py-2 text-xs font-medium text-[var(--text-secondary)] uppercase tracking-wide",
  ),
  Separator: tailwind(BaseMenu.Separator, "my-1 h-px bg-[var(--border)]"),
  CheckboxItem: tailwind(
    BaseMenu.CheckboxItem,
    "grid grid-cols-[1rem_1fr] items-center gap-2 px-4 py-2 text-sm cursor-default select-none outline-none text-[var(--text-primary)] data-[highlighted]:bg-[var(--bg-tertiary)]",
  ),
  CheckboxItemIndicator: BaseMenu.CheckboxItemIndicator,
  RadioGroup: BaseMenu.RadioGroup,
  RadioItem: tailwind(
    BaseMenu.RadioItem,
    "grid grid-cols-[1rem_1fr] items-center gap-2 px-4 py-2 text-sm cursor-default select-none outline-none text-[var(--text-primary)] data-[highlighted]:bg-[var(--bg-tertiary)]",
  ),
  RadioItemIndicator: BaseMenu.RadioItemIndicator,
} as const;
