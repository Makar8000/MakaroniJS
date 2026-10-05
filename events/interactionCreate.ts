import { Events, type Interaction } from "discord.js";
import logger from "../utils/logger.ts";
import type { BotEvent } from "../utils/types.ts";

export default {
  name: Events.InteractionCreate,
  async execute(interaction: Interaction) {
    if (interaction.isChatInputCommand()) {
      const command = interaction.client.commands.slash.get(interaction.commandName);
      if (!command) {
        logger.error(`No command matching ${interaction.commandName} was found.`);
        return;
      }

      try {
        await command.execute(interaction);
      } catch (error) {
        if (typeof command.error === "function") {
          await command.error(interaction, error);
        } else {
          logger.error(error);
        }
      }
      return;
    }

    const isComponentOrModal = interaction.isButton() || interaction.isModalSubmit() ||
      interaction.isStringSelectMenu() || interaction.isUserSelectMenu();
    if (isComponentOrModal) {
      // Component/Modal customIds are namespaced as `<commandName>:<...>` so they can be
      // routed back to the command that created them.
      const [commandName] = interaction.customId.split(":");
      const command = interaction.client.commands.slash.get(commandName);
      if (!command) {
        logger.error(`No command matching customId prefix "${commandName}" was found.`);
        return;
      }

      try {
        if (interaction.isButton() && command.button) {
          await command.button(interaction);
        } else if (interaction.isModalSubmit() && command.modalSubmit) {
          await command.modalSubmit(interaction);
        } else if ((interaction.isStringSelectMenu() || interaction.isUserSelectMenu()) && command.selectMenu) {
          await command.selectMenu(interaction);
        } else {
          logger.error(`Command "${commandName}" does not support this type of interaction (customId: ${interaction.customId}).`);
        }
      } catch (error) {
        if (typeof command.error === "function") {
          await command.error(interaction, error);
        } else {
          logger.error(error);
        }
      }
    }
  },
} satisfies BotEvent<Events.InteractionCreate>;
