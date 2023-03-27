const path = require('path');
const scheduler = require('node-schedule');
const moment = require('moment');
const logger = require(path.join(__dirname, '../logger.js'));
const AsyncLock = require('async-lock');
const Keyv = require('keyv');
const { KeyvFile } = require('keyv-file');

const lock = new AsyncLock();
const reminders = new Keyv({
  namespace: 'reminders',
  store: new KeyvFile({
    filename: path.join(__dirname, '../../data/reminders.json'),
  }),
});

/**
 * Schedules a new reminder.
 * @param {Client} client
 *  The discord.js client.
 * @param {Object} reminder
 *  The reminder data.
 * @returns
 *  A reference to the scheduled job.
 */
async function scheduleReminder(client, reminder) {
  reminders.set(reminder.id, reminder);
  let keys = await reminders.get('keys');
  lock.acquire('remindersLock', () => {
    if (keys) {
      keys[reminder.id] = true;
    } else {
      keys = { [reminder.id]: true };
    }
    reminders.set('keys', keys);
  });
  return startJob(client, reminder);
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
function startJob(client, reminder) {
  try {
    logger.info(`Scheduling job ${reminder.id}`);
    const date = moment.unix(reminder.unixTs).toDate();
    return scheduler.scheduleJob(date, sendReminder.bind(null, client, reminder));
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
async function sendReminder(client, reminder) {
  try {
    logger.info(`[${client?.user?.id}] Firing Reminder: ${reminder?.id}`);

    let mention = reminder.authorId;
    if (reminder.roleId) {
      mention = `&${reminder.roleId}`;
    }
    const message = `Hey <@${mention}> ${reminder.message}`;

    if (client.channelId) {
      const channel = await client.channels.fetch(client.channelId, { force: true, allowUnknownGuild: true });
      if (channel) {
        await channel.send(message);
      }
    } else {
      await client.users.send(reminder.authorId, message);
    }

    const keys = await reminders.get('keys');
    delete keys[reminder.id];
    await reminders.set('keys', keys);
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
 * @returns
 *  The jobs that were scheduled.
 */
async function initJobs(client) {
  const keys = await reminders.get('keys');
  if (!keys) {
    return;
  }

  const delay = { amount: 5, unit: 'seconds' };
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

module.exports = {
  scheduleReminder,
  initJobs,
};