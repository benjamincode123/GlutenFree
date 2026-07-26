import type { ProductListSummary } from './listsApi';

export type ListsScope = 'mine' | 'shared';

/** Minimum time between network list refreshes (same idea as profile refresh). */
export const LISTS_REFRESH_COOLDOWN_MS = 10_000;

type ScopeBucket = {
  lists: ProductListSummary[];
  fetchedAt: number;
};

const memory: Record<ListsScope, ScopeBucket | null> = {
  mine: null,
  shared: null,
};

function cloneList(list: ProductListSummary): ProductListSummary {
  return {
    ...list,
    sharedUserIds: [...list.sharedUserIds],
    sharedUsernames: [...list.sharedUsernames],
    products: list.products.map((p) => ({ catalog: p.catalog, id: p.id })),
  };
}

function cloneLists(lists: ProductListSummary[]): ProductListSummary[] {
  return lists.map(cloneList);
}

export function getCachedListsSync(scope: ListsScope): ProductListSummary[] | null {
  const bucket = memory[scope];
  return bucket ? cloneLists(bucket.lists) : null;
}

export function saveCachedLists(scope: ListsScope, lists: ProductListSummary[]): void {
  memory[scope] = {
    lists: cloneLists(lists),
    fetchedAt: Date.now(),
  };
}

/** Patch a list in whichever scope buckets already contain it (and mine if owner). */
export function upsertCachedList(list: ProductListSummary): void {
  const cloned = cloneList(list);
  for (const scope of ['mine', 'shared'] as const) {
    const bucket = memory[scope];
    if (!bucket) continue;
    const idx = bucket.lists.findIndex((row) => row.id === cloned.id);
    if (idx >= 0) {
      const next = [...bucket.lists];
      next[idx] = cloned;
      bucket.lists = next;
    } else if (scope === 'mine' && cloned.isOwner) {
      bucket.lists = [cloned, ...bucket.lists];
    }
  }
  if (!memory.mine && cloned.isOwner) {
    memory.mine = { lists: [cloned], fetchedAt: Date.now() };
  }
}

export function removeCachedList(id: number): void {
  for (const scope of ['mine', 'shared'] as const) {
    const bucket = memory[scope];
    if (!bucket) continue;
    bucket.lists = bucket.lists.filter((row) => row.id !== id);
  }
}

export function getListsFetchedAt(scope: ListsScope): number {
  return memory[scope]?.fetchedAt ?? 0;
}

/** Align client cooldown with a server 429 retry-after value. */
export function markListsRefreshLimited(scope: ListsScope, retryAfterSeconds: number): void {
  const waitMs = Math.max(1, retryAfterSeconds) * 1000;
  const fetchedAt = Date.now() - (LISTS_REFRESH_COOLDOWN_MS - waitMs);
  const bucket = memory[scope];
  if (bucket) {
    bucket.fetchedAt = fetchedAt;
  } else {
    memory[scope] = { lists: [], fetchedAt };
  }
}

/** Milliseconds until a refresh is allowed; 0 means refresh is allowed now. */
export function getListsRefreshWaitMs(scope: ListsScope): number {
  const fetchedAt = getListsFetchedAt(scope);
  if (fetchedAt <= 0) return 0;
  const elapsed = Date.now() - fetchedAt;
  if (elapsed >= LISTS_REFRESH_COOLDOWN_MS) return 0;
  return LISTS_REFRESH_COOLDOWN_MS - elapsed;
}

export function clearCachedLists(): void {
  memory.mine = null;
  memory.shared = null;
}
