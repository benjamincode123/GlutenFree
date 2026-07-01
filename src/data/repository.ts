import { config } from '../config';
import { MssqlApiProductRepository } from './MssqlApiProductRepository';
import { ProductRepository } from './ProductRepository';
import { SqliteProductRepository } from './SqliteProductRepository';

/**
 * Single source of truth for the active product repository.
 *
 * Which backend is used is controlled by `src/config.ts`:
 * - `useBackend: true`  -> MssqlApiProductRepository (calls the .NET API, which
 *   stores data in Azure SQL Server).
 * - `useBackend: false` -> SqliteProductRepository (local on-device .db file).
 *
 * Both implement the same `ProductRepository` interface, so no screen code
 * changes when switching.
 */
const repository: ProductRepository = config.useBackend
  ? new MssqlApiProductRepository(config.apiBaseUrl)
  : new SqliteProductRepository();

export function getProductRepository(): ProductRepository {
  return repository;
}
