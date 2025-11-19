import 'reflect-metadata';
import { DataSource } from 'typeorm';
// Direct imports to avoid ESM/CJS issues
import { VcRegistry } from './entities/VcRegistry';
import { DidDocument } from './entities/DidDocument';
import { CustodyWallet } from './entities/CustodyWallet';
import { Admin } from './entities/Admin';
import { User } from './entities/User';
import { Event } from './entities/Event';
import { EventStaff } from './entities/EventStaff';
import { EventParticipant } from './entities/EventParticipant';
import { EventCheckin } from './entities/EventCheckin';
import { EventPayment } from './entities/EventPayment';

// DataSource configuration for MariaDB
// - Handles DID/VC/VP, Custody, Admin, User, and Event entities
// - Auto-sync schema in development (MVP stage)
// - Uses environment variables for connection settings

// Resolve TypeORM logging level from env (quieter by default)
function resolveDbLogging(): boolean | ('query' | 'error' | 'schema' | 'warn' | 'info' | 'log' | 'migration')[] {
  const raw = (process.env.DB_LOGGING || '').toLowerCase().trim();
  if (!raw) {
    // default: only warn/error to prevent query noise during development
    return ['error', 'warn'];
  }
  if (['false', '0', 'off', 'none'].includes(raw)) return false;
  if (['true', '1', 'on', 'all'].includes(raw)) return true;
  // comma-separated levels
  const parts = raw
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean) as ('query' | 'error' | 'schema' | 'warn' | 'info' | 'log' | 'migration')[];
  return parts.length ? parts : ['error', 'warn'];
}

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
    CustodyWallet,
    Admin,
    User,
    Event,
    EventStaff,
    EventParticipant,
    EventCheckin,
    EventPayment,
  ],
  synchronize: true, // Auto-sync schema in development (MVP)
  logging: resolveDbLogging(),
});

export default AppDataSource;
