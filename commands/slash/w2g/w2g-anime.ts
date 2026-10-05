import { MessageFlags, SlashCommandBuilder } from "discord.js";
import type { ChatInputCommandInteraction } from "discord.js";
import type { SlashCommand } from "../../../utils/types.ts";
import consumet from "../../../utils/w2g/anime.ts";
import w2g from "../../../utils/w2g/w2g.ts";
import config from "../../../utils/w2g/config.ts";
import logger from "../../../utils/logger.ts";

export default {
  data: new SlashCommandBuilder()
    .setName("w2g-anime")
    .setDescription("Watch anime together.")
    .addStringOption((option) =>
      option
        .setName("anime-name")
        .setDescription("The name of the anime to watch together.")
        .setRequired(true)
    )
    .addIntegerOption((option) =>
      option
        .setName("episode")
        .setDescription("The episode number.")
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
    const animeName = interaction.options.getString("anime-name", true);
    const episodeNumber = interaction.options.getInteger("episode") ?? 1;

    const animeList = await consumet.search(animeName);
    if (animeList.length < 1) {
      interaction.followUp({
        content: `[ERROR] Unable to find anime with the name \`${animeName}\`.`,
        flags: MessageFlags.Ephemeral,
      });
      return;
    }
    const animeInfo = await consumet.fetchAnimeInfo(animeList[0].id, animeName, episodeNumber);
    if (!animeInfo) {
      interaction.followUp({
        content: `[ERROR] Unable to find any episodes for \`${animeName}\`.`,
        flags: MessageFlags.Ephemeral,
      });
      return;
    }
    const episodeId = animeInfo.episodes?.find((e) => e.number === episodeNumber)?.id;
    if (!episodeId) {
      interaction.followUp({
        content: `[ERROR] Unable to find episode ${episodeNumber} of \`${animeName}\`.`,
        flags: MessageFlags.Ephemeral,
      });
      return;
    }
    const servers = await consumet.fetchEpisodeServers(episodeId);
    const videoUrl = servers?.shift()?.url;
    if (servers.length < 1 || !videoUrl) {
      interaction.followUp({
        content: `[ERROR] Unable to find video link for episode ${episodeNumber} of \`${animeName}\`.`,
        flags: MessageFlags.Ephemeral,
      });
      return;
    }

    animeInfo.videoUrl = videoUrl;
    animeInfo.episodeId = episodeId;
    animeInfo.episodeNumber = episodeNumber;
    const roomId = interaction.options.getString("room-id");
    if (!roomId) {
      const key = await w2g.createRoom(videoUrl);
      const resp = await w2g.addToRoom(key, videoUrl, { title: `[EP ${animeInfo.episodeNumber}] ${animeInfo.title.romaji}` });
      if (resp) {
        animeInfo.roomId = key;
        animeInfo.roomUrl = await w2g.getRoomUrl(key);
        await channel.send({
          embeds: config.createSuccessAnime(animeInfo, interaction.user),
        });
        await interaction.deleteReply();
      } else {
        interaction.followUp({
          content: "Network error or invalid video url provided.",
          flags: MessageFlags.Ephemeral,
        });
      }
    } else {
      const resp = await w2g.addToRoom(roomId, videoUrl, { title: `[EP ${animeInfo.episodeNumber}] ${animeInfo.title.romaji}` });
      if (resp) {
        animeInfo.roomId = roomId;
        animeInfo.roomUrl = await w2g.getRoomUrl(roomId);
        await channel.send({
          embeds: config.addSuccessAnime(animeInfo, interaction.user),
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
