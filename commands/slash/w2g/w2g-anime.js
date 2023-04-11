const { SlashCommandBuilder } = require('discord.js');
const path = require('path');
const consumet = require(path.join(__dirname, '../../../utils/w2g/anime.js'));
const w2g = require(path.join(__dirname, '../../../utils/w2g/w2g.js'));
const config = require(path.join(__dirname, '../../../utils/w2g/config.js'));
const logger = require(path.join(__dirname, '../../../utils/logger.js'));

module.exports = {
  data: new SlashCommandBuilder()
    .setName('w2g-anime')
    .setDescription('Watch anime together.')
    .addStringOption(option => option
      .setName('anime-name')
      .setDescription('The name of the anime to watch together.')
      .setRequired(true),
    )
    .addIntegerOption(option => option
      .setName('episode')
      .setDescription('The episode number.'),
    )
    .addStringOption(option => option
      .setName('room-id')
      .setDescription('The room ID to use. If none is provided, a new one will be created.'),
    ),
  async execute(interaction) {
    await interaction.deferReply();
    const animeName = interaction.options.getString('anime-name');
    const episodeNumber = interaction.options.getInteger('episode') ?? 1;

    const animeList = await consumet.search(animeName);
    if (animeList?.length < 1) {
      interaction.followUp({
        content: `[ERROR] Unable to find anime with the name \`${animeName}\`.`,
        ephemeral: true,
      });
      return;
    }
    const animeInfo = await consumet.fetchAnimeInfo(animeList[0].id, animeName, episodeNumber);
    if (!animeInfo) {
      interaction.followUp({
        content: `[ERROR] Unable to find any episodes for \`${animeName}\`.`,
        ephemeral: true,
      });
      return;
    }
    const episodeId = animeInfo.episodes.find(e => e.number === episodeNumber)?.id;
    if (!episodeId) {
      interaction.followUp({
        content: `[ERROR] Unable to find episode ${episodeNumber} of \`${animeName}\`.`,
        ephemeral: true,
      });
      return;
    }
    const servers = await consumet.fetchEpisodeServers(episodeId);
    const videoUrl = servers?.shift()?.url;
    if (servers?.length < 1 || !videoUrl) {
      interaction.followUp({
        content: `[ERROR] Unable to find video link for episode ${episodeNumber} of \`${animeName}\`.`,
        ephemeral: true,
      });
      return;
    }

    animeInfo.videoUrl = videoUrl;
    animeInfo.episodeId = episodeId;
    animeInfo.episodeNumber = episodeNumber;
    const roomId = interaction.options.getString('room-id');
    if (!roomId) {
      const key = await w2g.createRoom(videoUrl);
      const resp = await w2g.addToRoom(key, videoUrl, { title: `[EP ${animeInfo.episodeNumber}] ${animeInfo.title.romaji}` });
      if (resp) {
        animeInfo.roomId = key;
        animeInfo.roomUrl = await w2g.getRoomUrl(key);
        interaction.followUp({
          embeds: config.createSuccessAnime(animeInfo, interaction.user),
        });
      } else {
        interaction.followUp({
          content: 'Network error or invalid video url provided.',
          ephemeral: true,
        });
      }
    } else {
      const resp = await w2g.addToRoom(roomId, videoUrl, { title: `[EP ${animeInfo.episodeNumber}] ${animeInfo.title}` });
      if (resp) {
        animeInfo.roomId = roomId;
        animeInfo.roomUrl = await w2g.getRoomUrl(roomId);
        interaction.followUp({
          embeds: config.addSuccessAnime(animeInfo, interaction.user),
        });
      } else {
        interaction.followUp({
          content: 'Unable to add video. This could be due to a bad room ID or invalid video link.',
          ephemeral: true,
        });
      }
    }
  },
  async error(interaction, error) {
    logger.error(`Error executing ${interaction.commandName}`);
    logger.error(error);
  },
};