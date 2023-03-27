const { SlashCommandBuilder } = require('discord.js');
const path = require('path');
const etro = require(path.join(__dirname, '../../../utils/ffxiv/etro.js'));
const logger = require(path.join(__dirname, '../../../utils/logger.js'));

module.exports = {
  data: new SlashCommandBuilder()
    .setName('etro')
    .setDescription('Parse currency required to obtain an etro set.')
    .addStringOption(option => option
      .setName('etro-link')
      .setDescription('The link to the etro set.')
      .setRequired(true),
    ),
  async execute(interaction) {
    await interaction.deferReply();
    const etroUrl = interaction.options.getString('etro-link');
    const etroSet = await etro.getFromUrl(etroUrl);

    if (etroSet) {
      interaction.followUp({
        embeds: [etro.getAsEmbed(etroSet)],
      });
    } else {
      interaction.followUp({
        content: 'Network error or invalid etro url provided.',
        ephemeral: true,
      });
    }
  },
  async error(interaction, error) {
    logger.error(`Error executing ${interaction.commandName}`);
    logger.error(error);
  },
};