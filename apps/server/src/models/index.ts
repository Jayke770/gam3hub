import { drizzle as drizzleBun } from 'drizzle-orm/bun-sql';
import { drizzle as drizzlePg } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';
import * as schema from './schema.js';
import { env } from '../lib/env.js';

function createDb() {
  if (env.NODE_ENV === 'production') {
    const client = postgres(env.DATABASE_URL);
    return drizzlePg(client, { schema });
  } else {
    // Bun's native SQL client for PostgreSQL (Bun 1.1+)
    // Drizzle uses 'drizzle-orm/bun-sql' to connect directly
    return drizzleBun(env.DATABASE_URL, { schema });
  }
}

export const db = createDb();
