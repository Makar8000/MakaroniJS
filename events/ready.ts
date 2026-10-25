import { type Client, Events } from "discord.js";
import OdyleManager from "../utils/aion/odyle-manager.ts";
import HSRManager from "../utils/hsr/hsr-manager.ts";
import logger from "../utils/logger.ts";
import ReminderManager from "../utils/reminders/reminder-manager.ts";
import SantaManager from "../utils/santa/santa-manager.ts";
import type { BotEvent } from "../utils/types.ts";

export default {
  name: Events.ClientReady,
  once: true,
  execute(client: Client<true>) {
    logger.info(`${client.user.username} is now ${client.user.presence.status}!`);
    ReminderManager.initJobs(client);
    HSRManager.initJobs(client).catch((error) =>
      logger.error({ err: error }, "Failed to start HSR inclination checks:"),
    );
    SantaManager.init(client);
    OdyleManager.initJobs(client);
  },
} satisfies BotEvent<Events.ClientReady>;
