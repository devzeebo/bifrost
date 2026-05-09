import type { ReactNode } from "react";
import { AuthProvider } from "../lib/auth";
import { RealmProvider } from "../lib/realm";
import { ThemeProvider } from "../lib/theme";
import { ToastProvider } from "../lib/toast";

const Wrapper = ({ children }: { children: ReactNode }): ReactNode => (
  <AuthProvider>
    <ThemeProvider>
      <RealmProvider>
        <ToastProvider>{children}</ToastProvider>
      </RealmProvider>
    </ThemeProvider>
  </AuthProvider>
);

export { Wrapper };
