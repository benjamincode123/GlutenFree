import { Product } from '../db/types';
import {
  ALLERGEN_OPTIONS,
  allergenLabelMatches,
  resolveAllergenOption,
  type AllergenOption,
} from '../allergens/allergenPrefs';

/** Hide products that contain the allergen, or keep only an exact set. */
export type AllergenFilterMode = 'without' | 'only';

export type ProductSearchFilters = {
  produsent: string;
  allergens: Partial<Record<AllergenOption, AllergenFilterMode>>;
};

export const EMPTY_PRODUCT_SEARCH_FILTERS: ProductSearchFilters = {
  produsent: '',
  allergens: {},
};

export function activeProductFilterCount(filters: ProductSearchFilters): number {
  const producer = filters.produsent.trim() ? 1 : 0;
  return producer + Object.keys(filters.allergens).length;
}

function fold(value: string): string {
  return value
    .trim()
    .toLowerCase()
    .normalize('NFD')
    .replace(/\p{M}/gu, '');
}

function labelHits(labels: string[], option: AllergenOption): boolean {
  return labels.some((label) => allergenLabelMatches(option, label));
}

/**
 * "Only with" means the product's declared contains-list is exactly the
 * selected allergens (for example only milk, not milk plus egg).
 * "Without" hides a product if that allergen is declared as contains or traces.
 */
export function productMatchesSearchFilters(
  product: Product,
  filters: ProductSearchFilters
): boolean {
  const producerQuery = fold(filters.produsent);
  if (producerQuery) {
    const producer = fold(product.produsent ?? '');
    if (!producer.includes(producerQuery)) return false;
  }

  const contains = product.allergens?.inneholder ?? [];
  const traces = product.allergens?.kanInneholde ?? [];
  const only = new Set<AllergenOption>();

  for (const option of ALLERGEN_OPTIONS) {
    const mode = filters.allergens[option];
    if (!mode) continue;
    if (mode === 'without') {
      if (labelHits(contains, option) || labelHits(traces, option)) return false;
    } else {
      only.add(option);
    }
  }

  if (only.size === 0) return true;

  const declared = new Set<AllergenOption>();
  for (const label of contains) {
    const resolved = resolveAllergenOption(label);
    if (!resolved) {
      if (label.trim()) return false;
      continue;
    }
    declared.add(resolved);
  }

  if (declared.size !== only.size) return false;
  for (const option of only) {
    if (!declared.has(option)) return false;
  }
  return true;
}
