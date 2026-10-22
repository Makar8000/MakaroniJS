import { Database } from "bun:sqlite";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import type { Client } from "discord.js";
import scheduler, { RecurrenceRule } from "node-schedule";
import { dataDir, prepare } from "../db/db.ts";
import logger from "../logger.ts";

/**
 * Aion 2 database (characters + reminders).
 */
export const aionDb = new Database(join(dataDir, "aion.db"), { create: true, strict: true });
aionDb.run("PRAGMA foreign_keys = ON");
aionDb.run(readFileSync(join(import.meta.dirname, "aion-schema.sql"), "utf8"));

const TICK = 3 * 3600;
const OFFSET = 3600; // recharges happen at 01:00, 04:00, 07:00... UTC
const PER_TICK = 15;

export interface Character {
  name: string;
  owner_id: string;
  energy: number;
  updated_at: number;
  member: number;
}

export const nowSec = () => Math.floor(Date.now() / 1000);
export const capOf = (member: number) => (member ? 840 : 560);
const tickIndex = (t: number) => Math.floor((t - OFFSET) / TICK);

/** Energy right now, derived from the stored snapshot. */
export function currentEnergy(c: Character, now = nowSec()) {
  const cap = capOf(c.member);
  if (c.energy >= cap) {
    return c.energy;
  }
  return Math.min(cap, c.energy + PER_TICK * (tickIndex(now) - tickIndex(c.updated_at)));
}

/** Unix time (seconds) of the first recharge that would push the snapshot past its cap (may be in the past). */
function overcapAt(c: Character) {
  const room = Math.max(0, capOf(c.member) - c.energy);
  return (tickIndex(c.updated_at) + Math.floor(room / PER_TICK) + 1) * TICK + OFFSET;
}

/** Unix time (seconds) at which the character starts wasting recharges, or null if already overcapped. */
export function overcapTime(c: Character, now = nowSec()) {
  const at = overcapAt(c);
  return at > now ? at : null;
}

export const getCharacter = (name: string): Character | undefined =>
  prepare(aionDb, "SELECT * FROM characters WHERE name = ?").get(name) ?? undefined;

export const getUserCharacters = (ownerId: string): Character[] =>
  prepare(aionDb, "SELECT * FROM characters WHERE owner_id = ? ORDER BY name").all(ownerId);

export const getAllCharacters = (): Character[] => prepare(aionDb, "SELECT * FROM characters ORDER BY name").all();

/** Returns false if the name is already taken. */
export function addCharacter(name: string, ownerId: string, energy: number, member: number) {
  return (
    prepare(
      aionDb,
      "INSERT OR IGNORE INTO characters (name, owner_id, energy, updated_at, member) VALUES (?, ?, ?, ?, ?)",
    ).run(name, ownerId, energy, nowSec(), member).changes > 0
  );
}

export const removeCharacter = (name: string) => prepare(aionDb, "DELETE FROM characters WHERE name = ?").run(name);

/** Re-snapshots a character with a new energy value and/or membership. */
export function updateCharacter(c: Character, energy: number, member = c.member) {
  prepare(aionDb, "UPDATE characters SET energy = ?, updated_at = ?, member = ? WHERE name = ?").run(
    energy,
    nowSec(),
    member,
    c.name,
  );
}

/** Returns false if a reminder with this lead time already exists. */
export const addReminder = (name: string, hours: number) =>
  prepare(aionDb, "INSERT OR IGNORE INTO odyle_reminders (character, hours) VALUES (?, ?)").run(name, hours).changes >
  0;

export const removeReminders = (name: string) =>
  prepare(aionDb, "DELETE FROM odyle_reminders WHERE character = ?").run(name).changes;

/** DMs owners whose characters are within a reminder window of overcapping. Exported for testing. */
export async function checkReminders(client: Client, now = nowSec()) {
  const rows: (Character & { hours: number; last_notified_cap: number | null })[] = prepare(
    aionDb,
    "SELECT c.*, r.hours, r.last_notified_cap FROM odyle_reminders r JOIN characters c ON c.name = r.character",
  ).all();

  for (const row of rows) {
    const cap = overcapAt(row);
    if (now < cap - row.hours * 3600 || row.last_notified_cap === cap) {
      continue;
    }
    // "Before" reminders are pointless once overcapped; "at overcap" (0) only fires for an overcap within the last tick.
    if (row.hours > 0 ? now >= cap : now - cap >= TICK) {
      continue;
    }
    prepare(aionDb, "UPDATE odyle_reminders SET last_notified_cap = ? WHERE character = ? AND hours = ?").run(
      cap,
      row.name,
      row.hours,
    );
    try {
      const user = await client.users.fetch(row.owner_id);
      await user.send(
        row.hours > 0
          ? `**${row.name}** will overcap their Odyle Energy <t:${cap}:R> (<t:${cap}:F>). ` +
              `Currently ${currentEnergy(row, now)}/${capOf(row.member)} - time to spend some!`
          : `**${row.name}** is overcapping their Odyle Energy (${capOf(row.member)}/${capOf(row.member)}). Time to spend some!`,
      );
    } catch (error) {
      logger.error({ err: error }, `Failed to send Odyle reminder DM to ${row.owner_id}`);
    }
  }
}

/** Runs the reminder check at the top of every hour, so 4h/8h windows (not multiples of the 3h recharge) are honored. */
function initJobs(client: Client) {
  const rule = new RecurrenceRule();
  rule.tz = "Etc/UTC";
  rule.minute = 0;
  rule.second = 5;
  scheduler.scheduleJob(rule, () =>
    checkReminders(client).catch((error) => logger.error({ err: error }, "Odyle reminder check failed:")),
  );
}

export default { initJobs };
