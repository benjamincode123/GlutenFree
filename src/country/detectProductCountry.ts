import * as Location from 'expo-location';

import {
  isProductCountry,
  orderProductCountries,
  PRODUCT_COUNTRIES,
  type ProductCountry,
} from './productCountries';

/** ISO 3166-1 alpha-2 → catalog country. */
const ISO_TO_PRODUCT_COUNTRY: Record<string, ProductCountry> = {
  NO: 'no',
  SJ: 'no', // Svalbard
  SE: 'se',
  DK: 'dk',
  FO: 'dk', // Faroe Islands — closest catalog
  GL: 'dk', // Greenland
  DE: 'de',
};

let cachedGpsCountry: ProductCountry | null | undefined;
let inflight: Promise<ProductCountry | null> | null = null;

function mapIsoCountryCode(iso: string | null | undefined): ProductCountry | null {
  if (!iso?.trim()) return null;
  const key = iso.trim().toUpperCase();
  const mapped = ISO_TO_PRODUCT_COUNTRY[key];
  return mapped && isProductCountry(mapped) ? mapped : null;
}

/**
 * Best-effort GPS → catalog country. Cached for the app session.
 * Returns null when permission is denied, location fails, or the country
 * is outside NO/SE/DK/DE.
 */
export async function detectGpsProductCountry(): Promise<ProductCountry | null> {
  if (cachedGpsCountry !== undefined) {
    return cachedGpsCountry;
  }
  if (inflight) {
    return inflight;
  }

  inflight = (async () => {
    try {
      const current = await Location.getForegroundPermissionsAsync();
      let status = current.status;
      if (status !== Location.PermissionStatus.GRANTED) {
        const asked = await Location.requestForegroundPermissionsAsync();
        status = asked.status;
      }
      if (status !== Location.PermissionStatus.GRANTED) {
        cachedGpsCountry = null;
        return null;
      }

      const position = await Location.getCurrentPositionAsync({
        accuracy: Location.Accuracy.Balanced,
      });
      const places = await Location.reverseGeocodeAsync({
        latitude: position.coords.latitude,
        longitude: position.coords.longitude,
      });
      const iso =
        places.find((p) => p.isoCountryCode)?.isoCountryCode ??
        places[0]?.isoCountryCode ??
        null;
      cachedGpsCountry = mapIsoCountryCode(iso);
      return cachedGpsCountry;
    } catch {
      cachedGpsCountry = null;
      return null;
    } finally {
      inflight = null;
    }
  })();

  return inflight;
}

/** Selected (or all) catalog countries with GPS country first when known. */
export async function getPreferredProductCountries(
  selected?: readonly ProductCountry[]
): Promise<ProductCountry[]> {
  const gps = await detectGpsProductCountry();
  const base = selected && selected.length > 0 ? selected : PRODUCT_COUNTRIES;
  return orderProductCountries(base, gps);
}
