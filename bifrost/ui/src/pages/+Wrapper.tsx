import type { ReactElement, ReactNode } from "react";
import { AuthProvider } from "../lib/auth";
import { RealmProvider } from "../lib/realm";
import { ThemeProvider } from "../lib/theme";
import { ToastProvider } from "../lib/toast";

const Wrapper = ({ children }: { children: ReactNode }): ReactElement => (
  <AuthProvider>
    <ThemeProvider>
      <RealmProvider>
        <ToastProvider>{children as ReactElement}</ToastProvider>
      </RealmProvider>
    </ThemeProvider>
  </AuthProvider>
);

export { Wrapper };
