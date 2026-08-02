export type ProductCountry = 'no' | 'se' | 'dk' | 'de';

/** All catalog countries, stable order NO → SE → DK → DE. */
export const PRODUCT_COUNTRIES: ProductCountry[] = ['no', 'se', 'dk', 'de'];

export function isProductCountry(value: unknown): value is ProductCountry {
  return value === 'no' || value === 'se' || value === 'dk' || value === 'de';
}

/** Toggle a country; always keeps at least one selected. */
export function toggleProductCountry(
  selected: ProductCountry[],
  code: ProductCountry
): ProductCountry[] {
  const has = selected.includes(code);
  if (has) {
    if (selected.length <= 1) return selected;
    return selected.filter((c) => c !== code);
  }
  const next: ProductCountry[] = [];
  for (const c of PRODUCT_COUNTRIES) {
    if (c === code || selected.includes(c)) next.push(c);
  }
  return next;
}
