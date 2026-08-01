import * as SecureStore from 'expo-secure-store';
import {
  createContext,
  ReactNode,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from 'react';

import { ALLERGEN_OPTIONS } from './allergenPrefs';

const STORAGE_KEY = 'gluten_allergen_warn_v2';
const LEGACY_STORAGE_KEY = 'gluten_allergen_warn_v1';

const DEFAULT_SELECTED: string[] = [...ALLERGEN_OPTIONS];

interface AllergenPrefsContextValue {
  /** Allergens the user wants to see / be warned about. Default: all. */
  selected: string[];
  ready: boolean;
  toggle: (allergen: string) => void;
  setSelected: (allergens: string[]) => void;
  isSelected: (allergen: string) => boolean;
}

const AllergenPrefsContext = createContext<AllergenPrefsContextValue | undefined>(
  undefined
);

function sanitize(list: unknown): string[] {
  if (!Array.isArray(list)) return [];
  const allowed = new Set<string>(ALLERGEN_OPTIONS);
  const out: string[] = [];
  for (const item of list) {
    if (typeof item !== 'string') continue;
    const trimmed = item.trim();
    if (!allowed.has(trimmed) || out.includes(trimmed)) continue;
    out.push(trimmed);
  }
  return out;
}

export function AllergenPrefsProvider({ children }: { children: ReactNode }) {
  const [selected, setSelectedState] = useState<string[]>(DEFAULT_SELECTED);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const raw = await SecureStore.getItemAsync(STORAGE_KEY);
        if (!cancelled && raw) {
          setSelectedState(sanitize(JSON.parse(raw)));
          return;
        }

        // Migrate v1: keep a non-empty custom selection; empty/missing → all on.
        const legacy = await SecureStore.getItemAsync(LEGACY_STORAGE_KEY);
        if (!cancelled && legacy) {
          const parsed = sanitize(JSON.parse(legacy));
          const next = parsed.length > 0 ? parsed : DEFAULT_SELECTED;
          setSelectedState(next);
          void SecureStore.setItemAsync(STORAGE_KEY, JSON.stringify(next)).catch(
            () => undefined
          );
          return;
        }

        if (!cancelled) {
          setSelectedState(DEFAULT_SELECTED);
          void SecureStore.setItemAsync(
            STORAGE_KEY,
            JSON.stringify(DEFAULT_SELECTED)
          ).catch(() => undefined);
        }
      } catch {
        if (!cancelled) setSelectedState(DEFAULT_SELECTED);
      } finally {
        if (!cancelled) setReady(true);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const persist = useCallback((next: string[]) => {
    setSelectedState(next);
    void SecureStore.setItemAsync(STORAGE_KEY, JSON.stringify(next)).catch(
      () => undefined
    );
  }, []);

  const setSelected = useCallback(
    (allergens: string[]) => {
      persist(sanitize(allergens));
    },
    [persist]
  );

  const toggle = useCallback((allergen: string) => {
    const trimmed = allergen.trim();
    if (!ALLERGEN_OPTIONS.includes(trimmed as (typeof ALLERGEN_OPTIONS)[number])) {
      return;
    }
    setSelectedState((prev) => {
      const next = prev.includes(trimmed)
        ? prev.filter((a) => a !== trimmed)
        : [...prev, trimmed];
      void SecureStore.setItemAsync(STORAGE_KEY, JSON.stringify(next)).catch(
        () => undefined
      );
      return next;
    });
  }, []);

  const isSelected = useCallback(
    (allergen: string) => selected.includes(allergen),
    [selected]
  );

  const value = useMemo<AllergenPrefsContextValue>(
    () => ({ selected, ready, toggle, setSelected, isSelected }),
    [selected, ready, toggle, setSelected, isSelected]
  );

  if (!ready) {
    return null;
  }

  return (
    <AllergenPrefsContext.Provider value={value}>
      {children}
    </AllergenPrefsContext.Provider>
  );
}

export function useAllergenPrefs(): AllergenPrefsContextValue {
  const ctx = useContext(AllergenPrefsContext);
  if (!ctx) {
    throw new Error('useAllergenPrefs must be used within AllergenPrefsProvider.');
  }
  return ctx;
}
