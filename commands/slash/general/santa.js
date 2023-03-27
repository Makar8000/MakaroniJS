const { SlashCommandBuilder } = require('discord.js');
const path = require('path');
const SantaManager = require(path.join(__dirname, '../../../utils/santa/santa-manager.js'));
const config = require(path.join(__dirname, '../../../config.js'));
const logger = require(path.join(__dirname, '../../../utils/logger.js'));
SantaManager.initSantas();

module.exports = {
  data: new SlashCommandBuilder()
    .setName('ss')
    .setDescription('Secret Santa commands')
    .addSubcommand(subcommand => subcommand
      .setName('register')
      .setDescription('Register for Secret Santa or update your registration information.')
      .addStringOption(option => option
        .setName('name')
        .setDescription('The name that you want to appear on your package(s)')
        .setRequired(true))
      .addStringOption(option => option
        .setName('address')
        .setDescription('The address your santa needs to send the package(s) to')
        .setRequired(true))
      .addStringOption(option => option
        .setName('notes')
        .setDescription('A message for your Secret Santa (what not to buy & other notes)')
        .setRequired(true)),
    )
    .addSubcommand(subcommand => subcommand
      .setName('unregister')
      .setDescription('Unregister for Secret Santa.'),
    )
    .addSubcommand(subcommand => subcommand
      .setName('channel')
      .setDescription('Send a message to the Secret Santa channel anonymously.')
      .addStringOption(option => option
        .setName('msg')
        .setDescription('The message to send')
        .setRequired(true)),
    )
    .addSubcommand(subcommand => subcommand
      .setName('santa')
      .setDescription('Send a message to your Secret Santa.')
      .addStringOption(option => option
        .setName('msg')
        .setDescription('The message to send')
        .setRequired(true)),
    )
    .addSubcommand(subcommand => subcommand
      .setName('receiver')
      .setDescription('Send a message to your receiver anonymously.')
      .addStringOption(option => option
        .setName('msg')
        .setDescription('The message to send')
        .setRequired(true)),
    )
    .addSubcommand(subcommand => subcommand
      .setName('reload')
      .setDescription('Reloads the Secret Santa config.'),
    ),
  async execute(interaction) {
    const client = interaction.client;
    const subcommand = interaction.options.getSubcommand();
    logger.debug(`Resolving subcommand: ${subcommand}`);

    if (subcommand === 'reload') {
      if (config.users.admins.includes(interaction.user.id)) {
        SantaManager.reloadSantas();
        interaction.reply({
          content: 'Reloaded santas.',
          ephemeral: true,
        });
      } else {
        interaction.reply({
          content: 'You do not have permission to run this command.',
          ephemeral: true,
        });
      }
    } else if (subcommand.endsWith('register')) {
      if (SantaManager.started()) {
        interaction.reply({
          content: `[ERROR] The Secret Santa session has already started. Failed to ${subcommand}.`,
          ephemeral: true,
        });
        return;
      }

      if (subcommand === 'register') {
        const name = interaction.options.getString('name');
        const address = interaction.options.getString('address');
        const notes = interaction.options.getString('notes');
        const added = SantaManager.addSanta({
          discordId: interaction.user.id,
          name, address, notes,
        });
        if (added) {
          interaction.reply({
            content: 'Successfully registered.',
            ephemeral: true,
          });
        } else {
          interaction.reply({
            content: 'Successfully updated registration.',
            ephemeral: true,
          });
        }
      } else if (subcommand === 'unregister') {
        const removed = SantaManager.removeSanta(interaction.user.id);
        if (removed) {
          interaction.reply({
            content: 'Successfully unregistered.',
            ephemeral: true,
          });
        } else {
          interaction.reply({
            content: '[ERROR] You are not registered.',
            ephemeral: true,
          });
        }
      }
    } else {
      if (!SantaManager.isRegistered(interaction.user.id)) {
        interaction.reply({
          content: '[ERROR] You are not registered.',
          ephemeral: true,
        });
        return;
      }

      if (!SantaManager.started()) {
        interaction.reply({
          content: '[ERROR] The Secret Santa session has not started yet. Unable to send message.',
          ephemeral: true,
        });
        return;
      }

      const msg = interaction.options.getString('msg');
      if (subcommand === 'channel') {
        logger.debug('Sending message to channel...');
        const channel = await client.channels.fetch(SantaManager.getChannelId());
        channel.send({
          content: msg,
        });
      } else if (subcommand === 'santa') {
        logger.debug('Sending message to santa...');
        const channel = await client.users.fetch(SantaManager.getSanta(interaction.user.id));
        channel.send({
          content: msg,
        }).catch(error => {
          logger.error(error);
        });
      } else if (subcommand === 'receiver') {
        logger.debug('Sending message to receiver...');
        const channel = await client.users.fetch(SantaManager.getReceiver(interaction.user.id));
        channel.send({
          content: msg,
        }).catch(error => {
          logger.error(error);
        });
      }
    }
  },
  async error(interaction, error) {
    logger.error(`Error executing ${interaction.commandName}`);
    logger.error(error);
  },
};