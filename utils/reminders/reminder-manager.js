const fs = require('fs');
const path = require('path');
const AsyncLock = require('async-lock');
const lock = new AsyncLock();
const remindersPath = path.join(__dirname, 'reminders.json');
let reminders = loadReminders();

/**
 * Adds and schedules a new reminder.
 * @param {Object} reminder
 * @returns
 *  A reference to the scheduled job.
 */
function addReminder(reminder) {
  saveReminders();
  return reminder;
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
    return {};
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
 */
function reloadReminders() {
  lock.acquire('remindersLock', () => {
    reminders = loadReminders();
  });
}

module.exports = {
  addReminder,
  reloadReminders,
};