import { config } from '../config';
import {
  AppError,
  appErrorFromHttp,
  readApiErrorBody,
} from '../errors/appError';
import type { FavoriteProductRef } from './authApi';

export interface ProductListSummary {
  id: number;
  name: string;
  ownerId: number;
  ownerUsername: string;
  isOwner: boolean;
  createdAt: string;
  sharedUserIds: number[];
  sharedUsernames: string[];
  products: FavoriteProductRef[];
}

function listsUrl(path = ''): string {
  return `${config.apiBaseUrl.replace(/\/+$/, '')}/api/lists${path}`;
}

async function throwForListsResponse(response: Response): Promise<never> {
  const body = await readApiErrorBody(response);
  throw appErrorFromHttp(response.status, body.error, 'unauthorized', body.retryAfterSeconds);
}

function authHeaders(token: string, json = false): HeadersInit {
  const headers: Record<string, string> = {
    Authorization: `Bearer ${token}`,
    Accept: 'application/json',
  };
  if (json) headers['Content-Type'] = 'application/json';
  return headers;
}

function normalizeList(raw: ProductListSummary): ProductListSummary {
  return {
    ...raw,
    sharedUserIds: Array.isArray(raw.sharedUserIds) ? raw.sharedUserIds : [],
    sharedUsernames: Array.isArray(raw.sharedUsernames) ? raw.sharedUsernames : [],
    products: Array.isArray(raw.products) ? raw.products : [],
  };
}

export async function fetchLists(
  token: string,
  scope: 'mine' | 'shared' = 'mine'
): Promise<ProductListSummary[]> {
  let response: Response;
  try {
    response = await fetch(listsUrl(`?scope=${encodeURIComponent(scope)}`), {
      headers: authHeaders(token),
    });
  } catch {
    throw new AppError('network');
  }
  if (!response.ok) {
    await throwForListsResponse(response);
  }
  const rows = (await response.json()) as ProductListSummary[];
  return Array.isArray(rows) ? rows.map(normalizeList) : [];
}

export async function fetchList(token: string, id: number): Promise<ProductListSummary> {
  let response: Response;
  try {
    response = await fetch(listsUrl(`/${id}`), { headers: authHeaders(token) });
  } catch {
    throw new AppError('network');
  }
  if (!response.ok) {
    await throwForListsResponse(response);
  }
  return normalizeList(await response.json());
}

export async function createList(token: string, name: string): Promise<ProductListSummary> {
  let response: Response;
  try {
    response = await fetch(listsUrl('/'), {
      method: 'POST',
      headers: authHeaders(token, true),
      body: JSON.stringify({ name }),
    });
  } catch {
    throw new AppError('network');
  }
  if (!response.ok) {
    await throwForListsResponse(response);
  }
  return normalizeList(await response.json());
}

export async function deleteList(token: string, id: number): Promise<void> {
  let response: Response;
  try {
    response = await fetch(listsUrl(`/${id}`), {
      method: 'DELETE',
      headers: authHeaders(token),
    });
  } catch {
    throw new AppError('network');
  }
  if (!response.ok) {
    await throwForListsResponse(response);
  }
}

export async function addProductToList(
  token: string,
  listId: number,
  product: FavoriteProductRef
): Promise<ProductListSummary> {
  let response: Response;
  try {
    response = await fetch(listsUrl(`/${listId}/products`), {
      method: 'POST',
      headers: authHeaders(token, true),
      body: JSON.stringify(product),
    });
  } catch {
    throw new AppError('network');
  }
  if (!response.ok) {
    await throwForListsResponse(response);
  }
  return normalizeList(await response.json());
}

export async function removeProductFromList(
  token: string,
  listId: number,
  product: FavoriteProductRef
): Promise<ProductListSummary> {
  let response: Response;
  try {
    const qs = `?catalog=${encodeURIComponent(product.catalog)}&id=${product.id}`;
    response = await fetch(listsUrl(`/${listId}/products${qs}`), {
      method: 'DELETE',
      headers: authHeaders(token),
    });
  } catch {
    throw new AppError('network');
  }
  if (!response.ok) {
    await throwForListsResponse(response);
  }
  return normalizeList(await response.json());
}

export async function shareList(
  token: string,
  listId: number,
  username: string
): Promise<ProductListSummary> {
  let response: Response;
  try {
    response = await fetch(listsUrl(`/${listId}/share`), {
      method: 'POST',
      headers: authHeaders(token, true),
      body: JSON.stringify({ username }),
    });
  } catch {
    throw new AppError('network');
  }
  if (!response.ok) {
    await throwForListsResponse(response);
  }
  return normalizeList(await response.json());
}

export async function unshareList(
  token: string,
  listId: number,
  username: string
): Promise<ProductListSummary> {
  let response: Response;
  try {
    response = await fetch(
      listsUrl(`/${listId}/share?username=${encodeURIComponent(username)}`),
      {
        method: 'DELETE',
        headers: authHeaders(token),
      }
    );
  } catch {
    throw new AppError('network');
  }
  if (!response.ok) {
    await throwForListsResponse(response);
  }
  return normalizeList(await response.json());
}
