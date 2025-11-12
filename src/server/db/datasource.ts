import 'reflect-metadata';
import { DataSource } from 'typeorm';
// Direct imports to avoid ESM/CJS issues
import { VcRegistry } from './entities/VcRegistry';
import { DidDocument } from './entities/DidDocument';
import { CustodyWallet } from './entities/CustodyWallet';

// DataSource configuration for MariaDB
// - Handles DID, VC, and VP related entities
// - Auto-sync schema in development (MVP stage)
// - Uses environment variables for connection settings

export const AppDataSource = new DataSource({
  type: 'mariadb',
  host: process.env.DB_HOST || 'localhost',
  port: parseInt(process.env.DB_PORT || '3306'),
  username: process.env.DB_USER || 'root',
  password: process.env.DB_PASSWORD || '1234',
  database: process.env.DB_NAME || 'anam_core_liberia',
  entities: [VcRegistry, DidDocument, CustodyWallet],
  synchronize: true, // Auto-sync schema in development (MVP)
  logging: process.env.NODE_ENV === 'development',
});

export default AppDataSource;
