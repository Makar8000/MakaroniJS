import { MessageFlags, SlashCommandBuilder } from 'discord.js';
import SantaManager from '../../../utils/santa/santa-manager.js';
import SantaMessaging from '../../../utils/santa/santa-interactions.js';
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
      .setName('msg-all')
      .setDescription('Sends a message from Santa to every registered santa.')
      .addStringOption(option => option
        .setName('message')
        .setDescription('The message to send.')
        .setMaxLength(2000)
        .setRequired(true)),
    )
    .addSubcommand(subcommand => subcommand
      .setName('resend-pairs')
      .setDescription('Re-sends every santa the receiver they were selected for.'),
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
        flags: MessageFlags.Ephemeral,
      });
      return;
    }

    if (subcommand === 'start' || subcommand === 'reset') {
      await interaction.deferReply({ flags: MessageFlags.Ephemeral });
      if (subcommand === 'start' && !SantaManager.started()) {
        const resp = await SantaManager.start(client);
        if (resp) {
          await interaction.followUp({
            content: `Secret Santa has been started.${SantaMessaging.dmFailedWarning(resp.failed)}`,
            flags: MessageFlags.Ephemeral,
            allowedMentions: { parse: [] },
          });
        } else {
          await interaction.followUp({
            content: 'Not enough users are registered to start.',
            flags: MessageFlags.Ephemeral,
          });
        }
      } else if (subcommand === 'reset') {
        SantaManager.reset();
        await interaction.followUp({
          content: 'Secret Santa has been reset.',
          flags: MessageFlags.Ephemeral,
        });
      } else {
        await interaction.followUp({
          content: `[ERROR] The Secret Santa session is already in the state you are trying to set. Failed to ${subcommand}.`,
          flags: MessageFlags.Ephemeral,
        });
      }
    } else if (subcommand === 'msg-all') {
      await interaction.deferReply({ flags: MessageFlags.Ephemeral });
      const { sent, failed } = await SantaManager.messageAll(client, interaction.options.getString('message'));
      await interaction.followUp({
        content: `Message sent to ${sent} santa(s).${SantaMessaging.dmFailedWarning(failed)}`,
        flags: MessageFlags.Ephemeral,
        allowedMentions: { parse: [] },
      });
    } else if (subcommand === 'resend-pairs') {
      await interaction.deferReply({ flags: MessageFlags.Ephemeral });
      const resp = await SantaManager.resendPairs(client);
      await interaction.followUp({
        content: resp
          ? `Pairs re-sent.${SantaMessaging.dmFailedWarning(resp.failed)}`
          : '[ERROR] The Secret Santa session has not started yet. There are no pairs.',
        flags: MessageFlags.Ephemeral,
        allowedMentions: { parse: [] },
      });
    } else if (subcommand === 'list') {
      const santaList = SantaManager.getAll();
      const msg = santaList.reduce((list, santa) => `${list}  <@${santa.discordId}>`, '').trim();
      await interaction.reply({
        content: `Santas Registered: ${msg}`,
        flags: MessageFlags.Ephemeral,
      });
    } else if (subcommand === 'blacklist') {
      const blacklists = SantaManager.getBlacklists();
      const msg = Object.entries(blacklists).reduce((m, [santa, recList]) => `${m}\n<@${santa}>  \u2192  ${recList.map(r => `<@${r}>`).join('  ')}`, '').trim();
      await interaction.reply({
        content: `Santa \u2192 Banned Receiver\n${msg}`,
        flags: MessageFlags.Ephemeral,
      });
    } else if (subcommand === 'selectedlist') {
      if (SantaManager.started()) {
        const selectedPairs = SantaManager.getSelectedPairs();
        const msg = Object.entries(selectedPairs).reduce((m, [santa, rec]) => `${m}\n\uD83C\uDF85 <@${santa}> \u27F6 \uD83C\uDF81 <@${rec}>`, '').trim();
        const isEphemeral = !interaction.options.getBoolean('public');
        await interaction.reply({
          content: msg,
          flags: isEphemeral ? MessageFlags.Ephemeral : undefined,
          allowedMentions: { parse: [] },
        });
      } else {
        await interaction.reply({
          content: '[ERROR] The Secret Santa session has not started yet. There are no pairs.',
          flags: MessageFlags.Ephemeral,
        });
      }
    } else if (subcommand === 'config') {
      const key = interaction.options.getString('key');
      const value = interaction.options.getString('value');
      const updated = SantaManager.updateConfig(key, value);
      if (updated) {
        await interaction.reply({
          content: `Config key \`${key}\` has been updated to \`${value}\`.`,
          flags: MessageFlags.Ephemeral,
        });
      } else {
        const currentConfig = SantaManager.getConfig();
        const existingKeys = Object.keys(currentConfig).join(', ');
        await interaction.reply({
          content: `[ERROR] Config key \`${key}\` does not exist. Existing keys: ${existingKeys}`,
          flags: MessageFlags.Ephemeral,
        });
      }
    } else if (subcommand === 'giftlist') {
      if (SantaManager.started()) {
        const giftTrackingList = SantaManager.getGiftTrackingList();
        const msg = giftTrackingList.reduce((m, item) => `${m}\n<@${item.receiver_id}>'s Santa Gift Status: **${SantaMessaging.GIFT_STATUS_LABEL[item.gift_status]}** (<t:${item.gift_status_timestamp}:F>)`, '').trim();
        const isEphemeral = !interaction.options.getBoolean('public');
        await interaction.reply({
          content: msg || 'No tracking records found.',
          flags: isEphemeral ? MessageFlags.Ephemeral : undefined,
          allowedMentions: { parse: [] },
        });
      } else {
        await interaction.reply({
          content: '[ERROR] The Secret Santa session has not started yet.',
          flags: MessageFlags.Ephemeral,
        });
      }
    }
  },
  error: SantaMessaging.handleError,
};
