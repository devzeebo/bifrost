import { Toast as BaseToast } from "@base-ui/react";
import { tailwind } from "./tailwind";

export const Toast = {
  Root: BaseToast.Root,
  Provider: BaseToast.Provider,
  Portal: BaseToast.Portal,
  Viewport: tailwind(BaseToast.Viewport, "fixed bottom-6 right-6 flex flex-col gap-2 w-80 z-50"),
  Message: tailwind(
    BaseToast.Root,
    "flex items-center gap-3 p-4 rounded-md bg-[var(--bg-secondary)] border border-[var(--border)] shadow-lg data-[type=success]:border-[var(--success)] data-[type=error]:border-[var(--danger)] data-[type=warning]:border-[var(--warning)]",
  ),
  Title: tailwind(BaseToast.Title, "text-sm font-medium text-[var(--text-primary)]"),
  Description: tailwind(BaseToast.Description, "text-sm text-[var(--text-secondary)]"),
  Close: tailwind(
    BaseToast.Close,
    "ml-auto p-1 text-[var(--text-secondary)] hover:text-[var(--text-primary)]",
  ),
  Action: tailwind(
    BaseToast.Action,
    "px-3 py-1 text-sm font-medium rounded bg-[var(--bg-tertiary)] border border-[var(--border)] text-[var(--text-primary)] hover:bg-[var(--border)]",
  ),
} as const;
