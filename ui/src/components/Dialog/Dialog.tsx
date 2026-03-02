"use client";

import { Dialog as BaseDialog } from "@base-ui/react/dialog";

interface DialogProps {
  open: boolean;
  onClose: () => void;
  title: string;
  description: string;
  confirmLabel?: string;
  cancelLabel?: string;
  onConfirm: () => void;
  color?: "blue" | "green" | "red" | "yellow";
}

const colorStyles = {
  blue: {
    border: "border-blue-500",
    bg: "bg-white dark:bg-gray-800",
    confirm: "border-blue-500 bg-blue-500 text-white hover:bg-blue-600",
    cancel: "border-gray-400 bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 hover:bg-gray-50 dark:hover:bg-gray-700",
  },
  green: {
    border: "border-green-500",
    bg: "bg-white dark:bg-gray-800",
    confirm: "border-green-500 bg-green-500 text-white hover:bg-green-600",
    cancel: "border-gray-400 bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 hover:bg-gray-50 dark:hover:bg-gray-700",
  },
  red: {
    border: "border-red-500",
    bg: "bg-white dark:bg-gray-800",
    confirm: "border-red-500 bg-red-500 text-white hover:bg-red-600",
    cancel: "border-gray-400 bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 hover:bg-gray-50 dark:hover:bg-gray-700",
  },
  yellow: {
    border: "border-yellow-500",
    bg: "bg-white dark:bg-gray-800",
    confirm: "border-yellow-500 bg-yellow-500 text-white hover:bg-yellow-600",
    cancel: "border-gray-400 bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 hover:bg-gray-50 dark:hover:bg-gray-700",
  },
};

export function Dialog({
  open,
  onClose,
  title,
  description,
  confirmLabel = "Confirm",
  cancelLabel = "Cancel",
  onConfirm,
  color = "blue",
}: DialogProps) {
  const styles = colorStyles[color];

  const handleConfirm = () => {
    onConfirm();
  };

  return (
    <BaseDialog.Root
      open={open}
      onOpenChange={(nextOpen) => {
        if (!nextOpen) {
          onClose();
        }
      }}
    >
      <BaseDialog.Portal>
        <BaseDialog.Backdrop className="fixed inset-0 z-50 bg-black/50 backdrop-blur-sm" />
        <BaseDialog.Viewport className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <BaseDialog.Popup
            className={`border-2 shadow w-full max-w-md p-6 ${styles.border} ${styles.bg}`}
            aria-labelledby="dialog-title"
            aria-describedby="dialog-description"
          >
            <div className="flex flex-col gap-4">
              <div>
                <BaseDialog.Title
                  id="dialog-title"
                  className="text-xl font-bold text-gray-900 dark:text-gray-100"
                >
                  {title}
                </BaseDialog.Title>
                <BaseDialog.Description
                  id="dialog-description"
                  className="mt-2 text-gray-700 dark:text-gray-300"
                >
                  {description}
                </BaseDialog.Description>
              </div>
              <div className="flex justify-end gap-3 mt-4">
                <BaseDialog.Close className={`border-2 px-4 py-2 font-semibold ${styles.cancel}`}>
                  {cancelLabel}
                </BaseDialog.Close>
                <BaseDialog.Close
                  onClick={handleConfirm}
                  className={`border-2 px-4 py-2 font-semibold ${styles.confirm}`}
                >
                  {confirmLabel}
                </BaseDialog.Close>
              </div>
            </div>
          </BaseDialog.Popup>
        </BaseDialog.Viewport>
      </BaseDialog.Portal>
    </BaseDialog.Root>
  );
}
