import type { ChatInputCommandInteraction } from "discord.js";
import { MessageFlags, SlashCommandBuilder } from "discord.js";
import logger from "../../../utils/logger.ts";
import type { SlashCommand } from "../../../utils/types.ts";

export default {
  data: new SlashCommandBuilder().setName("ping").setDescription("Replies with ping information."),
  async execute(interaction) {
    const client = interaction.client;
    const sent = await interaction.reply({
      content: `Websocket heartbeat: ${client.ws.ping}ms.`,
      fetchReply: true,
      flags: MessageFlags.Ephemeral,
    });
    interaction.editReply(
      `${sent.content}\nRoundtrip latency: ${sent.createdTimestamp - interaction.createdTimestamp}ms.`,
    );
  },
  async error(interaction: ChatInputCommandInteraction, error: unknown) {
    logger.error(`Error executing ${interaction.commandName}`);
    logger.error(error);
  },
} satisfies SlashCommand;
