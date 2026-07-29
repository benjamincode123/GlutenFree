import { ALLERGEN_OPTIONS, allergenLabelMatches } from './allergenPrefs';
import { GlutenRating, ProductAllergens } from '../db/types';

export type AllergenStatus = 'contains' | 'mayContain' | 'free';

export type AllergenStatusMap = Record<string, AllergenStatus>;

/** Default: every known allergen marked free-from. */
export function defaultAllergenStatuses(): AllergenStatusMap {
  return Object.fromEntries(ALLERGEN_OPTIONS.map((a) => [a, 'free' as AllergenStatus]));
}

export function statusesToAllergens(statuses: AllergenStatusMap): ProductAllergens {
  const inneholder: string[] = [];
  const kanInneholde: string[] = [];
  const inneholderIkke: string[] = [];

  for (const allergen of ALLERGEN_OPTIONS) {
    const status = statuses[allergen] ?? 'free';
    if (status === 'contains') inneholder.push(allergen);
    else if (status === 'mayContain') kanInneholde.push(allergen);
    else inneholderIkke.push(allergen);
  }

  return { inneholder, kanInneholde, inneholderIkke, erklaring: null };
}

export function allergensToStatuses(
  allergens: ProductAllergens | null | undefined
): AllergenStatusMap {
  const statuses = defaultAllergenStatuses();
  if (!allergens) return statuses;

  const mark = (labels: string[] | undefined, status: AllergenStatus) => {
    for (const declared of labels ?? []) {
      const match = ALLERGEN_OPTIONS.find(
        (option) => option === declared || allergenLabelMatches(option, declared)
      );
      if (match) statuses[match] = status;
    }
  };

  mark(allergens.inneholderIkke, 'free');
  mark(allergens.kanInneholde, 'mayContain');
  mark(allergens.inneholder, 'contains');
  return statuses;
}

/** Keep glutenRating in sync with the Gluten allergen row. */
export function ratingFromGlutenStatus(status: AllergenStatus): GlutenRating {
  if (status === 'contains') return GlutenRating.GlutenContent;
  if (status === 'mayContain') return GlutenRating.GlutenTrace;
  return GlutenRating.GlutenFree;
}

export function glutenStatusFromRating(rating: GlutenRating): AllergenStatus {
  if (rating === GlutenRating.GlutenContent) return 'contains';
  if (rating === GlutenRating.GlutenTrace) return 'mayContain';
  return 'free';
}
