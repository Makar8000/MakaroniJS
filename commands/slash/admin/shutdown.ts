import type { ChatInputCommandInteraction } from "discord.js";
import { MessageFlags, PermissionFlagsBits, SlashCommandBuilder } from "discord.js";
import scheduler from "node-schedule";
import config from "../../../config.ts";
import { close as closeDb } from "../../../utils/db/db.ts";
import logger from "../../../utils/logger.ts";
import SantaManager from "../../../utils/santa/santa-manager.ts";
import type { SlashCommand } from "../../../utils/types.ts";

export default {
  data: new SlashCommandBuilder()
    .setName("shutdown")
    .setDescription("Shutdown the bot.")
    .setDefaultMemberPermissions(PermissionFlagsBits.Administrator),
  async execute(interaction) {
    if (config.users.admins.includes(interaction.user.id)) {
      await interaction.reply({
        content: "Shutting down...",
        flags: MessageFlags.Ephemeral,
      });
      // Close any scheduled jobs
      await scheduler.gracefulShutdown();
      // Close Secret Santa DB
      SantaManager.close();
      // Close primary Makaroni DB
      closeDb();
      // Discord shutdown
      await interaction.client.destroy();
      process.exit(0);
    } else {
      interaction.reply({
        content: "You do not have permission to run this command.",
        flags: MessageFlags.Ephemeral,
      });
    }
  },
  async error(interaction: ChatInputCommandInteraction, error: unknown) {
    logger.error(`Error executing ${interaction.commandName}`);
    logger.error(error);
  },
} satisfies SlashCommand;
