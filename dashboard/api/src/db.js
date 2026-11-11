import fs from 'node:fs';
import { fileURLToPath } from 'node:url';
import dotenv from 'dotenv';
import pg from 'pg';

const { Pool } = pg;

// Carrega sempre dashboard/api/.env, independentemente do diretório de execução.
dotenv.config({
  path: fileURLToPath(new URL('../.env', import.meta.url)),
});

const REQUIRED = ['PGHOST', 'PGPORT', 'PGUSER', 'PGPASSWORD', 'PGDATABASE'];
const missing = REQUIRED.filter((key) => !process.env[key]);

if (missing.length > 0) {
  console.error(
    '\n[api] Variáveis de ambiente ausentes: ' +
      missing.join(', ') +
      '\n[api] Copie dashboard/api/.env.example para dashboard/api/.env e preencha as credenciais.\n'
  );
  process.exit(1);
}

function buildSslConfig() {
  const mode = (process.env.PGSSLMODE || 'require').toLowerCase();
  if (mode === 'disable' || mode === 'false' || mode === 'off') {
    return false;
  }

  if (process.env.PGSSLROOTCERT) {
    return {
      ca: fs.readFileSync(process.env.PGSSLROOTCERT, 'utf8'),
      rejectUnauthorized: true,
    };
  }

  // Equivalente a sslmode=require, usado pelo ETL na Aiven.
  return { rejectUnauthorized: false };
}

export const pool = new Pool({
  host: process.env.PGHOST,
  port: Number(process.env.PGPORT),
  user: process.env.PGUSER,
  password: process.env.PGPASSWORD,
  database: process.env.PGDATABASE,
  ssl: buildSslConfig(),
  max: 5,
  idleTimeoutMillis: 30_000,
  connectionTimeoutMillis: 15_000,
  application_name: 'turnover-dashboard-api',
});

pool.on('error', (error) => {
  // Nunca logar a string de conexão ou a senha.
  console.error('[db] Erro inesperado no pool:', error.message);
});

/** Executa uma query parametrizada (somente leitura). */
export async function query(text, params = []) {
  const result = await pool.query(text, params);
  return result.rows;
}

export async function testConnection() {
  await pool.query('SELECT 1');
  return true;
}

/** Converte NUMERIC/BIGINT (string no driver pg) em number. */
export function toNumber(value, decimals = null) {
  if (value === null || value === undefined) return null;
  const number = typeof value === 'number' ? value : Number(value);
  if (!Number.isFinite(number)) return null;
  if (decimals === null) return number;
  const factor = 10 ** decimals;
  return Math.round((number + Number.EPSILON) * factor) / factor;
}

export function toInt(value) {
  const number = toNumber(value);
  return number === null ? 0 : Math.trunc(number);
}

export async function closePool() {
  await pool.end();
}
