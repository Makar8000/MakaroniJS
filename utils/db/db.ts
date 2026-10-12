import { Database } from "bun:sqlite";
import { readFileSync } from "node:fs";
import { join } from "node:path";

/**
 * Directory holding the SQLite files.
 */
export const dataDir = Bun.env.DATA_DIR ?? join(import.meta.dirname, "../../data");

/**
 * General-purpose database
 */
export const db = new Database(join(dataDir, "makaroni.db"), { create: true, strict: true });
db.exec(readFileSync(join(import.meta.dirname, "db-schema.sql"), "utf8"));

/**
 * Prepares a statement with loosely typed rows/params (bun:sqlite types rows as `unknown`).
 */
// biome-ignore lint/suspicious/noExplicitAny: rows are untyped SQL results
export const prepare = (database: Database, sql: string) => database.prepare<any, any[]>(sql);

/**
 * Closes the database. Called on shutdown so SQLite flushes cleanly.
 */
export function close() {
  db.close();
}
