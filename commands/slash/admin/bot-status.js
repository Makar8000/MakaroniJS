const { SlashCommandBuilder, PermissionFlagsBits, ActivityType } = require('discord.js');
const path = require('path');
const config = require(path.join(__dirname, '../../../config.js'));
const logger = require(path.join(__dirname, '../../../utils/logger.js'));

module.exports = {
  data: new SlashCommandBuilder()
    .setName('setpresence')
    .setDescription('Adjust the presence of the bot.')
    .addSubcommand(subcommand => subcommand
      .setName('activity')
      .setDescription('The activity of the bot.')
      .addStringOption(option => option
        .setName('name')
        .setDescription('The activity name.')
        .setRequired(true))
      .addIntegerOption(option => option
        .setName('type')
        .setDescription('The activity type.')
        .addChoices(
          { name: 'Playing', value: ActivityType.Playing },
          { name: 'Watching', value: ActivityType.Watching },
          { name: 'Listening to', value: ActivityType.Listening },
          { name: 'Competing in', value: ActivityType.Competing },
          // Not allowed for bots
          // { name: 'Streaming', value: ActivityType.Streaming },
          // { name: 'Custom', value: ActivityType.Custom },
        )
        .setRequired(true)),
    )
    .addSubcommand(subcommand => subcommand
      .setName('status')
      .setDescription('The online status of the bot.')
      .addStringOption(option => option
        .setName('type')
        .setDescription('The online status to change to.')
        .addChoices(
          { name: 'Online', value: 'online' },
          { name: 'Idle', value: 'idle' },
          { name: 'Do Not Disturb', value: 'dnd' },
          { name: 'Invisible', value: 'invisible' },
        )
        .setRequired(true)),
    )
    .setDefaultMemberPermissions(PermissionFlagsBits.Administrator),
  async execute(interaction) {
    const client = interaction.client;
    const subcommand = interaction.options.getSubcommand();
    logger.debug(`Resolving subcommand: ${subcommand}`);

    if (!config.users.admins.includes(interaction.user.id)) {
      interaction.reply({
        content: 'You do not have permission to run this command.',
        ephemeral: true,
      });
    } else if (subcommand === 'activity') {
      const name = interaction.options.getString('name');
      const type = interaction.options.getInteger('type');
      client.user.setActivity({ name, type });

      const reply = `Set ${subcommand} to "${name}" with type #${type}`;
      await interaction.reply({
        content: reply,
        ephemeral: true,
      });
      logger.info(reply);
    } else if (subcommand === 'status') {
      const type = interaction.options.getString('type');
      client.user.setStatus(type);

      const reply = `Set ${subcommand} to ${type}`;
      await interaction.reply({
        content: reply,
        ephemeral: true,
      });
      logger.info(reply);
    }
  },
  async error(interaction, error) {
    logger.error(`Error executing ${interaction.commandName}`);
    logger.error(error);
  },
};