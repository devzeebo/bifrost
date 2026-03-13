import { createContext, useContext, useState, useEffect, type ReactNode } from 'react';
import { api } from './api';
import { useAuth } from './auth';
import type { RealmListEntry } from '../types/realm';

const STORAGE_KEY = 'bifrost-realm';
const COOKIE_KEY = 'bifrost_selected_realm';

export type RealmOption = {
  id: string;
  name: string;
};

interface RealmContextValue {
  currentRealm: string | null;
  setCurrentRealm: (realm: string | null) => void;
  availableRealms: string[];
  realmOptions: RealmOption[];
  isLoading: boolean;
}

const RealmContext = createContext<RealmContextValue | undefined>(undefined);

const sanitizeRealms = (realms: Array<string | null | undefined>): string[] => {
  const unique = new Set<string>();

  for (const realm of realms) {
    if (!realm || realm === '_admin') {
      continue;
    }
    unique.add(realm);
  }

  return Array.from(unique);
};

const normalizeRealmOptions = (realms: Array<RealmOption | null | undefined>): RealmOption[] => {
  const byId = new Map<string, RealmOption>();

  for (const realm of realms) {
    if (!realm || !realm.id || realm.id === '_admin') {
      continue;
    }
    byId.set(realm.id, {
      id: realm.id,
      name: realm.name || realm.id,
    });
  }

  return Array.from(byId.values());
};

const readRealmCookie = (): string | null => {
  if (typeof document === 'undefined') {
    return null;
  }

  const cookie = document.cookie
    .split(';')
    .map((entry) => entry.trim())
    .find((entry) => entry.startsWith(`${COOKIE_KEY}=`));

  if (!cookie) {
    return null;
  }

  const value = cookie.split('=').slice(1).join('=');
  if (!value) {
    return null;
  }

  return decodeURIComponent(value);
};

const persistRealm = (realm: string | null) => {
  if (typeof document === 'undefined' || typeof localStorage === 'undefined') {
    return;
  }

  if (realm) {
    localStorage.setItem(STORAGE_KEY, realm);
    document.cookie = `${COOKIE_KEY}=${encodeURIComponent(realm)}; path=/; max-age=31536000; samesite=lax`;
    return;
  }

  localStorage.removeItem(STORAGE_KEY);
  document.cookie = `${COOKIE_KEY}=; path=/; max-age=0; samesite=lax`;
};

export function RealmProvider({ children }: { children: ReactNode }) {
  const [currentRealm, setCurrentRealmState] = useState<string | null>(null);
  const [realmOptions, setRealmOptions] = useState<RealmOption[]>([]);
  const [availableRealms, setAvailableRealms] = useState<string[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const { realms: sessionRealms, realmNames, isAuthenticated, loading: authLoading } = useAuth();

  // Load available realms and restore persisted realm
  useEffect(() => {
    const applyRealmSelection = (rawRealms: Array<RealmOption | null | undefined>) => {
      const options = normalizeRealmOptions(rawRealms);
      const realms = options.map((option) => option.id);
      setRealmOptions(options);
      setAvailableRealms(realms);

      const stored = localStorage.getItem(STORAGE_KEY);
      const cookieRealm = readRealmCookie();
      const preferredRealm = [stored, cookieRealm].find(
        (realm): realm is string => typeof realm === 'string' && realms.includes(realm)
      );

      if (preferredRealm) {
        setCurrentRealmState(preferredRealm);
        persistRealm(preferredRealm);
      } else if (realms.length > 0) {
        setCurrentRealmState(realms[0]);
        persistRealm(realms[0]);
      } else {
        setCurrentRealmState(null);
        persistRealm(null);
      }
    };

    const init = async () => {
      if (authLoading) {
        return;
      }

      if (!isAuthenticated) {
        setRealmOptions([]);
        setAvailableRealms([]);
        setCurrentRealmState(null);
        setIsLoading(false);
        return;
      }

      const sessionRealmIds = sanitizeRealms(sessionRealms);
      const sessionRealmSet = new Set(sessionRealmIds);

      const fallbackRealms = normalizeRealmOptions(
        sessionRealmIds.map((realmId) => ({
          id: realmId,
          name: realmNames[realmId] || realmId,
        }))
      );

      try {
        const realms = await api.getRealms();
        const normalizedRealms = normalizeRealmOptions(
          realms.map((realm) => {
            const value = realm as RealmListEntry & { realm_id?: string };
            const id = value.id || value.realm_id;
            const resolvedId = id ?? '';
            return {
              id: resolvedId,
              name: value.name || realmNames[resolvedId] || resolvedId,
            };
          })
        );

        const filteredRealms =
          sessionRealmSet.size > 0
            ? normalizedRealms.filter((realm) => sessionRealmSet.has(realm.id))
            : normalizedRealms;

        applyRealmSelection(filteredRealms.length > 0 ? filteredRealms : fallbackRealms);
      } catch {
        applyRealmSelection(fallbackRealms);
      } finally {
        setIsLoading(false);
      }
    };

    init();
  }, [authLoading, isAuthenticated, realmNames, sessionRealms]);

  const setCurrentRealm = (realm: string | null) => {
    const nextRealm = realm && availableRealms.includes(realm) ? realm : null;
    setCurrentRealmState(nextRealm);
    persistRealm(nextRealm);
  };

  return (
    <RealmContext.Provider
      value={{ currentRealm, setCurrentRealm, availableRealms, realmOptions, isLoading }}
    >
      {children}
    </RealmContext.Provider>
  );
}

export function useRealm() {
  const context = useContext(RealmContext);
  if (context === undefined) {
    throw new Error('useRealm must be used within a RealmProvider');
  }
  return context;
}
