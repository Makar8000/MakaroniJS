const { SlashCommandBuilder } = require('discord.js');
const path = require('path');
const moment = require('moment');
const config = require(path.join(__dirname, '../../../utils/reminders/config'));
const ReminderManager = require(path.join(__dirname, '../../../utils/reminders/reminder-manager.js'));
const logger = require(path.join(__dirname, '../../../utils/logger.js'));

module.exports = {
  data: new SlashCommandBuilder()
    .setName('reminder')
    .setDescription('Create or manage custom reminders.')
    .addSubcommand(subcommand => subcommand
      .setName('create')
      .setDescription('Create a new reminder to send in the future.')
      .addIntegerOption(option => option
        .setName('time')
        .setDescription('The time to send the reminder. This should be a Unix Timestamp (Seconds). https://hammertime.cyou/')
        .setRequired(true))
      .addStringOption(option => option
        .setName('message')
        .setDescription('The message to send at the time specified.')
        .setRequired(true))
      .addMentionableOption(option => option
        .setName('mention')
        .setDescription('Who should be mentioned in this reminder?')),
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
    await interaction.deferReply({ ephemeral: true });
    const client = interaction.client;
    const subcommand = interaction.options.getSubcommand();
    logger.debug(`Resolving subcommand: ${subcommand}`);

    if (subcommand === 'create') {
      const time = interaction.options.getNumber('time');
      if (time < moment().unix() || `${time}`.length !== 10) {
        await interaction.followUp({
          content: config.invalidTime(time),
          ephemeral: true,
        });
        return;
      }

      const mention = interaction.options.getMentionable('mention')?.toString();
      const msg = interaction.options.getString('message');
      const reminder = {
        id: interaction.id,
        unixTs: time,
        authorId: interaction.user.id,
        channelId: interaction.channelId,
        mention: mention,
        message: msg,
      };
      const resp = await ReminderManager.scheduleReminder(client, reminder);
      if (!resp) {
        await interaction.followUp({
          content: config.errorSchedule(time),
          ephemeral: true,
        });
      } else {
        await interaction.followUp({
          embeds: [config.createSuccess(reminder, interaction.user)],
          ephemeral: true,
        });
      }
    } else if (subcommand === 'list') {
      const list = await ReminderManager.getReminders(interaction.user.id);
      if (!list?.length) {
        await interaction.followUp({
          content: config.listFail(),
          ephemeral: true,
        });
      } else {
        await interaction.followUp({
          embeds: [config.listSuccess(list, interaction.user)],
          ephemeral: true,
        });
      }
    } else if (subcommand === 'cancel') {
      const id = interaction.options.getString('id');
      const resp = await ReminderManager.cancelReminder(id, interaction.user.id);
      if (!resp) {
        await interaction.followUp({
          content: config.cancelFail(id),
          ephemeral: true,
        });
      } else {
        await interaction.followUp({
          content: config.cancelSuccess(id),
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