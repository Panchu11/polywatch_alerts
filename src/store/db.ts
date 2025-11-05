/**
 * Database Factory
 * Returns FileDb instance (singleton)
 */

import { FileDb } from './filedb';

export type DbInstance = FileDb;

let dbInstance: DbInstance | null = null;

export function getDb(): DbInstance {
  if (dbInstance) {
    return dbInstance;
  }

  console.log('Using file-based database');
  dbInstance = new FileDb();

  return dbInstance;
}

