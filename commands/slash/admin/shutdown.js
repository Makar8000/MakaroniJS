const { SlashCommandBuilder, PermissionFlagsBits } = require('discord.js');
const path = require('path');
const config = require(path.join(__dirname, '../../../config.js'));
const logger = require(path.join(__dirname, '../../../utils/logger.js'));

module.exports = {
  data: new SlashCommandBuilder()
    .setName('shutdown')
    .setDescription('Shutdown the bot.')
    .setDefaultMemberPermissions(PermissionFlagsBits.Administrator),
  async execute(interaction) {
    if (config.users.admins.includes(interaction.user.id)) {
      await interaction.reply({
        content: 'Shutting down...',
        ephemeral: true,
      });
      interaction.client.destroy();
      process.exit(0);
    } else {
      interaction.reply({
        content: 'You do not have permission to run this command.',
        ephemeral: true,
      });
    }
  },
  async error(interaction, error) {
    logger.error(`Error executing ${interaction.commandName}`);
    logger.error(error);
  },
};