import { type Client, Events } from "discord.js";
import logger from "../utils/logger.ts";
import type { BotEvent } from "../utils/types.ts";
import ReminderManager from "../utils/reminders/reminder-manager.ts";
import HSRManager from "../utils/hsr/hsr-manager.ts";
import SantaManager from "../utils/santa/santa-manager.ts";

export default {
  name: Events.ClientReady,
  once: true,
  execute(client: Client<true>) {
    logger.info(`${client.user.username} is now ${client.user.presence.status}!`);
    ReminderManager.initJobs(client);
    HSRManager.initJobs(client);
    SantaManager.init(client);
  },
} satisfies BotEvent<Events.ClientReady>;
