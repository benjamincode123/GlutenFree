import * as SQLite from 'expo-sqlite';

import { GlutenRating } from './types';

/**
 * Name of the local SQLite database file. expo-sqlite stores it on the device
 * under the app's SQLite directory (e.g. .../SQLite/gluten.db).
 */
export const DATABASE_NAME = 'gluten.db';

let dbInstance: SQLite.SQLiteDatabase | null = null;

/**
 * Returns the shared database handle, opening it on first use. The database is
 * opened synchronously so callers do not have to await a connection everywhere.
 */
export function getDatabase(): SQLite.SQLiteDatabase {
  if (!dbInstance) {
    dbInstance = SQLite.openDatabaseSync(DATABASE_NAME);
  }
  return dbInstance;
}

/**
 * Creates the schema (if needed) and inserts dev seed data on first run.
 * Safe to call multiple times.
 */
export async function initDatabase(): Promise<void> {
  const db = getDatabase();

  await db.execAsync(`
    PRAGMA journal_mode = WAL;
    CREATE TABLE IF NOT EXISTS products (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      barcode TEXT NOT NULL UNIQUE,
      produsent TEXT,
      name TEXT NOT NULL,
      ingredients TEXT,
      gluten_rating TEXT NOT NULL CHECK (gluten_rating IN ('gluten_free', 'gluten_trace', 'gluten_content')),
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      updated_at TEXT NOT NULL DEFAULT (datetime('now'))
    );
  `);

  try {
    await db.execAsync(`ALTER TABLE products ADD COLUMN produsent TEXT;`);
  } catch {
    // Column already exists on upgraded installs.
  }

  await seedIfEmpty();
}

interface SeedProduct {
  barcode: string;
  name: string;
  ingredients: string;
  glutenRating: GlutenRating;
}

const SEED_PRODUCTS: SeedProduct[] = [
  {
    barcode: '5701234567890',
    name: 'Schar Gluten Free Bread',
    ingredients: 'Water, corn starch, sourdough, rice starch, soy flour, salt, yeast.',
    glutenRating: GlutenRating.GlutenFree,
  },
  {
    barcode: '7350045678901',
    name: 'Oatmeal Cookies (Oat Facility)',
    ingredients: 'Oats, sugar, palm oil, raisins. Produced in a facility that also handles wheat.',
    glutenRating: GlutenRating.GlutenTrace,
  },
  {
    barcode: '4009876543210',
    name: 'Classic Wheat Pasta',
    ingredients: 'Durum wheat semolina, water.',
    glutenRating: GlutenRating.GlutenContent,
  },
];

async function seedIfEmpty(): Promise<void> {
  const db = getDatabase();
  const row = await db.getFirstAsync<{ count: number }>(
    'SELECT COUNT(*) AS count FROM products;'
  );

  if (row && row.count > 0) {
    return;
  }

  for (const product of SEED_PRODUCTS) {
    await db.runAsync(
      'INSERT OR IGNORE INTO products (barcode, name, ingredients, gluten_rating) VALUES (?, ?, ?, ?);',
      product.barcode,
      product.name,
      product.ingredients,
      product.glutenRating
    );
  }
}
