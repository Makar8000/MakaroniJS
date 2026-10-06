import { join } from "@std/path";
import Database from "better-sqlite3";

/**
 * General-purpose database
 */
export const db = new Database(join(import.meta.dirname!, "../../data/makaroni.db"));
db.exec(Deno.readTextFileSync(join(import.meta.dirname!, "db-schema.sql")));

/**
 * Closes the database. Called on shutdown so SQLite flushes cleanly.
 */
export function close() {
  db.close();
}
