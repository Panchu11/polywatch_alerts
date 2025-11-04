/**
 * Database Factory
 * Returns the appropriate database implementation based on config
 */

import { config } from '../config';
import { FileDb } from './filedb';
import { SupabaseDb } from './supabasedb';

export type DbInstance = FileDb | SupabaseDb;

let dbInstance: DbInstance | null = null;

export function getDb(): DbInstance {
  if (dbInstance) {
    return dbInstance;
  }

  if (config.storage.type === 'supabase') {
    console.log('Using Supabase database');
    dbInstance = new SupabaseDb();
  } else {
    console.log('Using file-based database');
    dbInstance = new FileDb();
  }

  return dbInstance;
}

