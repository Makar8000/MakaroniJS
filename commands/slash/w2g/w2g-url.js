const { SlashCommandBuilder } = require('discord.js');
const path = require('path');
const w2g = require(path.join(__dirname, '../../../utils/w2g/w2g.js'));
const config = require(path.join(__dirname, '../../../utils/w2g/config.js'));
const logger = require(path.join(__dirname, '../../../utils/logger.js'));

module.exports = {
  data: new SlashCommandBuilder()
    .setName('w2g')
    .setDescription('Watch something together.')
    .addStringOption(option => option
      .setName('video-link')
      .setDescription('The video link to watch together.')
      .setRequired(true),
    )
    .addStringOption(option => option
      .setName('room-id')
      .setDescription('The room ID to use. If none is provided, a new one will be created.'),
    ),
  async execute(interaction) {
    await interaction.deferReply({ ephemeral: true });
    const videoUrl = interaction.options.getString('video-link');
    const roomId = interaction.options.getString('room-id');
    if (!roomId) {
      const key = await w2g.createRoom(videoUrl);
      if (key) {
        const url = await w2g.getRoomUrl(key);
        await interaction.channel.send({
          embeds: config.createSuccess(url, videoUrl, key, interaction.user),
        });
        await interaction.deleteReply();
      } else {
        interaction.followUp({
          content: 'Network error or invalid video url provided.',
          ephemeral: true,
        });
      }
    } else {
      const resp = await w2g.addToRoom(roomId, videoUrl);
      if (resp) {
        const url = await w2g.getRoomUrl(roomId);
        await interaction.channel.send({
          embeds: config.addSuccess(url, videoUrl, roomId, interaction.user),
        });
        await interaction.deleteReply();
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