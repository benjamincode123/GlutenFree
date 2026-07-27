import { getDatabase } from '../db/database';
import { isGlutenRating, NewProduct, Product, ProductCatalog } from '../db/types';
import { AppError } from '../errors/appError';
import { ProductRepository } from './ProductRepository';
import { MIN_PRODUCT_SEARCH_CHARS } from './searchLimits';

/** Raw row shape as returned by SQLite (snake_case columns). */
interface ProductRow {
  id: number;
  barcode: string;
  produsent: string | null;
  name: string;
  ingredients: string | null;
  gluten_rating: string;
  created_at: string;
  updated_at: string;
}

function mapRow(row: ProductRow): Product {
  if (!isGlutenRating(row.gluten_rating)) {
    throw new AppError('lookup_failed');
  }

  return {
    id: row.id,
    barcode: row.barcode,
    produsent: row.produsent ?? null,
    name: row.name,
    ingredients: row.ingredients,
    glutenRating: row.gluten_rating,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    catalog: 'glutenfri',
  };
}

export class SqliteProductRepository implements ProductRepository {
  async getByBarcode(barcode: string): Promise<Product | null> {
    const db = getDatabase();
    const row = await db.getFirstAsync<ProductRow>(
      'SELECT * FROM products WHERE barcode = ?;',
      barcode.trim()
    );
    return row ? mapRow(row) : null;
  }

  async getById(_catalog: ProductCatalog, id: number): Promise<Product | null> {
    const db = getDatabase();
    const row = await db.getFirstAsync<ProductRow>(
      'SELECT * FROM products WHERE id = ?;',
      id
    );
    return row ? mapRow(row) : null;
  }

  async searchByName(
    query: string,
    limit = 40,
    options?: { unknownOnly?: boolean }
  ): Promise<Product[]> {
    const q = query.trim();
    if (q.length < MIN_PRODUCT_SEARCH_CHARS) return [];
    const db = getDatabase();
    const rows = options?.unknownOnly
      ? await db.getAllAsync<ProductRow>(
          `SELECT * FROM products
           WHERE name LIKE ? COLLATE NOCASE
             AND lower(barcode) = 'unknown'
           ORDER BY name
           LIMIT ?;`,
          `%${q}%`,
          limit
        )
      : await db.getAllAsync<ProductRow>(
          `SELECT * FROM products
           WHERE name LIKE ? COLLATE NOCASE
           ORDER BY name
           LIMIT ?;`,
          `%${q}%`,
          limit
        );
    return rows.map(mapRow);
  }

  async getAll(): Promise<Product[]> {
    const db = getDatabase();
    const rows = await db.getAllAsync<ProductRow>(
      'SELECT * FROM products ORDER BY datetime(updated_at) DESC, id DESC;'
    );
    return rows.map(mapRow);
  }

  async addProduct(product: NewProduct): Promise<Product> {
    const db = getDatabase();
    const barcode = product.barcode.trim();
    const name = product.name.trim();
    const produsent = product.produsent?.trim() || null;
    const ingredients = product.ingredients?.trim() || null;

    if (!barcode) {
      throw new AppError('validation');
    }
    if (!name) {
      throw new AppError('validation');
    }

    await db.runAsync(
      `INSERT INTO products (barcode, produsent, name, ingredients, gluten_rating)
       VALUES (?, ?, ?, ?, ?)
       ON CONFLICT(barcode) DO UPDATE SET
         produsent = excluded.produsent,
         name = excluded.name,
         ingredients = excluded.ingredients,
         gluten_rating = excluded.gluten_rating,
         updated_at = datetime('now');`,
      barcode,
      produsent,
      name,
      ingredients,
      product.glutenRating
    );

    const saved = await this.getByBarcode(barcode);
    if (!saved) {
      throw new AppError('save_failed');
    }
    return saved;
  }

  async reportBarcode(
    _catalog: ProductCatalog,
    id: number,
    barcode: string,
    _imageBase64?: string | null
  ): Promise<Product> {
    const db = getDatabase();
    const trimmed = barcode.trim();
    if (!trimmed) {
      throw new AppError('validation');
    }

    const existing = await db.getFirstAsync<ProductRow>(
      'SELECT * FROM products WHERE id = ?;',
      id
    );
    if (!existing) {
      throw new AppError('not_found');
    }
    if (existing.barcode.toLowerCase() !== 'unknown') {
      throw new AppError('product_has_barcode');
    }

    const clash = await db.getFirstAsync<{ id: number }>(
      'SELECT id FROM products WHERE barcode = ? AND id <> ?;',
      trimmed,
      id
    );
    if (clash) {
      throw new AppError('barcode_taken');
    }

    await db.runAsync(
      `UPDATE products SET barcode = ?, updated_at = datetime('now') WHERE id = ?;`,
      trimmed,
      id
    );

    const saved = await this.getById('glutenfri', id);
    if (!saved) {
      throw new AppError('report_failed');
    }
    return saved;
  }

  async submitProductImage(
    _catalog: ProductCatalog,
    _id: number,
    _imageBase64: string
  ): Promise<{ pending: boolean; product?: Product }> {
    // Local SQLite mode has no admin image-validation queue.
    return { pending: true };
  }
}
