/**
 * API timestamps are UTC. Older responses sometimes omit the trailing "Z",
 * which JS then treats as local time (e.g. 2 hours early in Norway summer).
 */
export function parseApiDate(iso: string): Date {
  const raw = (iso ?? '').trim();
  if (!raw) {
    return new Date(NaN);
  }

  // Already has explicit timezone (Z or ±hh:mm / ±hhmm).
  if (/[zZ]$|[+-]\d{2}:?\d{2}$/.test(raw)) {
    return new Date(raw);
  }

  // Naive ISO date-time from the API → treat as UTC.
  if (/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}/.test(raw)) {
    return new Date(`${raw}Z`);
  }

  return new Date(raw);
}

export function formatApiDateTime(
  iso: string,
  locale: string,
  options?: Intl.DateTimeFormatOptions
): string {
  const date = parseApiDate(iso);
  if (Number.isNaN(date.getTime())) {
    return iso;
  }

  return date.toLocaleString(locale === 'nb' ? 'nb-NO' : 'en-GB', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    ...options,
  });
}
