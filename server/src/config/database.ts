import pg from 'pg';
import dotenv from 'dotenv';

dotenv.config();

const { Pool } = pg;
const connectionString = process.env.DATABASE_URL;
const useSsl =
  process.env.DB_SSL === 'true' ||
  (!!connectionString && process.env.DB_SSL !== 'false');

export const pool = new Pool({
  connectionString,
  host: connectionString ? undefined : (process.env.DB_HOST || 'localhost'),
  port: connectionString ? undefined : parseInt(process.env.DB_PORT || '5432'),
  database: connectionString ? undefined : (process.env.DB_NAME || 'tacticash'),
  user: connectionString ? undefined : (process.env.DB_USER || 'postgres'),
  password: connectionString ? undefined : process.env.DB_PASSWORD,
  ssl: useSsl ? { rejectUnauthorized: false } : undefined,
  max: 20,
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 2000,
});

pool.on('error', (err) => {
  console.error('Unexpected database error:', err);
  process.exit(-1);
});

export const query = (text: string, params?: any[]) => {
  return pool.query(text, params);
};

export default pool;
