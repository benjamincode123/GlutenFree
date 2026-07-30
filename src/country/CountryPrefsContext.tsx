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

export type ProductCountry = 'no' | 'se' | 'dk' | 'de';

export const PRODUCT_COUNTRIES: ProductCountry[] = ['no', 'se', 'dk', 'de'];

const STORAGE_KEY = 'altuten_product_countries';
/** Legacy single-country key — migrated on first read. */
const LEGACY_STORAGE_KEY = 'altuten_product_country';
const DEFAULT_COUNTRIES: ProductCountry[] = ['no'];

interface CountryPrefsContextValue {
  /** Selected catalog countries (always at least one). */
  countries: ProductCountry[];
  ready: boolean;
  /** Toggle a country on/off. The last selected country cannot be turned off. */
  toggleCountry: (country: ProductCountry) => void;
  setCountries: (countries: ProductCountry[]) => void;
}

const CountryPrefsContext = createContext<CountryPrefsContextValue | undefined>(
  undefined
);

function isProductCountry(value: unknown): value is ProductCountry {
  return value === 'no' || value === 'se' || value === 'dk' || value === 'de';
}

function sanitizeList(values: unknown): ProductCountry[] {
  const list = Array.isArray(values) ? values : [];
  const next: ProductCountry[] = [];
  const seen = new Set<ProductCountry>();
  for (const code of PRODUCT_COUNTRIES) {
    if (list.includes(code) && !seen.has(code)) {
      seen.add(code);
      next.push(code);
    }
  }
  return next.length > 0 ? next : [...DEFAULT_COUNTRIES];
}

function parseStored(raw: string | null): ProductCountry[] | null {
  if (!raw?.trim()) return null;
  const trimmed = raw.trim();
  try {
    const parsed = JSON.parse(trimmed) as unknown;
    if (Array.isArray(parsed)) {
      return sanitizeList(parsed);
    }
  } catch {
    // not JSON
  }
  if (isProductCountry(trimmed)) {
    return [trimmed];
  }
  const parts = trimmed
    .split(/[,;\s]+/)
    .map((p) => p.trim().toLowerCase())
    .filter(isProductCountry);
  return parts.length > 0 ? sanitizeList(parts) : null;
}

export function CountryPrefsProvider({ children }: { children: ReactNode }) {
  const [countries, setCountriesState] =
    useState<ProductCountry[]>(DEFAULT_COUNTRIES);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const raw = await SecureStore.getItemAsync(STORAGE_KEY);
        let loaded = parseStored(raw);
        if (!loaded) {
          const legacy = await SecureStore.getItemAsync(LEGACY_STORAGE_KEY);
          loaded = parseStored(legacy);
        }
        if (!cancelled && loaded) {
          setCountriesState(loaded);
          await SecureStore.setItemAsync(STORAGE_KEY, JSON.stringify(loaded));
        }
      } catch {
        // Keep default.
      } finally {
        if (!cancelled) setReady(true);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const persist = useCallback((next: ProductCountry[]) => {
    const sanitized = sanitizeList(next);
    setCountriesState(sanitized);
    void SecureStore.setItemAsync(STORAGE_KEY, JSON.stringify(sanitized)).catch(
      () => undefined
    );
  }, []);

  const setCountries = useCallback(
    (next: ProductCountry[]) => {
      persist(next);
    },
    [persist]
  );

  const toggleCountry = useCallback(
    (code: ProductCountry) => {
      setCountriesState((prev) => {
        const has = prev.includes(code);
        let next: ProductCountry[];
        if (has) {
          if (prev.length <= 1) {
            return prev; // keep at least one
          }
          next = prev.filter((c) => c !== code);
        } else {
          next = sanitizeList([...prev, code]);
        }
        void SecureStore.setItemAsync(STORAGE_KEY, JSON.stringify(next)).catch(
          () => undefined
        );
        return next;
      });
    },
    []
  );

  const value = useMemo(
    () => ({ countries, ready, toggleCountry, setCountries }),
    [countries, ready, toggleCountry, setCountries]
  );

  return (
    <CountryPrefsContext.Provider value={value}>
      {children}
    </CountryPrefsContext.Provider>
  );
}

export function useCountryPrefs(): CountryPrefsContextValue {
  const ctx = useContext(CountryPrefsContext);
  if (!ctx) {
    throw new Error('useCountryPrefs must be used within CountryPrefsProvider');
  }
  return ctx;
}
