import pg from 'pg';
import { getConfig } from './config.js';

// Return DATE columns as plain 'YYYY-MM-DD' strings (never JavaScript Date objects). NUMERIC already comes back
// as a string, which is what we want for money.
pg.types.setTypeParser(1082, (value: string) => value);

let pool: pg.Pool | undefined;

export function getPool(): pg.Pool {
  pool ??= new pg.Pool({ connectionString: getConfig().databaseUrl });
  return pool;
}

export function query<R extends pg.QueryResultRow = pg.QueryResultRow>(
  text: string,
  params?: unknown[],
): Promise<pg.QueryResult<R>> {
  return getPool().query<R>(text, params);
}

/** Wait for the database to accept connections (compose may start the API before Postgres is ready). */
export async function connectWithRetry(attempts = 30, delayMs = 1000): Promise<void> {
  let lastError: unknown;
  for (let i = 1; i <= attempts; i++) {
    try {
      await getPool().query('SELECT 1');
      return;
    } catch (err) {
      lastError = err;
      console.log(`Waiting for database (${i}/${attempts})...`);
      await new Promise((r) => setTimeout(r, delayMs));
    }
  }
  throw new Error(`Database not reachable after ${attempts} attempts: ${String(lastError)}`);
}
