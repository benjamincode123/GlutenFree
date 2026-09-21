import { config } from '../config';
import { MssqlApiProductRepository } from './MssqlApiProductRepository';
import { ProductRepository } from './ProductRepository';

/**
 * Always uses the production AltUten API (see `src/config.ts`).
 */
const repository: ProductRepository = new MssqlApiProductRepository(
  config.apiBaseUrl
);

export function getProductRepository(): ProductRepository {
  return repository;
}
