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
  logging: process.env.NODE_ENV === 'development',
});

export default AppDataSource;
