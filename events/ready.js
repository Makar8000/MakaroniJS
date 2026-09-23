import { Events } from 'discord.js';
import logger from '../utils/logger.js';
import ReminderManager from '../utils/reminders/reminder-manager.js';
import HSRManager from '../utils/hsr/hsr-manager.js';

export default {
  name: Events.ClientReady,
  once: true,
  execute(client) {
    logger.info(`${client.user.username} is now ${client.user.presence.status}!`);
    ReminderManager.initJobs(client);
    HSRManager.initJobs(client);
  },
};