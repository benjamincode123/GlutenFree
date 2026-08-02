import { GlutenRating, type ProductAllergens } from '../db/types';

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

export type AllergenHitKind = 'contains' | 'mayContain' | 'free';

export interface AllergenWarnHit {
  selected: string;
  /** Declared label from product when known; for free hits, the preference label. */
  declared: string;
  kind: AllergenHitKind;
}

/** True when the product has any structured allergen declaration to evaluate. */
export function productHasAllergenData(
  allergens: ProductAllergens | null | undefined
): boolean {
  if (!allergens) return false;
  return (
    (allergens.inneholder?.length ?? 0) > 0 ||
    (allergens.kanInneholde?.length ?? 0) > 0 ||
    (allergens.inneholderIkke?.length ?? 0) > 0
  );
}

function glutenKindFromRating(rating: GlutenRating): AllergenHitKind {
  if (rating === GlutenRating.GlutenContent) return 'contains';
  if (rating === GlutenRating.GlutenTrace) return 'mayContain';
  return 'free';
}

/**
 * Compare user allergen prefs against product declaration.
 * One hit per selected allergen: contains > may contain > free (not listed).
 * Unselected allergens (e.g. milk when user only tracks gluten) are ignored.
 * When structured allergens are missing, falls back to glutenRating for Gluten only.
 */
export function findUserAllergenHits(
  selected: readonly string[],
  allergens: ProductAllergens | null | undefined,
  glutenRating?: GlutenRating | null
): AllergenWarnHit[] {
  if (selected.length === 0) return [];

  if (productHasAllergenData(allergens)) {
    const hits: AllergenWarnHit[] = [];

    for (const pref of selected) {
      let containsDeclared: string | null = null;
      for (const declared of allergens!.inneholder ?? []) {
        if (allergenLabelMatches(pref, declared)) {
          containsDeclared = declared;
          break;
        }
      }
      if (containsDeclared) {
        hits.push({
          selected: pref,
          declared: containsDeclared,
          kind: 'contains',
        });
        continue;
      }

      let mayDeclared: string | null = null;
      for (const declared of allergens!.kanInneholde ?? []) {
        if (allergenLabelMatches(pref, declared)) {
          mayDeclared = declared;
          break;
        }
      }
      if (mayDeclared) {
        hits.push({
          selected: pref,
          declared: mayDeclared,
          kind: 'mayContain',
        });
        continue;
      }

      // Not in contains / may-contain → safe for this preference (green).
      let freeDeclared = pref;
      for (const declared of allergens!.inneholderIkke ?? []) {
        if (allergenLabelMatches(pref, declared)) {
          freeDeclared = declared;
          break;
        }
      }
      hits.push({
        selected: pref,
        declared: freeDeclared,
        kind: 'free',
      });
    }

    return hits;
  }

  // No structured allergen rows — only glutenRating can speak about Gluten.
  if (!glutenRating) return [];
  const glutenPref = selected.find((pref) => allergenLabelMatches(pref, 'Gluten'));
  if (!glutenPref) return [];
  return [
    {
      selected: glutenPref,
      declared: 'Gluten',
      kind: glutenKindFromRating(glutenRating),
    },
  ];
}

/** Warning hits only (contains / may contain) for the user's selected allergens. */
export function findAllergenWarnings(
  selected: readonly string[],
  allergens: ProductAllergens | null | undefined,
  glutenRating?: GlutenRating | null
): AllergenWarnHit[] {
  return findUserAllergenHits(selected, allergens, glutenRating).filter(
    (h) => h.kind === 'contains' || h.kind === 'mayContain'
  );
}

/** True when product data exists and none of the user's selected allergens are present or may be present. */
export function isSafeForUserAllergens(
  selected: readonly string[],
  allergens: ProductAllergens | null | undefined,
  glutenRating?: GlutenRating | null
): boolean {
  const hits = findUserAllergenHits(selected, allergens, glutenRating);
  return hits.length > 0 && hits.every((h) => h.kind === 'free');
}
