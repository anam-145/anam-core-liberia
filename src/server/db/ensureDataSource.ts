import AppDataSource from './datasource';
import type { DataSource } from 'typeorm';

let initializing: Promise<DataSource> | null = null;

export async function ensureDataSource(): Promise<DataSource> {
  if (AppDataSource.isInitialized) return AppDataSource;
  if (!initializing) {
    initializing = AppDataSource.initialize().finally(() => {
      initializing = null;
    });
  }
  return initializing;
}
