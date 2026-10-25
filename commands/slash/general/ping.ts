import { MessageFlags, SlashCommandBuilder } from "discord.js";
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
    await interaction.editReply(
      `${sent.content}\nRoundtrip latency: ${sent.createdTimestamp - interaction.createdTimestamp}ms.`,
    );
  },
} satisfies SlashCommand;
