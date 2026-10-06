import { join } from "@std/path";
import scheduler from "node-schedule";
import moment, { type DurationInputArg1, type DurationInputArg2 } from "moment";
import { Semaphore } from "@std/async/unstable-semaphore";
import Keyv from "keyv";
import { KeyvFile } from "keyv-file";
import { type Client, Collection } from "discord.js";
import logger from "../logger.ts";
import type { Reminder } from "../types.ts";
const jobs = new Collection<string, scheduler.Job>();

const keysMutex = new Semaphore(1);
const reminders = new Keyv({
  namespace: "reminders",
  store: new KeyvFile({
    filename: join(import.meta.dirname!, "../../data/reminders.json"),
  }),
});

/**
 * Atomically updates the "keys" index of stored reminders.
 * All reads and writes of the index must go through here so concurrent updates can't overwrite each other.
 * @param {Function} update
 *  Callback which mutates the index in place.
 */
async function updateKeys(update: (keys: Record<string, boolean>) => void) {
  using _permit = await keysMutex.acquire();
  const keys: Record<string, boolean> = (await reminders.get("keys")) ?? {};
  update(keys);
  await reminders.set("keys", keys);
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
async function scheduleReminder(client: Client, reminder: Reminder) {
  if (!reminder?.id || !client) {
    return null;
  }

  await reminders.set(reminder.id, reminder);
  await updateKeys((keys) => {
    keys[reminder.id] = true;
  });
  return startJob(client, reminder);
}

/**
 * Gets a list of reminders for a user
 * @param {String} userId
 *  The userId to search reminders for.
 * @returns
 *  An array of reminders.
 */
async function getReminders(userId: string) {
  const ret: Reminder[] = [];
  const keys = await reminders.get("keys");
  if (keys && typeof keys === "object") {
    for (const key of Object.keys(keys)) {
      const rem = await reminders.get(key);
      if (rem.authorId === userId) {
        ret.push(rem);
      }
    }
  }
  return ret;
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
async function cancelReminder(reminderId: string, userId: string) {
  const reminder = await reminders.get(reminderId);
  if (reminder && jobs.has(reminder.id) && reminder.authorId === userId) {
    jobs.get(reminder.id)!.cancel();
    await updateKeys((keys) => {
      delete keys[reminder.id];
    });
    await reminders.delete(reminder.id);
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
    const date = moment.unix(reminder.unixTs).toDate();
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

    const channelId = (client as unknown as { channelId?: string }).channelId;
    if (channelId) {
      const channel = await client.channels.fetch(channelId, { force: true, allowUnknownGuild: true });
      if (channel?.isSendable()) {
        await channel.send(message);
      }
    } else {
      await client.users.send(reminder.authorId, message);
    }

    await updateKeys((keys) => {
      delete keys[reminder.id];
    });
    await reminders.delete(reminder.id);

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
async function initJobs(client: Client) {
  const keys = await reminders.get("keys");
  if (!keys) {
    return;
  }

  const delay = { amount: 5 as DurationInputArg1, unit: "seconds" as DurationInputArg2 };
  const curTime = moment().add(delay.amount, delay.unit).unix();
  for (const key of Object.keys(keys)) {
    const rem = await reminders.get(key);
    if (rem.unixTs < curTime) {
      rem.unixTs = curTime;
      logger.warn(`Reminder ${rem.id} is in the past. Firing in ${delay.amount} ${delay.unit}`);
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
