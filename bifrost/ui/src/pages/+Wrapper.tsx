import type { ReactNode } from "react";
import { AuthProvider } from "../lib/auth";
import { RealmProvider } from "../lib/realm";
import { ThemeProvider } from "../lib/theme";
import { ToastProvider } from "../lib/toast";

export { Wrapper };

function Wrapper({ children }: { children: ReactNode }) {
  return (
    <AuthProvider>
      <ThemeProvider>
        <RealmProvider>
          <ToastProvider>{children}</ToastProvider>
        </RealmProvider>
      </ThemeProvider>
    </AuthProvider>
  );
}
