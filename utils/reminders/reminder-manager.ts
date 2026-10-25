import { type Channel, type Client, Collection } from "discord.js";
import scheduler from "node-schedule";
import { db, prepare } from "../db/db.ts";
import logger from "../logger.ts";
import type { Reminder } from "../types.ts";

const jobs = new Collection<string, scheduler.Job>();

/** A row of the reminders table. */
interface ReminderRow {
  id: string;
  unix_ts: number;
  author_id: string;
  channel_id: string | null;
  mention: string | null;
  message: string;
}

/**
 * Converts a database row into a Reminder.
 * @param {Object} row
 *  The row from the reminders table.
 * @returns
 *  The reminder.
 */
function toReminder(row: ReminderRow): Reminder {
  return {
    id: row.id,
    unixTs: row.unix_ts,
    authorId: row.author_id,
    channelId: row.channel_id,
    mention: row.mention ?? undefined,
    message: row.message,
  };
}

/**
 * Gets a stored reminder.
 * @param {String} reminderId
 *  The reminder ID to look up.
 * @returns
 *  The reminder, or undefined if it doesn't exist.
 */
function getReminder(reminderId: string): Reminder | undefined {
  const row = prepare(db, "SELECT * FROM reminders WHERE id = ?").get(reminderId) as ReminderRow | null;
  return row ? toReminder(row) : undefined;
}

/**
 * Deletes a stored reminder.
 * @param {String} reminderId
 *  The reminder ID to delete.
 */
function deleteReminder(reminderId: string) {
  prepare(db, "DELETE FROM reminders WHERE id = ?").run(reminderId);
}

/**
 * Schedules a new reminder.
 * @param {Client} client
 *  The discord.js client.
 * @param {Object} reminder
 *  The reminder data.
 * @returns
 *  A reference to the scheduled job.
 */
function scheduleReminder(client: Client, reminder: Reminder) {
  if (!reminder?.id || !client) {
    return null;
  }

  prepare(
    db,
    "INSERT OR REPLACE INTO reminders (id, unix_ts, author_id, channel_id, mention, message) VALUES (?, ?, ?, ?, ?, ?)",
  ).run(
    reminder.id,
    reminder.unixTs,
    reminder.authorId,
    reminder.channelId ?? null,
    reminder.mention ?? null,
    reminder.message,
  );
  return startJob(client, reminder);
}

/**
 * Gets a list of reminders for a user
 * @param {String} userId
 *  The userId to search reminders for.
 * @returns
 *  An array of reminders.
 */
function getReminders(userId: string): Reminder[] {
  const rows: ReminderRow[] = prepare(db, "SELECT * FROM reminders WHERE author_id = ? ORDER BY unix_ts").all(userId);
  return rows.map(toReminder);
}

/**
 * Cancels a scheduled reminder.
 * @param {String} reminderId
 *  The reminder ID to delete.
 * @param {String} userId
 *  The user ID requesting the delete.
 * @returns
 *  True if cancelation was successful. False otherwise.
 */
function cancelReminder(reminderId: string, userId: string) {
  const reminder = getReminder(reminderId);
  if (reminder && jobs.has(reminder.id) && reminder.authorId === userId) {
    jobs.get(reminder.id)!.cancel();
    jobs.delete(reminder.id);
    deleteReminder(reminder.id);
    return true;
  }
  return false;
}

/**
 * Schedule a job for a given reminder
 * @param {Client} client
 *  The discord.js client.
 * @param {Object} reminder
 *  The reminder data.
 * @returns
 *  A reference to the scheduled job.
 */
function startJob(client: Client, reminder: Reminder) {
  try {
    logger.info(`Scheduling job ${reminder.id}`);
    const date = new Date(reminder.unixTs * 1000);
    const job = scheduler.scheduleJob(date, sendReminder.bind(null, client, reminder));
    if (job) {
      jobs.set(reminder.id, job);
    }
    return job;
  } catch (error) {
    logger.error(error);
    return null;
  }
}

/**
 * Sends a reminder once it is scheduled to run.
 * @param {Client} client
 *  The discord.js client.
 * @param {Object} reminder
 *  The reminder data.
 * @returns
 *  True if the reminder was successfully sent. False otherwise.
 */
async function sendReminder(client: Client, reminder: Reminder) {
  try {
    logger.info(`[${client?.user?.id}] Firing Reminder: ${reminder?.id}`);

    const mention = reminder.mention ?? `<@${reminder.authorId}>`;
    const message = `Hey ${mention}, ${reminder.message}`;

    // Post where the reminder was created. If that channel is gone or out of reach, DM the author instead.
    let channel: Channel | null = null;
    if (reminder.channelId) {
      try {
        channel = await client.channels.fetch(reminder.channelId, { force: true, allowUnknownGuild: true });
      } catch (error) {
        logger.warn({ err: error }, `Reminder ${reminder.id}: channel unavailable, sending a DM instead`);
      }
    }
    if (channel?.isSendable()) {
      await channel.send(message);
    } else {
      await client.users.send(reminder.authorId, message);
    }

    jobs.delete(reminder.id);
    deleteReminder(reminder.id);

    return true;
  } catch (error) {
    logger.error(error);
    return false;
  }
}

/**
 * Loads and schedules jobs for all reminders.
 * Ran at startup.
 * @param {Client} client
 *  The discord.js client.
 */
function initJobs(client: Client) {
  const rows: ReminderRow[] = prepare(db, "SELECT * FROM reminders").all();

  const delaySeconds = 5;
  const curTime = Math.floor(Date.now() / 1000) + delaySeconds;
  for (const row of rows) {
    const rem = toReminder(row);
    if (rem.unixTs < curTime) {
      rem.unixTs = curTime;
      logger.warn(`Reminder ${rem.id} is in the past. Firing in ${delaySeconds} seconds`);
    }

    if (!startJob(client, rem)) {
      logger.error(`Failed to schedule reminder ID ${rem.id}`);
    }
  }
}

export default {
  scheduleReminder,
  getReminders,
  cancelReminder,
  initJobs,
};
