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

export type ProductCountry = 'no' | 'se' | 'dk';

export const PRODUCT_COUNTRIES: ProductCountry[] = ['no', 'se', 'dk'];

const STORAGE_KEY = 'altuten_product_country';
const DEFAULT_COUNTRY: ProductCountry = 'no';

interface CountryPrefsContextValue {
  country: ProductCountry;
  ready: boolean;
  setCountry: (country: ProductCountry) => void;
}

const CountryPrefsContext = createContext<CountryPrefsContextValue | undefined>(
  undefined
);

function sanitize(value: unknown): ProductCountry {
  if (value === 'se' || value === 'dk' || value === 'no') return value;
  return DEFAULT_COUNTRY;
}

export function CountryPrefsProvider({ children }: { children: ReactNode }) {
  const [country, setCountryState] = useState<ProductCountry>(DEFAULT_COUNTRY);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const raw = await SecureStore.getItemAsync(STORAGE_KEY);
        if (!cancelled && raw) {
          setCountryState(sanitize(raw));
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

  const setCountry = useCallback((next: ProductCountry) => {
    const sanitized = sanitize(next);
    setCountryState(sanitized);
    void SecureStore.setItemAsync(STORAGE_KEY, sanitized).catch(() => undefined);
  }, []);

  const value = useMemo(
    () => ({ country, ready, setCountry }),
    [country, ready, setCountry]
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
