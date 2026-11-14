// ONE-TIME: adds the bonus/refill columns to aion.db. Run `bun utils/aion/migrate-odyle-bonus.ts` before starting
// the new code (the old code works either way), then delete this file. The season table is created on startup.
import { Database } from "bun:sqlite";
import { join } from "node:path";

const file = join(Bun.env.DATA_DIR ?? join(import.meta.dirname, "../../data"), "aion.db"); // same rule as db.ts
const db = new Database(file, { readwrite: true, strict: true }); // no `create`: a wrong path fails instead
const backup = `${file}.${Date.now()}.bak`;
db.run("VACUUM INTO ?", [backup]);
db.transaction(() => {
  db.run("ALTER TABLE characters ADD COLUMN bonus INTEGER NOT NULL DEFAULT 0 CHECK (bonus BETWEEN 0 AND 2000)");
  db.run("ALTER TABLE characters ADD COLUMN large_refills INTEGER NOT NULL DEFAULT 0 CHECK (large_refills >= 0)");
  db.run("ALTER TABLE characters ADD COLUMN small_refills INTEGER NOT NULL DEFAULT 0 CHECK (small_refills >= 0)");
})();
db.close();
console.log(`Migrated ${file}\nBackup: ${backup}`);
