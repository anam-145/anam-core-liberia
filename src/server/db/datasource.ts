import 'reflect-metadata';
import { DataSource } from 'typeorm';
// Direct imports to avoid ESM/CJS issues
import { VcRegistry } from './entities/VcRegistry';
import { DidDocument } from './entities/DidDocument';

// DataSource configuration for MariaDB
// - Handles DID, VC, and VP related entities
// - Configured for production use (synchronize: false)
// - Uses environment variables for connection settings

export const AppDataSource = new DataSource({
  type: 'mariadb',
  host: process.env.DB_HOST || 'localhost',
  port: parseInt(process.env.DB_PORT || '3306'),
  username: process.env.DB_USER || 'root',
  password: process.env.DB_PASSWORD || '1234',
  database: process.env.DB_NAME || 'anam_core_liberia',
  entities: [
    VcRegistry,
    DidDocument,
  ],
  // Skip migrations in development mode to avoid ESM/CJS issues
  migrations: process.env.NODE_ENV === 'production' ? ['dist/server/db/migrations/*.js'] : [],
  migrationsTableName: 'migrations',
  synchronize: process.env.NODE_ENV === 'development', // Only in development
  logging: process.env.NODE_ENV === 'development',
});

export default AppDataSource;
