import { NewProduct, Product } from '../db/types';

/**
 * Abstraction over product storage. Screens depend only on this interface, so
 * the SQLite backend can be replaced with an MSSQL-backed API client later
 * without touching any UI code.
 */
export interface ProductRepository {
  /** Returns the product with the given barcode, or null if not found. */
  getByBarcode(barcode: string): Promise<Product | null>;

  /** Returns all products, most recently updated first. */
  getAll(): Promise<Product[]>;

  /**
   * Inserts a new product. If a product with the same barcode already exists it
   * is updated instead (upsert), so re-scanning and re-submitting is safe.
   */
  addProduct(product: NewProduct): Promise<Product>;
}
