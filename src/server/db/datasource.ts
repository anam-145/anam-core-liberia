import 'reflect-metadata';
import { DataSource } from 'typeorm';

// TODO: DataSource configuration
// - MariaDB connection setup
// - Configure database entities and migrations
// - HMR-safe singleton pattern

export const AppDataSource = new DataSource({
  type: 'mariadb',
  host: process.env.DB_HOST || 'localhost',
  port: parseInt(process.env.DB_PORT || '3306'),
  username: process.env.DB_USER || 'root',
  password: process.env.DB_PASSWORD || '',
  database: process.env.DB_NAME || 'anam_core',
  entities: [],
  migrations: [],
  synchronize: false,
});

export default AppDataSource;
