import type { ChatInputCommandInteraction } from "discord.js";
import { MessageFlags, SlashCommandBuilder } from "discord.js";
import logger from "../../../utils/logger.ts";
import type { SlashCommand } from "../../../utils/types.ts";

export default {
  data: new SlashCommandBuilder()
    .setName("alert")
    .setDescription("Sends an alert to Makar (for emergency use only).")
    .addStringOption((o) => o.setName("message").setDescription("Alert message.").setRequired(true).setMaxLength(1024)),
  async execute(interaction) {
    await interaction.deferReply({ flags: MessageFlags.Ephemeral });
    const resp = await fetch(`${Bun.env.INTERNAL_API_URL}/find-my-phone`, {
      method: "POST",
      headers: {
        Authorization: `${Bun.env.INTERNAL_API_AUTH}`,
        // message body must be UTF-8
        "Content-Type": "application/json; charset=utf-8",
      },
      body: JSON.stringify({
        title: `Discord alert from ${interaction.user.username}`,
        message: interaction.options.getString("message", true),
      }),
    });
    if (!resp.ok) {
      logger.error(`Alert failed (${resp.status}): ${await resp.text()}`);
      await interaction.editReply(`Failed to send alert (${resp.status}).`);
      return;
    }
    await interaction.editReply("Alert delivered successfully.");
  },
  async error(interaction: ChatInputCommandInteraction, error: unknown) {
    logger.error(`Error executing ${interaction.commandName}`);
    logger.error(error);
    if (interaction.deferred) {
      await interaction.editReply("Failed to send alert.");
    }
  },
} satisfies SlashCommand;
