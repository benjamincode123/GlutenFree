import type { ProductCountry } from '../country/productCountries';
import { NewProduct, Product, ProductCatalog } from '../db/types';

/** Paginated product name search result. */
export interface ProductSearchPage {
  items: Product[];
  page: number;
  pageSize: number;
  hasMore: boolean;
  /** Total matches; null when API skipped count (reuse cached value from page 1). */
  totalCount: number | null;
}

export type ProductLookupOptions = {
  /** One or more catalog countries to search (e.g. no + se). */
  countries?: ProductCountry[];
  /** @deprecated Prefer `countries`. */
  country?: ProductCountry;
};

export type ProductSearchOptions = ProductLookupOptions & {
  unknownOnly?: boolean;
  page?: number;
};

/**
 * Abstraction over product storage. Screens depend only on this interface, so
 * the SQLite backend can be replaced with an MSSQL-backed API client later
 * without touching any UI code.
 */
export interface ProductRepository {
  /** Returns the product with the given barcode, or null if not found. */
  getByBarcode(
    barcode: string,
    options?: ProductLookupOptions
  ): Promise<Product | null>;

  /** Returns a product by catalog table + id (needed when barcode is unknown). */
  getById(catalog: ProductCatalog, id: number): Promise<Product | null>;

  /** Search products by name (case-insensitive contains), paginated. */
  searchByName(
    query: string,
    limit?: number,
    options?: ProductSearchOptions
  ): Promise<ProductSearchPage>;

  /** Returns all products, most recently updated first. */
  getAll(): Promise<Product[]>;

  /**
   * Inserts a new product. If a product with the same barcode already exists it
   * is updated instead (upsert), so re-scanning and re-submitting is safe.
   */
  addProduct(product: NewProduct): Promise<Product>;

  /**
   * Report a real barcode for a product that currently has barcode=unknown.
   * Requires an authenticated user on the API backend.
   */
  reportBarcode(
    catalog: ProductCatalog,
    id: number,
    barcode: string,
    imageBase64?: string | null
  ): Promise<Product>;

  /**
   * Report that product catalog info is wrong (requires auth on API).
   */
  reportWrongInfo(
    catalog: ProductCatalog,
    id: number,
    emne: string,
    comment: string
  ): Promise<void>;

  /**
   * Suggest merging this product (source) into another (target). Requires auth.
   */
  suggestMerge(
    catalog: ProductCatalog,
    sourceId: number,
    targetId: number,
    comment?: string
  ): Promise<void>;
}
