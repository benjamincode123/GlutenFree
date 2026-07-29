import type { ProductAllergens } from '../db/types';

/** EU major allergens used for warn-filter preferences (labels match dbo.products JSON). */
export const ALLERGEN_OPTIONS = [
  'Gluten',
  'Skalldyr',
  'Egg',
  'Fisk',
  'Peanøtter',
  'Soya',
  'Melk',
  'Laktose',
  'Nøtter',
  'Selleri',
  'Sennep',
  'Sesamfrø',
  'Svoveldioksid eller sulfitter',
  'Lupiner',
  'Bløtdyr',
] as const;

export type AllergenOption = (typeof ALLERGEN_OPTIONS)[number];

const NUT_VARIANTS = [
  'nøtter',
  'mandler',
  'hasselnøtter',
  'valnøtter',
  'kasjunøtter',
  'pekannøtter',
  'paranøtter',
  'pistasienøtter',
  'macadamianøtter',
];

function normalize(value: string): string {
  return value
    .trim()
    .toLowerCase()
    .normalize('NFD')
    .replace(/\p{M}/gu, '');
}

/** Whether a declared allergen label matches a selected warn preference. */
export function allergenLabelMatches(selected: string, declared: string): boolean {
  const s = normalize(selected);
  const d = normalize(declared);
  if (!s || !d) return false;
  if (s === d || d.includes(s) || s.includes(d)) return true;

  if (s === 'gluten') {
    return (
      d.includes('gluten') ||
      d.includes('hvete') ||
      d.includes('spelt') ||
      d.includes('rug') ||
      d.includes('bygg') ||
      d.includes('khorasan') ||
      d.includes('havre')
    );
  }

  if (s === 'notter' || s === 'nøtter') {
    return NUT_VARIANTS.some((n) => d.includes(normalize(n)));
  }

  if (s.includes('sulfitt') || s.includes('svovel')) {
    return d.includes('sulfitt') || d.includes('svovel');
  }

  if (s === 'sesamfro' || s.includes('sesam')) {
    return d.includes('sesam');
  }

  if (s === 'peanotter' || s.includes('peanot')) {
    return d.includes('peanot');
  }

  if (s === 'blotdyr' || s.includes('blotdyr')) {
    return d.includes('blotdyr') || d.includes('bløtdyr');
  }

  return false;
}

export type AllergenHitKind = 'contains' | 'mayContain';

export interface AllergenWarnHit {
  selected: string;
  declared: string;
  kind: AllergenHitKind;
}

/** Compare user warn prefs against product allergen declaration.
 * One hit per selected allergen + kind (contains wins over may-contain duplicates).
 */
export function findAllergenWarnings(
  selected: readonly string[],
  allergens: ProductAllergens | null | undefined
): AllergenWarnHit[] {
  if (!allergens || selected.length === 0) return [];

  const byPref = new Map<string, AllergenWarnHit>();

  for (const pref of selected) {
    let containsDeclared: string | null = null;
    for (const declared of allergens.inneholder ?? []) {
      if (allergenLabelMatches(pref, declared)) {
        containsDeclared = declared;
        break;
      }
    }
    if (containsDeclared) {
      byPref.set(`c:${pref}`, {
        selected: pref,
        declared: containsDeclared,
        kind: 'contains',
      });
      continue;
    }

    let mayDeclared: string | null = null;
    for (const declared of allergens.kanInneholde ?? []) {
      if (allergenLabelMatches(pref, declared)) {
        mayDeclared = declared;
        break;
      }
    }
    if (mayDeclared) {
      byPref.set(`m:${pref}`, {
        selected: pref,
        declared: mayDeclared,
        kind: 'mayContain',
      });
    }
  }

  // Stable order: follow user's selected allergen order.
  const hits: AllergenWarnHit[] = [];
  for (const pref of selected) {
    const contains = byPref.get(`c:${pref}`);
    if (contains) {
      hits.push(contains);
      continue;
    }
    const may = byPref.get(`m:${pref}`);
    if (may) hits.push(may);
  }
  return hits;
}
