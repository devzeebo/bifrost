"use client";

import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  type ReactNode,
} from "react";
import { Toast as BaseToast } from "@base-ui/react/toast";

export type ToastType = "success" | "error" | "info" | "warning";

export type Toast = {
  id: string;
  title: string;
  description?: string;
  type: ToastType;
};

type ToastContextValue = {
  showToast: (title: string, description?: string, type?: ToastType) => void;
};

export const ToastContext = createContext<ToastContextValue | null>(null);

type ToastProviderProps = {
  children: ReactNode;
};

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

function generateId(): string {
  return Math.random().toString(36).substring(2, 9);
}

export function ToastProvider({ children }: ToastProviderProps) {
  const toastManager = useMemo(() => BaseToast.createToastManager(), []);

  const showToast = useCallback(
    (title: string, description?: string, type: ToastType = "info") => {
      const id = generateId();
      toastManager.add({
        id,
        title,
        description,
        type,
        data: {
          id,
          title,
          description,
          type,
        } satisfies Toast,
        timeout: 10000,
      });
    },
    [toastManager]
  );

  const removeToast = useCallback((id: string) => {
    toastManager.close(id);
  }, [toastManager]);

  return (
    <ToastContext.Provider value={{ showToast }}>
      <BaseToast.Provider toastManager={toastManager} timeout={10000} limit={4}>
        {children}
        <ToastViewport removeToast={removeToast} />
      </BaseToast.Provider>
    </ToastContext.Provider>
  );
}

type ToastViewportProps = {
  removeToast: (id: string) => void;
};

function ToastViewport({ removeToast }: ToastViewportProps) {
  const managedToasts = BaseToast.useToastManager();

  return (
    <BaseToast.Portal>
      <BaseToast.Viewport className="fixed bottom-4 right-4 z-[9999] flex flex-col gap-2">
        {managedToasts.toasts.map((toast) => {
          const data = (toast.data as Partial<Toast> | undefined) ?? {};
          const type = data.type ?? ((toast.type as ToastType | undefined) ?? "info");
          const title =
            typeof data.title === "string"
              ? data.title
              : typeof toast.title === "string"
                ? toast.title
                : "Notification";
          const description =
            typeof data.description === "string"
              ? data.description
              : typeof toast.description === "string"
                ? toast.description
                : undefined;

          return (
            <BaseToast.Root
              key={toast.id}
              toast={toast}
              className={`border-l-4 p-4 rounded shadow-lg min-w-[300px] max-w-[400px] ${toastStyles[type]}`}
            >
              <BaseToast.Content className="flex items-start gap-3">
                <span className="text-lg">{iconStyles[type]}</span>
                <div className="flex-1">
                  <BaseToast.Title className="font-semibold text-gray-900 dark:text-gray-100">
                    {title}
                  </BaseToast.Title>
                  {description && (
                    <BaseToast.Description className="text-sm text-gray-600 dark:text-gray-300 mt-1">
                      {description}
                    </BaseToast.Description>
                  )}
                </div>
                <BaseToast.Close
                  onClick={() => removeToast(toast.id)}
                  className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 ml-2"
                >
                  ✕
                </BaseToast.Close>
              </BaseToast.Content>
            </BaseToast.Root>
          );
        })}
      </BaseToast.Viewport>
    </BaseToast.Portal>
  );
}

export function useToast(): ToastContextValue {
  const context = useContext(ToastContext);
  if (!context) {
    throw new Error("useToast must be used within a ToastProvider");
  }
  return context;
}
