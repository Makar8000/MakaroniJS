import { SlashCommandBuilder } from 'discord.js';
import SantaManager from '../../../utils/santa/santa-manager.js';
import config from '../../../config.js';
import logger from '../../../utils/logger.js';

export default {
  data: new SlashCommandBuilder()
    .setName('ss-admin')
    .setDescription('Secret Santa admin commands.')
    .setDefaultMemberPermissions(0)
    .addSubcommand(subcommand => subcommand
      .setName('start')
      .setDescription('Starts the Secret Santa session.'),
    )
    .addSubcommand(subcommand => subcommand
      .setName('reset')
      .setDescription('Resets Secret Santa.'),
    )
    .addSubcommand(subcommand => subcommand
      .setName('list')
      .setDescription('Gets a list of users who are registered.'),
    )
    .addSubcommand(subcommand => subcommand
      .setName('blacklist')
      .setDescription('Gets a list of banned Secret Santa pairs.'),
    )
    .addSubcommand(subcommand => subcommand
      .setName('giftlist')
      .setDescription('Gets a list of gift shipment statuses.')
      .addBooleanOption(option => option
        .setName('public')
        .setDescription('Whether or not it should be posted publically (non-ephemeral). Default false.')
        .setRequired(false)),
    )
    .addSubcommand(subcommand => subcommand
      .setName('selectedlist')
      .setDescription('Gets a list of selected Secret Santa pairs.')
      .addBooleanOption(option => option
        .setName('public')
        .setDescription('Whether or not it should be posted publically (non-ephemeral). Default false.')
        .setRequired(false)),
    )
    .addSubcommand(subcommand => subcommand
      .setName('config')
      .setDescription('Updates the value of an existing Secret Santa config key.')
      .addStringOption(option => option
        .setName('key')
        .setDescription('The config key to update.')
        .setRequired(true))
      .addStringOption(option => option
        .setName('value')
        .setDescription('The new value to set for this key.')
        .setRequired(true)),
    ),
  async execute(interaction) {
    const client = interaction.client;
    const subcommand = interaction.options.getSubcommand();
    logger.debug(`Resolving subcommand: ${subcommand}`);

    if (!config.users.admins.includes(interaction.user.id)) {
      await interaction.reply({
        content: 'You do not have permission to run this command.',
        ephemeral: true,
      });
      return;
    }

    if (subcommand === 'start' || subcommand === 'reset') {
      await interaction.deferReply({ ephemeral: true });
      if (subcommand === 'start' && !(await SantaManager.started())) {
        const resp = await SantaManager.start(client);
        if (resp) {
          await interaction.followUp({
            content: 'Secret Santa has been started.',
            ephemeral: true,
          });
        } else {
          await interaction.followUp({
            content: 'Not enough users are registered to start.',
            ephemeral: true,
          });
        }
      } else if (subcommand === 'reset') {
        await SantaManager.reset();
        await interaction.followUp({
          content: 'Secret Santa has been reset.',
          ephemeral: true,
        });
      } else {
        await interaction.followUp({
          content: `[ERROR] The Secret Santa session is already in the state you are trying to set. Failed to ${subcommand}.`,
          ephemeral: true,
        });
      }
    } else if (subcommand === 'list') {
      const santaList = await SantaManager.getAll();
      const msg = santaList.reduce((list, santa) => `${list}  <@${santa.discordId}>`, '').trim();
      await interaction.reply({
        content: `Santas Registered: ${msg}`,
        ephemeral: true,
      });
    } else if (subcommand === 'blacklist') {
      const blacklists = await SantaManager.getBlacklists();
      const msg = Object.entries(blacklists).reduce((m, [santa, recList]) => `${m}\n<@${santa}>  \u2192  ${recList.map(r => `<@${r}>`).join('  ')}`, '').trim();
      await interaction.reply({
        content: `Santa \u2192 Banned Receiver\n${msg}`,
        ephemeral: true,
      });
    } else if (subcommand === 'selectedlist') {
      if (await SantaManager.started()) {
        const selectedPairs = await SantaManager.getSelectedPairs();
        const msg = Object.entries(selectedPairs).reduce((m, [santa, rec]) => `${m}\n\uD83C\uDF85 <@${santa}> \u27F6 \uD83C\uDF81 <@${rec}>`, '').trim();
        const isEphemeral = !interaction.options.getBoolean('public');
        await interaction.reply({
          content: msg,
          ephemeral: isEphemeral,
        });
      } else {
        await interaction.reply({
          content: '[ERROR] The Secret Santa session has not started yet. There are no pairs.',
          ephemeral: true,
        });
      }
    } else if (subcommand === 'config') {
      const key = interaction.options.getString('key');
      const value = interaction.options.getString('value');
      const updated = await SantaManager.updateConfig(key, value);
      if (updated) {
        await interaction.reply({
          content: `Config key \`${key}\` has been updated to \`${value}\`.`,
          ephemeral: true,
        });
      } else {
        const currentConfig = await SantaManager.getConfig();
        const existingKeys = Object.keys(currentConfig).join(', ');
        await interaction.reply({
          content: `[ERROR] Config key \`${key}\` does not exist. Existing keys: ${existingKeys}`,
          ephemeral: true,
        });
      }
    } else if (subcommand === 'giftlist') {
      if (await SantaManager.started()) {
        const giftTrackingList = await SantaManager.getGiftTrackingList();
        const friendlyStatus = {
          'NOT_SENT': '❌ Not Sent',
          'SENT': '📦 Sent',
          'DELIVERED': '🎁 Delivered',
        };
        const msg = giftTrackingList.reduce((m, item) => `${m}\n<@${item.receiver_id}>'s Santa Gift Status: **${friendlyStatus[item.gift_status]}** (<t:${item.gift_status_timestamp}:F>)`, '').trim();
        const isEphemeral = !interaction.options.getBoolean('public');
        await interaction.reply({
          content: msg || 'No tracking records found.',
          ephemeral: isEphemeral,
        });
      } else {
        await interaction.reply({
          content: '[ERROR] The Secret Santa session has not started yet.',
          ephemeral: true,
        });
      }
    }
  },
  async error(interaction, error) {
    logger.error(`Error executing ${interaction.commandName ?? interaction.customId}`);
    logger.error(error);
    const payload = {
      content: '[ERROR] Something went wrong while processing your request. Please try again.',
      ephemeral: true,
    };
    try {
      if (interaction.deferred || interaction.replied) {
        await interaction.followUp(payload);
      } else {
        await interaction.reply(payload);
      }
    } catch (notifyError) {
      logger.error('Failed to notify user of the above error:', notifyError);
    }
  },
};
