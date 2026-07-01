import { getAuthToken } from '../auth/session';
import { isGlutenRating, NewProduct, Product } from '../db/types';
import { ProductRepository } from './ProductRepository';

/** Raw JSON shape returned by the .NET API (camelCase). */
interface ProductApiResponse {
  id: number;
  barcode: string;
  name: string;
  ingredients: string | null;
  glutenRating: string;
  createdAt: string;
  updatedAt: string;
}

function mapProduct(data: ProductApiResponse): Product {
  if (!isGlutenRating(data.glutenRating)) {
    throw new Error(`Unexpected gluten rating from API: ${data.glutenRating}`);
  }
  return {
    id: data.id,
    barcode: data.barcode,
    name: data.name,
    ingredients: data.ingredients,
    glutenRating: data.glutenRating,
    createdAt: data.createdAt,
    updatedAt: data.updatedAt,
  };
}

/**
 * ProductRepository backed by the .NET Web API (which stores data in Azure SQL
 * Server). This is the "MSSQL later" implementation referenced in the app
 * architecture; screens use it exactly like the SQLite one.
 */
export class MssqlApiProductRepository implements ProductRepository {
  private readonly baseUrl: string;

  constructor(baseUrl: string) {
    // Strip a trailing slash so URL building is predictable.
    this.baseUrl = baseUrl.replace(/\/+$/, '');
  }

  private productsUrl(path = ''): string {
    return `${this.baseUrl}/api/products${path}`;
  }

  async getByBarcode(barcode: string): Promise<Product | null> {
    const url = this.productsUrl(`/${encodeURIComponent(barcode.trim())}`);
    const response = await fetch(url);

    if (response.status === 404) {
      return null;
    }
    if (!response.ok) {
      throw new Error(await this.describeError(response, 'look up product'));
    }

    const data = (await response.json()) as ProductApiResponse;
    return mapProduct(data);
  }

  async getAll(): Promise<Product[]> {
    const response = await fetch(this.productsUrl());
    if (!response.ok) {
      throw new Error(await this.describeError(response, 'load products'));
    }
    const data = (await response.json()) as ProductApiResponse[];
    return data.map(mapProduct);
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

    const response = await fetch(this.productsUrl(), {
      method: 'POST',
      headers,
      body: JSON.stringify({
        barcode: product.barcode.trim(),
        name: product.name.trim(),
        ingredients: product.ingredients?.trim() || null,
        glutenRating: product.glutenRating,
      }),
    });

    if (!response.ok) {
      throw new Error(await this.describeError(response, 'save product'));
    }

    const data = (await response.json()) as ProductApiResponse;
    return mapProduct(data);
  }

  private async describeError(response: Response, action: string): Promise<string> {
    let detail = '';
    try {
      const body = (await response.json()) as { error?: string };
      if (body?.error) detail = `: ${body.error}`;
    } catch {
      // Ignore non-JSON error bodies.
    }
    return `Failed to ${action} (HTTP ${response.status})${detail}. ` +
      `Check that the API is running and EXPO_PUBLIC_API_URL is reachable.`;
  }
}
