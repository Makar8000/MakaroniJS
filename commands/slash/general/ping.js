const { SlashCommandBuilder } = require('discord.js');
const path = require('path');
const logger = require(path.join(__dirname, '../../../utils/logger.js'));

module.exports = {
  data: new SlashCommandBuilder()
    .setName('ping')
    .setDescription('Replies with ping information.'),
  async execute(interaction) {
    const client = interaction.client;
    const sent = await interaction.reply({
      content: `Websocket heartbeat: ${client.ws.ping}ms.`,
      fetchReply: true,
      ephemeral: true,
    });
    interaction.editReply(`${sent.content}\nRoundtrip latency: ${sent.createdTimestamp - interaction.createdTimestamp}ms.`);
  },
  async error(interaction, error) {
    logger.error(`Error executing ${interaction.commandName}`);
    logger.error(error);
  },
};