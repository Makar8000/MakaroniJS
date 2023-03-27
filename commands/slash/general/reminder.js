const { SlashCommandBuilder } = require('discord.js');
const path = require('path');
const ReminderManager = require(path.join(__dirname, '../../../utils/reminders/reminder-manager.js'));
const logger = require(path.join(__dirname, '../../../utils/logger.js'));

module.exports = {
  data: new SlashCommandBuilder()
    .setName('reminder')
    .setDescription('Create or manager custom reminders.')
    .addSubcommand(subcommand => subcommand
      .setName('create')
      .setDescription('Create a new reminder to send in the future.')
      .addStringOption(option => option
        .setName('time')
        .setDescription('The time to send the reminder.')
        .setRequired(true))
      .addStringOption(option => option
        .setName('message')
        .setDescription('The message to send at the time specified.')
        .setRequired(true)),
    )
    .addSubcommand(subcommand => subcommand
      .setName('list')
      .setDescription('List all of your scheduled reminders.'),
    )
    .addSubcommand(subcommand => subcommand
      .setName('cancel')
      .setDescription('Cancel a reminder that is currently scheduled.')
      .addStringOption(option => option
        .setName('id')
        .setDescription('The ID of the reminder to cancel. You can get this using the `/reminder list` command.')
        .setRequired(true)),
    ),
  async execute(interaction) {
    const client = interaction.client;
    const subcommand = interaction.options.getSubcommand();
    logger.debug(`Resolving subcommand: ${subcommand}`);
  },
  async error(interaction, error) {
    logger.error(`Error executing ${interaction.commandName}`);
    logger.error(error);
  },
};