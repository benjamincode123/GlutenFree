import { getDatabase } from '../db/database';
import { isGlutenRating, NewProduct, Product } from '../db/types';
import { ProductRepository } from './ProductRepository';

/** Raw row shape as returned by SQLite (snake_case columns). */
interface ProductRow {
  id: number;
  barcode: string;
  name: string;
  ingredients: string | null;
  gluten_rating: string;
  created_at: string;
  updated_at: string;
}

function mapRow(row: ProductRow): Product {
  if (!isGlutenRating(row.gluten_rating)) {
    throw new Error(`Unexpected gluten_rating value in database: ${row.gluten_rating}`);
  }

  return {
    id: row.id,
    barcode: row.barcode,
    name: row.name,
    ingredients: row.ingredients,
    glutenRating: row.gluten_rating,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
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
    const ingredients = product.ingredients?.trim() || null;

    if (!barcode) {
      throw new Error('Barcode is required.');
    }
    if (!name) {
      throw new Error('Product name is required.');
    }

    await db.runAsync(
      `INSERT INTO products (barcode, name, ingredients, gluten_rating)
       VALUES (?, ?, ?, ?)
       ON CONFLICT(barcode) DO UPDATE SET
         name = excluded.name,
         ingredients = excluded.ingredients,
         gluten_rating = excluded.gluten_rating,
         updated_at = datetime('now');`,
      barcode,
      name,
      ingredients,
      product.glutenRating
    );

    const saved = await this.getByBarcode(barcode);
    if (!saved) {
      throw new Error('Failed to save product.');
    }
    return saved;
  }
}
