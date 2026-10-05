import { Collection, Events, type Message } from "discord.js";
import logger from "../utils/logger.ts";
import type { BotEvent, ResolvedMessageParam } from "../utils/types.ts";

export default {
  name: Events.MessageCreate,
  async execute(message: Message) {
    if (message.author.id === message.client.user.id) {
      return;
    }

    const messageCmd = message.content.split(" ", 2)[0].toLowerCase();
    const command = message.client.commands.message.get(messageCmd);
    if (!command) {
      return;
    }

    if (typeof command.hasPermission === "function" && !command.hasPermission(message)) {
      logger.error(`You do not have permission to use \`${Deno.env.get("MESSAGE_PREFIX")}${messageCmd}\``);
      return;
    }

    try {
      const params = new Collection<string, ResolvedMessageParam>();
      for (const param of command.data.params) {
        if (!param.isValid(message)) {
          logger.error(`Invalid use of command \`${Deno.env.get("MESSAGE_PREFIX")}${messageCmd}\``);
          return;
        }
        params.set(param.name, {
          ...param,
          value: param.getValue(message),
        });
      }

      await command.execute(message, params);
    } catch (error) {
      if (typeof command.error === "function") {
        await command.error(message, error);
      } else {
        logger.error(error);
      }
    }
  },
} satisfies BotEvent<Events.MessageCreate>;
