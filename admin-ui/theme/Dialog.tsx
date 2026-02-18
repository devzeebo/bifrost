import { Dialog as BaseDialog } from "@base-ui/react";
import { tailwind } from "./tailwind";

export const Dialog = {
  Root: BaseDialog.Root,
  Trigger: tailwind(
    BaseDialog.Trigger,
    "inline-flex items-center justify-center px-4 py-2 text-sm font-medium rounded-md cursor-pointer transition-colors bg-[var(--bg-tertiary)] border border-[var(--border)] text-[var(--text-primary)] hover:bg-[var(--border)] focus:outline-2 focus:outline-[var(--accent)] focus:outline-offset-2",
  ),
  Portal: BaseDialog.Portal,
  Backdrop: tailwind(BaseDialog.Backdrop, "fixed inset-0 bg-black/50"),
  Popup: tailwind(
    BaseDialog.Popup,
    "fixed top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 bg-[var(--bg-secondary)] border border-[var(--border)] p-6 rounded-md shadow-lg max-w-[calc(100vw-3rem)] w-96",
  ),
  Title: tailwind(BaseDialog.Title, "text-lg font-semibold mb-2 text-[var(--text-primary)]"),
  Description: BaseDialog.Description,
  Close: tailwind(
    BaseDialog.Close,
    "mt-4 inline-flex items-center justify-center px-4 py-2 text-sm font-medium rounded-md cursor-pointer transition-colors bg-[var(--bg-tertiary)] border border-[var(--border)] text-[var(--text-primary)] hover:bg-[var(--border)] focus:outline-2 focus:outline-[var(--accent)] focus:outline-offset-2",
  ),
} as const;
