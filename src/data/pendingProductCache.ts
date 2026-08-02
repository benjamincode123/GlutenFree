import * as SecureStore from 'expo-secure-store';

import type { Product } from '../db/types';
import { isGlutenRating } from '../db/types';

const STORAGE_KEY = 'pending_products_v1';
/** Keep user-submitted products visible on scan until admin likely approved. */
export const PENDING_PRODUCT_MAX_AGE_MS = 2 * 24 * 60 * 60 * 1000;

type PendingEntry = {
  cachedAt: number;
  product: Product;
};

type PendingStore = Record<string, PendingEntry>;

let memoryStore: PendingStore | null = null;

function normalizeBarcode(barcode: string): string {
  return barcode.trim();
}

function isPersistedImageUrl(url: string | null | undefined): boolean {
  if (!url?.trim()) return false;
  const trimmed = url.trim();
  // Never persist large data-URIs in SecureStore (platform size limits).
  if (trimmed.startsWith('data:')) return false;
  return true;
}

function isValidEntry(value: unknown): value is PendingEntry {
  if (!value || typeof value !== 'object') return false;
  const entry = value as PendingEntry;
  if (typeof entry.cachedAt !== 'number' || !Number.isFinite(entry.cachedAt)) {
    return false;
  }
  const p = entry.product;
  if (!p || typeof p !== 'object') return false;
  if (typeof p.id !== 'number' || typeof p.barcode !== 'string') return false;
  if (typeof p.name !== 'string') return false;
  if (!isGlutenRating(String(p.glutenRating))) return false;
  return true;
}

function pruneStore(store: PendingStore, now = Date.now()): PendingStore {
  const next: PendingStore = {};
  for (const [key, entry] of Object.entries(store)) {
    if (!isValidEntry(entry)) continue;
    if (now - entry.cachedAt > PENDING_PRODUCT_MAX_AGE_MS) continue;
    next[key] = {
      cachedAt: entry.cachedAt,
      product: {
        ...entry.product,
        barcode: normalizeBarcode(entry.product.barcode) || key,
        pending: true,
      },
    };
  }
  return next;
}

async function readStore(): Promise<PendingStore> {
  if (memoryStore) {
    memoryStore = pruneStore(memoryStore);
    return memoryStore;
  }
  try {
    const raw = await SecureStore.getItemAsync(STORAGE_KEY);
    if (!raw) {
      memoryStore = {};
      return memoryStore;
    }
    const parsed = JSON.parse(raw) as unknown;
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
      memoryStore = {};
      return memoryStore;
    }
    memoryStore = pruneStore(parsed as PendingStore);
    return memoryStore;
  } catch {
    memoryStore = {};
    return memoryStore;
  }
}

async function writeStore(store: PendingStore): Promise<void> {
  // Keep full payloads (incl. data-URI images) in memory for this session.
  memoryStore = pruneStore(store);
  const forDisk: PendingStore = {};
  for (const [key, entry] of Object.entries(memoryStore)) {
    forDisk[key] = {
      cachedAt: entry.cachedAt,
      product: {
        ...entry.product,
        imageUrl: isPersistedImageUrl(entry.product.imageUrl)
          ? entry.product.imageUrl
          : null,
      },
    };
  }
  try {
    await SecureStore.setItemAsync(STORAGE_KEY, JSON.stringify(forDisk));
  } catch {
    // Best-effort persistence — in-memory still works for this session.
  }
}

/** Remember a user-submitted product so the next scan can show it for up to 2 days. */
export async function cachePendingProduct(product: Product): Promise<void> {
  const barcode = normalizeBarcode(product.barcode);
  if (!barcode || barcode.toLowerCase() === 'unknown') return;

  const store = await readStore();
  // Prefer keeping the local photo for this session even if it is a data-URI.
  const withBarcode: Product = {
    ...product,
    barcode,
    pending: true,
  };
  store[barcode] = {
    cachedAt: Date.now(),
    product: withBarcode,
  };
  await writeStore(store);
}

/** Return a locally cached pending product if still within the 2-day window. */
export async function getPendingProductByBarcode(
  barcode: string
): Promise<Product | null> {
  const key = normalizeBarcode(barcode);
  if (!key) return null;

  const store = await readStore();
  const entry = store[key];
  if (!entry) return null;

  if (Date.now() - entry.cachedAt > PENDING_PRODUCT_MAX_AGE_MS) {
    delete store[key];
    await writeStore(store);
    return null;
  }

  return {
    ...entry.product,
    barcode: key,
    pending: true,
  };
}

/** Drop a barcode from the cache once it exists in the live catalog. */
export async function clearPendingProduct(barcode: string): Promise<void> {
  const key = normalizeBarcode(barcode);
  if (!key) return;
  const store = await readStore();
  if (!(key in store)) return;
  delete store[key];
  await writeStore(store);
}
