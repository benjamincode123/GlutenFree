export type ProductCountry = 'no' | 'se' | 'dk' | 'de';

/** All catalog countries, stable fallback order NO → SE → DK → DE. */
export const PRODUCT_COUNTRIES: ProductCountry[] = ['no', 'se', 'dk', 'de'];

export function isProductCountry(value: unknown): value is ProductCountry {
  return value === 'no' || value === 'se' || value === 'dk' || value === 'de';
}

/**
 * Order selected countries with an optional preferred country first (GPS).
 * Remaining countries keep the stable PRODUCT_COUNTRIES order.
 */
export function orderProductCountries(
  selected: readonly ProductCountry[],
  preferredFirst?: ProductCountry | null
): ProductCountry[] {
  const set = new Set(selected);
  const next: ProductCountry[] = [];
  if (preferredFirst && set.has(preferredFirst)) {
    next.push(preferredFirst);
  }
  for (const code of PRODUCT_COUNTRIES) {
    if (set.has(code) && code !== preferredFirst) {
      next.push(code);
    }
  }
  return next;
}

/** Toggle a country; always keeps at least one selected. */
export function toggleProductCountry(
  selected: ProductCountry[],
  code: ProductCountry,
  preferredFirst?: ProductCountry | null
): ProductCountry[] {
  const has = selected.includes(code);
  if (has) {
    if (selected.length <= 1) return selected;
    return orderProductCountries(
      selected.filter((c) => c !== code),
      preferredFirst
    );
  }
  return orderProductCountries([...selected, code], preferredFirst);
}
