import { defineConfig } from 'drizzle-kit';
import { env } from './src/lib/env.js';

export default defineConfig({
  schema: './src/models/schema.ts',
  out: './drizzle',
  dialect: 'postgresql',
  dbCredentials: {
    url: env.DATABASE_URL,
  },
});
