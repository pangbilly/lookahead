import { neon } from '@neondatabase/serverless';
import { drizzle } from 'drizzle-orm/neon-http';
import * as schema from './schema';

type DbClient = ReturnType<typeof drizzle<typeof schema>>;

let cached: DbClient | null = null;

function getClient(): DbClient {
  if (cached) return cached;
  const url = process.env.DATABASE_URL;
  if (!url) {
    throw new Error('DATABASE_URL is not set. Add it to .env.local or your Vercel environment.');
  }
  const sql = neon(url);
  cached = drizzle(sql, { schema });
  return cached;
}

export const db: DbClient = new Proxy({} as DbClient, {
  get(_target, prop) {
    const client = getClient();
    const value = Reflect.get(client, prop);
    return typeof value === 'function' ? value.bind(client) : value;
  },
});
