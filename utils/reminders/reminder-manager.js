const fs = require('fs');
const path = require('path');
const scheduler = require('node-schedule');
const moment = require('moment');
const AsyncLock = require('async-lock');
const lock = new AsyncLock();
const remindersPath = path.join(__dirname, 'reminders.json');
let reminders = loadReminders();
let jobs = loadJobs();

/**
 * Schedules a new reminder.
 * @param {Client} client
 *  The discord.js client.
 * @param {Object} reminder
 *  The reminder data.
 * @returns
 *  A reference to the scheduled job.
 */
function scheduleReminder(client, reminder) {
  reminders.push(reminder);

  const date = moment.unix(reminder.unixTs).toDate();
  const cb = function(c) {
    console.log(`Bot ID: ${c.user.id}`);
  }.bind(null, client);
  jobs[reminder.id] = scheduler.scheduleJob(date, cb);

  saveReminders();
  return jobs[reminder.id];
}

/**
 * Loads and schedules jobs for all reminders
 * @param {Client} client
 *  The discord.js client.
 * @returns
 *  The jobs that were scheduled.
 */
function loadJobs(client) {
  try {
    const ret = {};
    for (const rem of reminders) {
      const date = moment.unix(rem.unixTs).toDate();
      const cb = function(c) {
        console.log(`Bot ID: ${c.user.id}`);
      }.bind(null, client);
      ret[rem.id] = scheduler.scheduleJob(date, cb);
    }
    return ret;
  } catch {
    return {};
  }
}

/**
 * Loads the reminders from disk.
 * @returns The reminders.
 */
function loadReminders() {
  try {
    const rems = JSON.parse(fs.readFileSync(remindersPath));
    return rems;
  } catch {
    return [];
  }
}

/**
 * Saves the reminders to disk.
 */
function saveReminders() {
  lock.acquire('remindersLock', () => {
    fs.writeFileSync(remindersPath, JSON.stringify(reminders, null, 2));
  });
}

/**
 * Reloads the reminders from disk.
 * @param {Client} client
 *  The discord.js client.
 */
function reloadReminders(client) {
  lock.acquire('remindersLock', () => {
    reminders = loadReminders();
    scheduler.gracefulShutdown().then(() => {
      jobs = loadJobs(client);
    });
  });
}

module.exports = {
  scheduleReminder,
  reloadReminders,
};