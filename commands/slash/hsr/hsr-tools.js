const { SlashCommandBuilder } = require('discord.js');
const path = require('path');
const HSRManager = require(path.join(__dirname, '../../../utils/hsr/hsr-manager.js'));
const logger = require(path.join(__dirname, '../../../utils/logger.js'));
const { messages } = require(path.join(__dirname, '../../../utils/hsr/config.js'));


module.exports = {
  data: new SlashCommandBuilder()
    .setName('hsr')
    .setDescription('Various tools for HSR.')
    .addSubcommand(subcommand => subcommand
      .setName('inclination')
      .setDescription('Get notifications when new patch data contains changes for inclination text.')
      .addIntegerOption(option => option
        .setName('action')
        .setDescription('Are you subscribing or unsubscribing?')
        .addChoices(
          { name: 'Subscribe', value: 1 },
          { name: 'Unsubscribe', value: 0 },
        )
        .setRequired(true)),
    )
    .addSubcommand(subcommand => subcommand
      .setName('b-role')
      .setDescription('Get notifications when new b___ roles are assigned.')
      .addIntegerOption(option => option
        .setName('action')
        .setDescription('Are you subscribing or unsubscribing?')
        .addChoices(
          { name: 'Subscribe', value: 1 },
          { name: 'Unsubscribe', value: 0 },
        )
        .setRequired(true)),
    ),
  async execute(interaction) {
    await interaction.deferReply({ ephemeral: true });
    const client = interaction.client;
    const subcommand = interaction.options.getSubcommand();
    logger.debug(`Resolving subcommand: ${subcommand}`);

    if (subcommand === 'inclination') {
      const subscribe = interaction.options.getInteger('action');
      if (subscribe) {
        const resp = await HSRManager.scheduleInclinationCheck(client, interaction.user.id);
        if (resp) {
          await interaction.followUp({
            content: messages.subscribeSuccess,
            ephemeral: true,
          });
        } else {
          await interaction.followUp({
            content: messages.subscribeError,
            ephemeral: true,
          });
        }
      } else {
        const resp = await HSRManager.cancelInclinationCheck(interaction.user.id);
        if (resp) {
          await interaction.followUp({
            content: messages.unsubscribeSuccess,
            ephemeral: true,
          });
        } else {
          await interaction.followUp({
            content: messages.unsubscribeError,
            ephemeral: true,
          });
        }
      }
    } else if (subcommand === 'b-role') {
      const subscribe = interaction.options.getInteger('action');
      if (subscribe) {
        const resp = await HSRManager.scheduleRoleCheck(client, interaction.user.id);
        if (resp) {
          await interaction.followUp({
            content: messages.subscribeSuccess,
            ephemeral: true,
          });
        } else {
          await interaction.followUp({
            content: messages.subscribeError,
            ephemeral: true,
          });
        }
      } else {
        const resp = await HSRManager.cancelRoleCheck(interaction.user.id);
        if (resp) {
          await interaction.followUp({
            content: messages.unsubscribeSuccess,
            ephemeral: true,
          });
        } else {
          await interaction.followUp({
            content: messages.unsubscribeError,
            ephemeral: true,
          });
        }
      }
    }
  },
  async error(interaction, error) {
    logger.error(`Error executing ${interaction.commandName}`);
    logger.error(error);
  },
};