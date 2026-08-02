import { getAuthToken } from '../auth/session';
import {
  PRODUCT_COUNTRIES,
  type ProductCountry,
} from '../country/productCountries';
import { isGlutenRating, NewProduct, Product, ProductCatalog } from '../db/types';
import {
  AppError,
  AppErrorCode,
  appErrorFromHttp,
  readApiErrorMessage,
} from '../errors/appError';
import {
  ProductLookupOptions,
  ProductRepository,
  ProductSearchOptions,
  ProductSearchPage,
} from './ProductRepository';
import { MIN_PRODUCT_SEARCH_CHARS } from './searchLimits';

function resolveCountries(options?: ProductLookupOptions): ProductCountry[] {
  if (options?.countries && options.countries.length > 0) {
    return options.countries;
  }
  if (options?.country) {
    return [options.country];
  }
  // Default: search every catalog country (scanner / barcode / unfiltered).
  return [...PRODUCT_COUNTRIES];
}

/** Raw JSON shape returned by the .NET API (camelCase). */
interface ProductApiResponse {
  id: number;
  barcode: string;
  name: string;
  produsent?: string | null;
  productionCountry?: string | null;
  ingredients: string | null;
  glutenRating: string;
  createdAt: string;
  updatedAt: string;
  catalog?: string;
  pending?: boolean;
  imageUrl?: string | null;
  allergens?: {
    inneholder?: string[] | null;
    kanInneholde?: string[] | null;
    inneholderIkke?: string[] | null;
  } | null;
}

function mapCatalog(value: string | undefined): ProductCatalog | undefined {
  if (
    value === 'products' ||
    value === 'products_se' ||
    value === 'products_dk' ||
    value === 'products_de'
  ) {
    return value;
  }
  return undefined;
}

function mapAllergens(
  raw: ProductApiResponse['allergens']
): Product['allergens'] {
  if (!raw) return null;
  return {
    inneholder: Array.isArray(raw.inneholder) ? raw.inneholder.filter(Boolean) : [],
    kanInneholde: Array.isArray(raw.kanInneholde)
      ? raw.kanInneholde.filter(Boolean)
      : [],
    inneholderIkke: Array.isArray(raw.inneholderIkke)
      ? raw.inneholderIkke.filter(Boolean)
      : [],
  };
}

