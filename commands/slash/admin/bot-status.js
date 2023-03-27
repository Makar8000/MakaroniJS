const { SlashCommandBuilder, PermissionFlagsBits, ActivityType } = require('discord.js');
const path = require('path');
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
          { name: 'Custom', value: ActivityType.Custom },
          { name: 'Playing', value: ActivityType.Playing },
          { name: 'Listening', value: ActivityType.Listening },
          { name: 'Competing', value: ActivityType.Competing },
          { name: 'Watching', value: ActivityType.Watching },
          { name: 'Streaming', value: ActivityType.Streaming },
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

    if (subcommand === 'activity') {
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