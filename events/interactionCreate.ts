import {
  Events,
  type Interaction,
  type InteractionReplyOptions,
  MessageFlags,
  type RepliableInteraction,
} from "discord.js";
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
          await handleError(interaction, error);
        }
      }
      return;
    }

    if (interaction.isAutocomplete()) {
      try {
        await interaction.client.commands.slash.get(interaction.commandName)?.autocomplete?.(interaction);
      } catch (error) {
        logger.error({ err: error }, `Autocomplete failed for ${interaction.commandName}`);
      }
      return;
    }

    const isComponentOrModal =
      interaction.isButton() ||
      interaction.isModalSubmit() ||
      interaction.isStringSelectMenu() ||
      interaction.isUserSelectMenu();
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
          logger.error(
            `Command "${commandName}" does not support this type of interaction (customId: ${interaction.customId}).`,
          );
        }
      } catch (error) {
        if (typeof command.error === "function") {
          await command.error(interaction, error);
        } else {
          await handleError(interaction, error);
        }
      }
    }
  },
} satisfies BotEvent<Events.InteractionCreate>;

/**
 * Logs an error thrown while handling an interaction and tells the user it failed.
 * Used for every command that doesn't define its own `error` handler.
 * @param {Interaction} interaction The interaction that was being handled when the error occurred.
 * @param {Error} error The error that was thrown.
 */
async function handleError(interaction: RepliableInteraction, error: unknown) {
  let source = "unknown";
  if ("commandName" in interaction) {
    source = interaction.commandName;
  } else if ("customId" in interaction) {
    source = interaction.customId;
  }
  logger.error(`Error executing ${source}`);
  logger.error(error);
  const payload: InteractionReplyOptions = {
    content: "[ERROR] Something went wrong while processing your request. Please try again.",
    flags: MessageFlags.Ephemeral,
  };
  try {
    if (interaction.deferred || interaction.replied) {
      await interaction.followUp(payload);
    } else {
      await interaction.reply(payload);
    }
  } catch (notifyError) {
    logger.error({ err: notifyError }, "Failed to notify user of the above error:");
  }
}
