import { Tabs as BaseTabs } from "@base-ui/react";
import { tailwind } from "./tailwind";

export const Tabs = {
  Root: BaseTabs.Root,
  List: tailwind(
    BaseTabs.List,
    "flex gap-1 p-1 bg-[var(--bg-tertiary)] rounded-md border border-[var(--border)]",
  ),
  Tab: tailwind(
    BaseTabs.Tab,
    "px-4 py-2 text-sm font-medium rounded cursor-pointer transition-colors text-[var(--text-secondary)] hover:text-[var(--text-primary)] data-[selected]:bg-[var(--bg-secondary)] data-[selected]:text-[var(--text-primary)] focus:outline-2 focus:outline-[var(--accent)] focus:outline-offset-2",
  ),
  Panel: tailwind(BaseTabs.Panel, "p-4 text-[var(--text-primary)]"),
  Indicator: tailwind(
    BaseTabs.Indicator,
    "absolute transition-all duration-200 bg-[var(--bg-secondary)] rounded",
  ),
} as const;
