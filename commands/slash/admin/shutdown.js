import { SlashCommandBuilder, PermissionFlagsBits } from 'discord.js';
import config from '../../../config.js';
import logger from '../../../utils/logger.js';

export default {
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