function mapProduct(data: ProductApiResponse): Product {
  if (!isGlutenRating(data.glutenRating)) {
    throw new AppError('lookup_failed');
  }
  return {
    id: data.id,
    barcode: data.barcode,
    name: data.name,
    produsent: data.produsent ?? null,
    productionCountry: data.productionCountry ?? null,
    ingredients: data.ingredients,
    glutenRating: data.glutenRating,
    createdAt: data.createdAt,
    updatedAt: data.updatedAt,
    catalog: mapCatalog(data.catalog),
    pending: data.pending === true,
    imageUrl: data.imageUrl ?? null,
    allergens: mapAllergens(data.allergens),
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

  /** Paying members only — every catalog call needs a session token. */
  private requireAuthHeaders(
    extra?: Record<string, string>
  ): Record<string, string> {
    const token = getAuthToken();
    if (!token?.trim()) {
      throw new AppError('unauthorized');
    }
    return {
      Accept: 'application/json',
      Authorization: `Bearer ${token}`,
      ...extra,
    };
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

  async getByBarcode(
    barcode: string,
    options?: ProductLookupOptions
  ): Promise<Product | null> {
    const trimmed = barcode.trim();
    if (!trimmed || trimmed.toLowerCase() === 'unknown') {
      return null;
    }
    const countries = resolveCountries(options);
    const params = new URLSearchParams();
    params.set('countries', countries.join(','));
    const response = await this.request(
      this.productsUrl(
        `/${encodeURIComponent(trimmed)}?${params.toString()}`
      ),
      { headers: this.requireAuthHeaders() },
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
      { headers: this.requireAuthHeaders() },
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
    options?: ProductSearchOptions
  ): Promise<ProductSearchPage> {
    const q = query.trim();
    const page = Math.max(1, options?.page ?? 1);
    const pageSize = Math.max(1, limit);
    if (q.length < MIN_PRODUCT_SEARCH_CHARS) {
      return { items: [], page, pageSize, hasMore: false, totalCount: 0 };
    }
    const countries = resolveCountries(options);
    const params = new URLSearchParams({
      q,
      limit: String(pageSize),
      page: String(page),
      countries: countries.join(','),
    });
    if (options?.unknownOnly) {
      params.set('unknownOnly', 'true');
    }
    const response = await this.request(
      this.productsUrl(`/search?${params.toString()}`),
      { headers: this.requireAuthHeaders() },
      'search_failed'
    );
    if (!response.ok) {
      await this.throwHttpError(response, 'search_failed');
    }
    const data = (await response.json()) as
      | ProductApiResponse[]
      | {
          items?: ProductApiResponse[];
          page?: number;
          pageSize?: number;
          hasMore?: boolean;
          totalCount?: number | null;
        };

    // Support both legacy array responses and paginated objects.
    if (Array.isArray(data)) {
      return {
        items: data.map(mapProduct),
        page,
        pageSize,
        hasMore: data.length >= pageSize,
        totalCount: null,
      };
    }

    const items = Array.isArray(data.items) ? data.items.map(mapProduct) : [];
    return {
      items,
      page: data.page ?? page,
      pageSize: data.pageSize ?? pageSize,
      hasMore: data.hasMore === true,
      totalCount:
        typeof data.totalCount === 'number' && data.totalCount >= 0
          ? data.totalCount
          : null,
    };
  }

  async getAll(): Promise<Product[]> {
    return [];
  }

  async addProduct(product: NewProduct): Promise<Product> {
    const headers = this.requireAuthHeaders({
      'Content-Type': 'application/json',
    });

    const response = await this.request(
      this.productsUrl(),
      {
        method: 'POST',
        headers,
        body: JSON.stringify({
          barcode: product.barcode.trim(),
          name: product.name.trim(),
          produsent: product.produsent?.trim() || null,
          ingredients: product.ingredients?.trim() || null,
          glutenRating: product.glutenRating,
          imageBase64: product.imageBase64?.trim() || null,
          id: product.id ?? null,
          catalog: product.catalog ?? null,
          allergens: product.allergens
            ? {
                inneholder: product.allergens.inneholder ?? [],
                kanInneholde: product.allergens.kanInneholde ?? [],
                inneholderIkke: product.allergens.inneholderIkke ?? [],
              }
            : null,
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
    const headers = this.requireAuthHeaders({
      'Content-Type': 'application/json',
    });

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

  async submitProductImage(
    catalog: ProductCatalog,
    id: number,
    imageBase64: string
  ): Promise<{ pending: boolean; product?: Product }> {
    const headers = this.requireAuthHeaders({
      'Content-Type': 'application/json',
    });

    const response = await this.request(
      this.productsUrl(
        `/${encodeURIComponent(catalog)}/${id}/image-validations`
      ),
      {
        method: 'POST',
        headers,
        body: JSON.stringify({
          imageBase64: imageBase64.trim(),
        }),
      },
      'save_failed'
    );

    if (!response.ok) {
      await this.throwHttpError(response, 'save_failed');
    }

    const data = (await response.json()) as ProductApiResponse & {
      pending?: boolean;
    };
    if (data.pending) {
      return { pending: true };
    }
    return { pending: false, product: mapProduct(data) };
  }

  async reportWrongInfo(
    catalog: ProductCatalog,
    id: number,
    emne: string,
    comment: string
  ): Promise<void> {
    const token = getAuthToken();
    if (!token) {
      throw new AppError('unauthorized');
    }

    const response = await this.request(
      this.productsUrl(
        `/${encodeURIComponent(catalog)}/${id}/wrong-info-reports`
      ),
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Accept: 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          emne: emne.trim(),
          comment: comment.trim(),
        }),
      },
      'report_failed'
    );

    if (!response.ok) {
      await this.throwHttpError(response, 'report_failed');
    }
  }

  async suggestMerge(
    catalog: ProductCatalog,
    sourceId: number,
    targetId: number,
    comment?: string
  ): Promise<void> {
    const token = getAuthToken();
    if (!token) {
      throw new AppError('unauthorized');
    }

    const response = await this.request(
      this.productsUrl(
        `/${encodeURIComponent(catalog)}/${sourceId}/merge-suggestions`
      ),
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Accept: 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          targetProductId: targetId,
          comment: comment?.trim() || null,
        }),
      },
      'report_failed'
    );

    if (!response.ok) {
      await this.throwHttpError(response, 'report_failed');
    }
  }
}
