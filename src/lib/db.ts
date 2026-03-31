// ⚠️  DEPLOYMENT WARNING:
// better-sqlite3 requires a persistent writable filesystem and native Node.js bindings.
// It works for local development and self-hosted (VPS/Docker) deployments.
// It does NOT work on Vercel (serverless/read-only filesystem).
//
// For Vercel deployment, migrate to:
//   - Turso (serverless SQLite, near drop-in): https://turso.tech
//   - Vercel Postgres:                         https://vercel.com/storage/postgres
//   - Supabase (already used in some Hemkoll projects): https://supabase.com
import Database from 'better-sqlite3';
import path from 'path';
import fs from 'fs';

const DATA_DIR = path.join(process.cwd(), 'data');
const DB_PATH = path.join(DATA_DIR, 'biztalk-calculator.db');

let db: Database.Database | null = null;

export function getDb(): Database.Database {
  if (db) return db;
  
  if (!fs.existsSync(DATA_DIR)) {
    fs.mkdirSync(DATA_DIR, { recursive: true });
  }

  db = new Database(DB_PATH);
  db.pragma('journal_mode = WAL');
  db.pragma('foreign_keys = ON');

  db.exec(`
    CREATE TABLE IF NOT EXISTS clients (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      description TEXT DEFAULT '',
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      created_by TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS estimates (
      id TEXT PRIMARY KEY,
      client_id TEXT NOT NULL REFERENCES clients(id) ON DELETE CASCADE,
      title TEXT NOT NULL,
      region TEXT NOT NULL DEFAULT 'swedencentral',
      currency TEXT NOT NULL DEFAULT 'SEK',
      raw_input TEXT NOT NULL DEFAULT '{}',
      analysis TEXT NOT NULL DEFAULT '{}',
      mappings TEXT NOT NULL DEFAULT '[]',
      cost_result TEXT NOT NULL DEFAULT '{}',
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      created_by TEXT NOT NULL
    );

    CREATE INDEX IF NOT EXISTS idx_estimates_client ON estimates(client_id);
    CREATE INDEX IF NOT EXISTS idx_clients_created_by ON clients(created_by);
  `);

  return db;
}

// Clients CRUD
export function getClients(createdBy: string) {
  const db = getDb();
  return db.prepare(
    'SELECT * FROM clients WHERE created_by = ? ORDER BY created_at DESC'
  ).all(createdBy) as Client[];
}

export function getClient(id: string, createdBy: string) {
  const db = getDb();
  return db.prepare(
    'SELECT * FROM clients WHERE id = ? AND created_by = ?'
  ).get(id, createdBy) as Client | undefined;
}

export function createClient(client: Omit<Client, 'created_at'>) {
  const db = getDb();
  db.prepare(
    'INSERT INTO clients (id, name, description, created_by) VALUES (?, ?, ?, ?)'
  ).run(client.id, client.name, client.description ?? '', client.created_by);
  return getClient(client.id, client.created_by)!;
}

export function deleteClient(id: string, createdBy: string) {
  const db = getDb();
  return db.prepare(
    'DELETE FROM clients WHERE id = ? AND created_by = ?'
  ).run(id, createdBy);
}

// Estimates CRUD
export function getEstimates(clientId: string, createdBy: string) {
  const db = getDb();
  return db.prepare(
    'SELECT id, client_id, title, region, currency, created_at, created_by FROM estimates WHERE client_id = ? AND created_by = ? ORDER BY created_at DESC'
  ).all(clientId, createdBy) as EstimateSummary[];
}

export function getEstimate(id: string, createdBy: string) {
  const db = getDb();
  const row = db.prepare(
    'SELECT * FROM estimates WHERE id = ? AND created_by = ?'
  ).get(id, createdBy) as EstimateRow | undefined;
  if (!row) return undefined;
  return {
    ...row,
    raw_input: JSON.parse(row.raw_input),
    analysis: JSON.parse(row.analysis),
    mappings: JSON.parse(row.mappings),
    cost_result: JSON.parse(row.cost_result),
  } as Estimate;
}

export function createEstimate(estimate: Omit<Estimate, 'created_at'>) {
  const db = getDb();
  db.prepare(
    `INSERT INTO estimates (id, client_id, title, region, currency, raw_input, analysis, mappings, cost_result, created_by)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
  ).run(
    estimate.id,
    estimate.client_id,
    estimate.title,
    estimate.region,
    estimate.currency,
    JSON.stringify(estimate.raw_input),
    JSON.stringify(estimate.analysis),
    JSON.stringify(estimate.mappings),
    JSON.stringify(estimate.cost_result),
    estimate.created_by
  );
  return getEstimate(estimate.id, estimate.created_by)!;
}

export function deleteEstimate(id: string, createdBy: string) {
  const db = getDb();
  return db.prepare(
    'DELETE FROM estimates WHERE id = ? AND created_by = ?'
  ).run(id, createdBy);
}

// Types
export interface Client {
  id: string;
  name: string;
  description: string;
  created_at: string;
  created_by: string;
}

export interface EstimateSummary {
  id: string;
  client_id: string;
  title: string;
  region: string;
  currency: string;
  created_at: string;
  created_by: string;
}

interface EstimateRow extends EstimateSummary {
  raw_input: string;
  analysis: string;
  mappings: string;
  cost_result: string;
}

export interface Estimate extends EstimateSummary {
  raw_input: Record<string, unknown>;
  analysis: Record<string, unknown>;
  mappings: unknown[];
  cost_result: Record<string, unknown>;
}
