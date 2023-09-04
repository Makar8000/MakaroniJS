const { Events } = require('discord.js');
const path = require('path');
const logger = require(path.join(__dirname, '../utils/logger.js'));
const ReminderManager = require(path.join(__dirname, '../utils/reminders/reminder-manager.js'));
const HSRManager = require(path.join(__dirname, '../utils/hsr/hsr-manager.js'));

module.exports = {
  name: Events.ClientReady,
  once: true,
  execute(client) {
    logger.info(`${client.user.username} is now ${client.user.presence.status}!`);
    ReminderManager.initJobs(client);
    HSRManager.initJobs(client);
  },
};