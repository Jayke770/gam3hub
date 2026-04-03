import { drizzle as drizzleBun } from 'drizzle-orm/bun-sql';
import { drizzle as drizzlePg } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';
import * as schema from './schema.js';
import { env } from '../lib/env.js';
const client = postgres(env.DATABASE_URL);

export const db = drizzlePg(client, { schema });
