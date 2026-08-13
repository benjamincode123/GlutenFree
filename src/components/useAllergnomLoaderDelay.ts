import { useEffect, useState } from 'react';

/** Wait this long before mounting Allergnom so fast responses stay snappy. */
export const ALLERGNOM_LOADER_DELAY_MS = 400;

/**
 * Returns true only after `active` has stayed true for {@link ALLERGNOM_LOADER_DELAY_MS}.
 * Clears immediately when `active` becomes false.
 */
export function useAllergnomLoaderDelay(
  active: boolean,
  delayMs: number = ALLERGNOM_LOADER_DELAY_MS
): boolean {
  const [ready, setReady] = useState(false);

  useEffect(() => {
    if (!active) {
      setReady(false);
      return;
    }
    const handle = setTimeout(() => setReady(true), delayMs);
    return () => clearTimeout(handle);
  }, [active, delayMs]);

  return ready;
}
