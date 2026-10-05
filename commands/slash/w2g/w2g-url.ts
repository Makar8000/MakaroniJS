import { MessageFlags, SlashCommandBuilder } from "discord.js";
import type { ChatInputCommandInteraction } from "discord.js";
import type { SlashCommand } from "../../../utils/types.ts";
import w2g from "../../../utils/w2g/w2g.ts";
import config from "../../../utils/w2g/config.ts";
import logger from "../../../utils/logger.ts";

export default {
  data: new SlashCommandBuilder()
    .setName("w2g")
    .setDescription("Watch something together.")
    .addStringOption((option) =>
      option
        .setName("video-link")
        .setDescription("The video link to watch together.")
        .setRequired(true)
    )
    .addStringOption((option) =>
      option
        .setName("room-id")
        .setDescription("The room ID to use. If none is provided, a new one will be created.")
    ),
  async execute(interaction) {
    await interaction.deferReply({ flags: MessageFlags.Ephemeral });
    const channel = interaction.channel;
    if (!channel?.isSendable()) {
      await interaction.followUp({ content: "[ERROR] I can't send messages in this channel.", flags: MessageFlags.Ephemeral });
      return;
    }
    const videoUrl = interaction.options.getString("video-link", true);
    const roomId = interaction.options.getString("room-id");
    if (!roomId) {
      const key = await w2g.createRoom(videoUrl);
      if (key) {
        const url = await w2g.getRoomUrl(key);
        await channel.send({
          embeds: config.createSuccess(url, videoUrl, key, interaction.user),
        });
        await interaction.deleteReply();
      } else {
        interaction.followUp({
          content: "Network error or invalid video url provided.",
          flags: MessageFlags.Ephemeral,
        });
      }
    } else {
      const resp = await w2g.addToRoom(roomId, videoUrl);
      if (resp) {
        const url = await w2g.getRoomUrl(roomId);
        await channel.send({
          embeds: config.addSuccess(url, videoUrl, roomId, interaction.user),
        });
        await interaction.deleteReply();
      } else {
        interaction.followUp({
          content: "Unable to add video. This could be due to a bad room ID or invalid video link.",
          flags: MessageFlags.Ephemeral,
        });
      }
    }
  },
  // deno-lint-ignore require-await
  async error(interaction: ChatInputCommandInteraction, error: unknown) {
    logger.error(`Error executing ${interaction.commandName}`);
    logger.error(error);
  },
} satisfies SlashCommand;
