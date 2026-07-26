import { getAuthToken } from '../auth/session';
import { isGlutenRating, NewProduct, Product, ProductCatalog } from '../db/types';
import {
  AppError,
  AppErrorCode,
  appErrorFromHttp,
  readApiErrorMessage,
} from '../errors/appError';
import { ProductRepository } from './ProductRepository';
import { MIN_PRODUCT_SEARCH_CHARS } from './searchLimits';

/** Raw JSON shape returned by the .NET API (camelCase). */
interface ProductApiResponse {
  id: number;
  barcode: string;
  name: string;
  ingredients: string | null;
  glutenRating: string;
  createdAt: string;
  updatedAt: string;
  catalog?: string;
  pending?: boolean;
  imageBase64?: string | null;
}

function mapCatalog(value: string | undefined): ProductCatalog | undefined {
  if (value === 'glutenfri' || value === 'gluten') return value;
  return undefined;
}

function mapProduct(data: ProductApiResponse): Product {
  if (!isGlutenRating(data.glutenRating)) {
    throw new AppError('lookup_failed');
  }
  return {
    id: data.id,
    barcode: data.barcode,
    name: data.name,
    ingredients: data.ingredients,
    glutenRating: data.glutenRating,
    createdAt: data.createdAt,
    updatedAt: data.updatedAt,
    catalog: mapCatalog(data.catalog),
    pending: data.pending === true,
    imageBase64: data.imageBase64 ?? null,
  };
}

export class MssqlApiProductRepository implements ProductRepository {
  private readonly baseUrl: string;

  constructor(baseUrl: string) {
    this.baseUrl = baseUrl.replace(/\/+$/, '');
  }

  private productsUrl(path = ''): string {
    return `${this.baseUrl}/api/products${path}`;
  }

  private async request(
    input: string,
    init: RequestInit | undefined,
    fallback: AppErrorCode
  ): Promise<Response> {
    try {
      return await fetch(input, init);
    } catch {
      throw new AppError('network');
    }
  }

  private async throwHttpError(response: Response, fallback: AppErrorCode): Promise<never> {
    const apiError = await readApiErrorMessage(response);
    throw appErrorFromHttp(response.status, apiError, fallback);
  }

  async getByBarcode(barcode: string): Promise<Product | null> {
    const trimmed = barcode.trim();
    if (!trimmed || trimmed.toLowerCase() === 'unknown') {
      return null;
    }
    const response = await this.request(
      this.productsUrl(`/${encodeURIComponent(trimmed)}`),
      undefined,
      'lookup_failed'
    );

    if (response.status === 404) {
      return null;
    }
    if (!response.ok) {
      await this.throwHttpError(response, 'lookup_failed');
    }

    const data = (await response.json()) as ProductApiResponse;
    return mapProduct(data);
  }

  async getById(catalog: ProductCatalog, id: number): Promise<Product | null> {
    const response = await this.request(
      this.productsUrl(`/${encodeURIComponent(catalog)}/${id}`),
      undefined,
      'lookup_failed'
    );
    if (response.status === 404) {
      return null;
    }
    if (!response.ok) {
      await this.throwHttpError(response, 'lookup_failed');
    }
    const data = (await response.json()) as ProductApiResponse;
    return mapProduct(data);
  }

  async searchByName(
    query: string,
    limit = 40,
    options?: { unknownOnly?: boolean }
  ): Promise<Product[]> {
    const q = query.trim();
    if (q.length < MIN_PRODUCT_SEARCH_CHARS) return [];
    const params = new URLSearchParams({
      q,
      limit: String(limit),
    });
    if (options?.unknownOnly) {
      params.set('unknownOnly', 'true');
    }
    const response = await this.request(
      this.productsUrl(`/search?${params.toString()}`),
      undefined,
      'search_failed'
    );
    if (!response.ok) {
      await this.throwHttpError(response, 'search_failed');
    }
    const data = (await response.json()) as ProductApiResponse[];
    return data.map(mapProduct);
  }

  async getAll(): Promise<Product[]> {
    return [];
  }

  async addProduct(product: NewProduct): Promise<Product> {
    const token = getAuthToken();
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      Accept: 'application/json',
    };
    if (token) {
      headers.Authorization = `Bearer ${token}`;
    }

    const response = await this.request(
      this.productsUrl(),
      {
        method: 'POST',
        headers,
        body: JSON.stringify({
          barcode: product.barcode.trim(),
          name: product.name.trim(),
          ingredients: product.ingredients?.trim() || null,
          glutenRating: product.glutenRating,
          imageBase64: product.imageBase64?.trim() || null,
        }),
      },
      'save_failed'
    );

    if (!response.ok) {
      await this.throwHttpError(response, 'save_failed');
    }

    const data = (await response.json()) as ProductApiResponse;
    return mapProduct(data);
  }

  async reportBarcode(
    catalog: ProductCatalog,
    id: number,
    barcode: string,
    imageBase64?: string | null
  ): Promise<Product> {
    const token = getAuthToken();
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      Accept: 'application/json',
    };
    if (token) {
      headers.Authorization = `Bearer ${token}`;
    }

    const response = await this.request(
      this.productsUrl(`/${encodeURIComponent(catalog)}/${id}/report-barcode`),
      {
        method: 'POST',
        headers,
        body: JSON.stringify({
          barcode: barcode.trim(),
          imageBase64: imageBase64?.trim() || null,
        }),
      },
      'report_failed'
    );

    if (!response.ok) {
      await this.throwHttpError(response, 'report_failed');
    }

    const data = (await response.json()) as ProductApiResponse;
    return mapProduct(data);
  }
}
