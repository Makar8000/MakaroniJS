import { SlashCommandBuilder } from 'discord.js';
import SantaManager from '../../../utils/santa/santa-manager.js';
import config from '../../../config.js';
import logger from '../../../utils/logger.js';

SantaManager.initSantas();

export default {
  data: new SlashCommandBuilder()
    .setName('ss')
    .setDescription('Secret Santa commands.')
    .addSubcommand(subcommand => subcommand
      .setName('santa')
      .setDescription('Send a message to your Secret Santa.')
      .addStringOption(option => option
        .setName('msg')
        .setDescription('The message to send.')
        .setRequired(true)),
    )
    .addSubcommand(subcommand => subcommand
      .setName('receiver')
      .setDescription('Send a message to your receiver anonymously.')
      .addStringOption(option => option
        .setName('msg')
        .setDescription('The message to send.')
        .setRequired(true)),
    )
    .addSubcommand(subcommand => subcommand
      .setName('channel')
      .setDescription('Send a message to the Secret Santa channel anonymously.')
      .addStringOption(option => option
        .setName('msg')
        .setDescription('The message to send.')
        .setRequired(true)),
    )
    .addSubcommand(subcommand => subcommand
      .setName('gift')
      .setDescription('Update your gift status milestone tracking details.')
      .addStringOption(option => option
        .setName('status')
        .setDescription('The milestone state.')
        .setRequired(true)
        .addChoices(
          { name: 'Not Sent', value: 'NOT_SENT' },
          { name: 'Sent', value: 'SENT' },
          { name: 'Delivered', value: 'DELIVERED' },
        )),
    )
    .addSubcommand(subcommand => subcommand
      .setName('register')
      .setDescription('Register for Secret Santa or update your registration information.')
      .addStringOption(option => option
        .setName('name')
        .setDescription('The name that you want to appear on your package(s).')
        .setRequired(true))
      .addStringOption(option => option
        .setName('address')
        .setDescription('The address your santa needs to send the package(s) to.')
        .setRequired(true))
      .addStringOption(option => option
        .setName('notes')
        .setDescription('A message for your Secret Santa (what not to buy & other notes).')
        .setRequired(true)),
    )
    .addSubcommand(subcommand => subcommand
      .setName('unregister')
      .setDescription('Unregister for Secret Santa.'),
    )
    .addSubcommand(subcommand => subcommand
      .setName('start')
      .setDescription('Starts the Secret Santa session. Admin-only.'),
    )
    .addSubcommand(subcommand => subcommand
      .setName('reset')
      .setDescription('Resets Secret Santa. Admin-only.'),
    )
    .addSubcommand(subcommand => subcommand
      .setName('list')
      .setDescription('Gets a list of users who are registered. Admin-only.'),
    )
    .addSubcommand(subcommand => subcommand
      .setName('blacklist')
      .setDescription('Gets a list of banned Secret Santa pairs. Admin-only.'),
    )
    .addSubcommand(subcommand => subcommand
      .setName('giftlist')
      .setDescription('Gets a list of gift shipment statuses. Admin-only.')
      .addBooleanOption(option => option
        .setName('public')
        .setDescription('Whether or not it should be posted publically (non-ephemeral). Default false.')
        .setRequired(false)),
    )
    .addSubcommand(subcommand => subcommand
      .setName('selectedlist')
      .setDescription('Gets a list of selected Secret Santa pairs. Admin-only.')
      .addBooleanOption(option => option
        .setName('public')
        .setDescription('Whether or not it should be posted publically (non-ephemeral). Default false.')
        .setRequired(false)),
    ),
  async execute(interaction) {
    const client = interaction.client;
    const subcommand = interaction.options.getSubcommand();
    const isAdmin = config.users.admins.includes(interaction.user.id);
    logger.debug(`Resolving subcommand: ${subcommand}`);

    if (subcommand === 'start' || subcommand === 'reset') {
      await interaction.deferReply({ ephemeral: true });
      if (!isAdmin) {
        interaction.followUp({
          content: 'You do not have permission to run this command.',
          ephemeral: true,
        });
      } else if (subcommand === 'start' && !(await SantaManager.started())) {
        const resp = await SantaManager.start(client);
        if (resp) {
          interaction.followUp({
            content: 'Secret Santa has been started.',
            ephemeral: true,
          });
        } else {
          interaction.followUp({
            content: 'Not enough users are registered to start.',
            ephemeral: true,
          });
        }
      } else if (subcommand === 'reset') {
        await SantaManager.reset();
        interaction.followUp({
          content: 'Secret Santa has been reset.',
          ephemeral: true,
        });
      } else {
        interaction.followUp({
          content: `[ERROR] The Secret Santa session is already in the state you are trying to set. Failed to ${subcommand}.`,
          ephemeral: true,
        });
      }
    } else if (subcommand.endsWith('register')) {
      if (await SantaManager.started()) {
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
        const added = await SantaManager.addSanta({
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
        const removed = await SantaManager.removeSanta(interaction.user.id);
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
    } else if (subcommand.endsWith('list')) {
      if (!isAdmin) {
        interaction.reply({
          content: 'You do not have permission to run this command.',
          ephemeral: true,
        });
      } else if (subcommand === 'list') {
        const santaList = await SantaManager.getAll();
        const msg = santaList.reduce((list, santa) => `${list}  <@${santa.discordId}>`, '').trim();
        interaction.reply({
          content: `Santas Registered: ${msg}`,
          ephemeral: true,
        });
      } else if (subcommand === 'blacklist') {
        const blacklists = await SantaManager.getBlacklists();
        const msg = Object.entries(blacklists).reduce((m, [santa, recList]) => `${m}\n<@${santa}>  \u2192  ${recList.map(r => `<@${r}>`).join('  ')}`, '').trim();
        interaction.reply({
          content: `Santa \u2192 Banned Receiver\n${msg}`,
          ephemeral: true,
        });
      } else if (subcommand === 'selectedlist') {
        if (await SantaManager.started()) {
          const selectedPairs = await SantaManager.getSelectedPairs();
          const msg = Object.entries(selectedPairs).reduce((m, [santa, rec]) => `${m}\n\uD83C\uDF85 <@${santa}> \u27F6 \uD83C\uDF81 <@${rec}>`, '').trim();
          const isEphemeral = !interaction.options.getBoolean('public');
          interaction.reply({
            content: msg,
            ephemeral: isEphemeral,
          });
        } else {
          interaction.reply({
            content: '[ERROR] The Secret Santa session has not started yet. There are no pairs.',
            ephemeral: true,
          });
        }
      } else if (subcommand === 'giftlist') {
        if (await SantaManager.started()) {
          const giftTrackingList = await SantaManager.getGiftTrackingList();
          const friendlyStatus = {
            'NOT_SENT': 'Not Sent ❌',
            'SENT': 'Sent 📦',
            'DELIVERED': 'Delivered 🎁',
          };
          const msg = giftTrackingList.reduce((m, item) => `${m}\n<@${item.receiver_id}>'s Santa Gift Status: **${friendlyStatus[item.gift_status]}** (<t:${item.gift_status_timestamp}:F>)`, '').trim();
          const isEphemeral = !interaction.options.getBoolean('public');
          interaction.reply({
            content: msg || 'No tracking records found.',
            ephemeral: isEphemeral,
          });
        } else {
          interaction.reply({
            content: '[ERROR] The Secret Santa session has not started yet.',
            ephemeral: true,
          });
        }
      }
    } else if (subcommand === 'gift') {
      if (!(await SantaManager.isRegistered(interaction.user.id))) {
        interaction.reply({
          content: '[ERROR] You are not registered.',
          ephemeral: true,
        });
        return;
      }

      if (!(await SantaManager.started())) {
        interaction.reply({
          content: '[ERROR] The Secret Santa session has not started yet.',
          ephemeral: true,
        });
        return;
      }

      const targetStatus = interaction.options.getString('status');
      const updated = await SantaManager.updateGiftStatus(interaction.user.id, targetStatus);
      if (updated) {
        interaction.reply({
          content: `Successfully updated tracking gift status to: **${targetStatus}**`,
          ephemeral: true,
        });
      } else {
        interaction.reply({
          content: '[ERROR] Gift milestone update failed.',
          ephemeral: true,
        });
      }
    } else {
      if (!(await SantaManager.isRegistered(interaction.user.id))) {
        interaction.reply({
          content: '[ERROR] You are not registered.',
          ephemeral: true,
        });
        return;
      }

      if (!(await SantaManager.started())) {
        interaction.reply({
          content: '[ERROR] The Secret Santa session has not started yet. Unable to send message.',
          ephemeral: true,
        });
        return;
      }

      await interaction.deferReply({ ephemeral: true });
      const msg = interaction.options.getString('msg');
      try {
        if (subcommand === 'channel') {
          logger.debug('Sending message to channel...');
          const channel = await client.channels.fetch(await SantaManager.getChannelId());
          const modifiedText = await SantaManager.logAndTransformMessage(interaction.user.id, 'SANTA_TO_PUBLIC', msg);
          const embed = await SantaManager.getEmbedForMessage(modifiedText);
          embed.setTimestamp();
          await channel.send({
            embeds: [embed],
          });
        } else if (subcommand === 'santa') {
          logger.debug('Sending message to santa...');
          const channel = await client.users.fetch(await SantaManager.getSanta(interaction.user.id));
          const embed = await SantaManager.getEmbedForMessage(msg, interaction.user);
          embed.setFooter({
            text: 'You can reply using `/ss receiver <msg>`',
          });
          await channel.send({
            embeds: [embed],
          });
          await SantaManager.logAndTransformMessage(interaction.user.id, 'RECEIVER_TO_SANTA', msg);
        } else if (subcommand === 'receiver') {
          logger.debug('Sending message to receiver...');
          const channel = await client.users.fetch(await SantaManager.getReceiver(interaction.user.id));
          const modifiedText = await SantaManager.logAndTransformMessage(interaction.user.id, 'SANTA_TO_RECEIVER', msg);
          const embed = await SantaManager.getEmbedForMessage(modifiedText);
          embed.setFooter({
            text: 'You can reply using `/ss santa <msg>`',
          });
          await channel.send({
            embeds: [embed],
          });
        }
        interaction.followUp({
          content: 'Success',
          ephemeral: true,
        });
        interaction.user.send({
          content: `Sent the following message to ${subcommand}:\n${msg}`,
        });
      } catch (error) {
        logger.error(error);
        interaction.followUp({
          content: `[ERROR] There was an issue sending your message to ${subcommand}.\nMessage: ${msg}`,
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