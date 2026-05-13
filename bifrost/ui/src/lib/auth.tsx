import { type ReactNode, createContext, useCallback, useContext, useEffect, useState } from "react";
import { api } from "./api";
import type { LoginRequest, SessionInfo } from "../types/session";

type AuthContextValue = {
  isAuthenticated: boolean;
  accountId: string | null;
  username: string | null;
  roles: Record<string, string>;
  realms: string[];
  realmNames: Record<string, string>;
  isSysadmin: boolean;
  login: (pat: string, rememberMe?: boolean) => Promise<void>;
  logout: () => Promise<void>;
  loading: boolean;
};

export const AuthContext = createContext<AuthContextValue | null>(null);

type AuthProviderProps = {
  children: ReactNode;
};

export const AuthProvider = ({ children }: AuthProviderProps) => {
  const [session, setSession] = useState<SessionInfo | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Check for existing session on mount
    api
      .getSession()
      .then((sessionData) => {
        setSession(sessionData);
      })
      .catch(() => {
        setSession(null);
      })
      .finally(() => {
        setLoading(false);
      });
  }, []);

  const login = useCallback(async (pat: string, rememberMe = false) => {
    const request: LoginRequest = { pat, remember_me: rememberMe };
    const sessionInfo = await api.login(request);
    setSession(sessionInfo);
  }, []);

  const logout = useCallback(async () => {
    await api.logout();
    setSession(null);
  }, []);

  const value: AuthContextValue = {
    isAuthenticated: session !== null,
    accountId: session?.account_id ?? null,
    username: session?.username ?? null,
    roles: session?.roles ?? {},
    realms: session?.realms ?? [],
    realmNames: session?.realm_names ?? {},
    isSysadmin: session?.is_sysadmin ?? false,
    login,
    logout,
    loading,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};

export const useAuth = (): AuthContextValue => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return context;
};
