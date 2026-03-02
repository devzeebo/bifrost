"use client";

import { type Toast, ToastType } from "@/lib/toast";

interface ToastItemProps {
  toast: Toast;
  onRemove: (id: string) => void;
}

const toastStyles: Record<ToastType, string> = {
  success: "border-green-500 bg-green-50 dark:bg-green-900/20",
  error: "border-red-500 bg-red-50 dark:bg-red-900/20",
  info: "border-blue-500 bg-blue-50 dark:bg-blue-900/20",
  warning: "border-yellow-500 bg-yellow-50 dark:bg-yellow-900/20",
};

const iconStyles: Record<ToastType, string> = {
  success: "✓",
  error: "✕",
  info: "ℹ",
  warning: "⚠",
};

export function Toast({ toast, onRemove }: ToastItemProps) {
  return (
    <div
      className={`border-l-4 p-4 shadow-lg min-w-[300px] max-w-[400px] ${toastStyles[toast.type]}`}
    >
      <div className="flex items-start gap-3">
        <span className="text-lg">{iconStyles[toast.type]}</span>
        <div className="flex-1">
          <div className="font-semibold text-gray-900 dark:text-gray-100">
            {toast.title}
          </div>
          {toast.description && (
            <div className="text-sm text-gray-600 dark:text-gray-300 mt-1">
              {toast.description}
            </div>
          )}
        </div>
        <button
          onClick={() => onRemove(toast.id)}
          className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 ml-2"
        >
          ✕
        </button>
      </div>
    </div>
  );
}
