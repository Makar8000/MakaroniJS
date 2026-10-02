import { SlashCommandBuilder } from 'discord.js';
import SantaManager from '../../../utils/santa/santa-manager.js';
import SantaMessaging from '../../../utils/santa/santa-interactions.js';
import logger from '../../../utils/logger.js';

SantaManager.initSantas();

export default {
  data: new SlashCommandBuilder()
    .setName('ss')
    .setDescription('Secret Santa commands.')
    .addSubcommand(subcommand => subcommand
      .setName('msg')
      .setDescription('Compose a Secret Santa message.'),
    )
    .addSubcommand(subcommand => subcommand
      .setName('gift')
      .setDescription('Update your gift status milestone tracking details.')
      .addStringOption(option => option
        .setName('status')
        .setDescription('The milestone state.')
        .setRequired(true)
        .addChoices(
          { name: '❌ Not Sent', value: 'NOT_SENT' },
          { name: '📦 Sent', value: 'SENT' },
          { name: '🎁 Delivered', value: 'DELIVERED' },
        )),
    )
    .addSubcommand(subcommand => subcommand
      .setName('register')
      .setDescription('Register for Secret Santa or update your registration information.'),
    )
    .addSubcommand(subcommand => subcommand
      .setName('unregister')
      .setDescription('Unregister for Secret Santa.'),
    ),
  async execute(interaction) {
    const subcommand = interaction.options.getSubcommand();
    logger.debug(`Resolving subcommand: ${subcommand}`);

    if (subcommand.endsWith('register')) {
      if (await SantaManager.started()) {
        await interaction.reply({
          content: `[ERROR] The Secret Santa session has already started. Failed to ${subcommand}.`,
          ephemeral: true,
        });
        return;
      }

      if (subcommand === 'register') {
        const existing = await SantaManager.getParticipant(interaction.user.id);
        logger.debug('Showing register modal...');
        await interaction.showModal(SantaMessaging.buildRegisterModal(existing));
      } else if (subcommand === 'unregister') {
        const removed = await SantaManager.removeSanta(interaction.user.id);
        if (removed) {
          await interaction.reply({
            content: 'Successfully unregistered.',
            ephemeral: true,
          });
        } else {
          await interaction.reply({
            content: '[ERROR] You are not registered.',
            ephemeral: true,
          });
        }
      }
    } else if (subcommand === 'gift') {
      if (!(await SantaManager.isRegistered(interaction.user.id))) {
        await interaction.reply({
          content: '[ERROR] You are not registered.',
          ephemeral: true,
        });
        return;
      }

      if (!(await SantaManager.started())) {
        await interaction.reply({
          content: '[ERROR] The Secret Santa session has not started yet.',
          ephemeral: true,
        });
        return;
      }

      const targetStatus = interaction.options.getString('status');
      const updated = await SantaManager.updateGiftStatus(interaction.user.id, targetStatus);
      if (updated) {
        await interaction.reply({
          content: `Successfully updated tracking gift status to: **${targetStatus}**`,
          ephemeral: true,
        });
      } else {
        await interaction.reply({
          content: '[ERROR] Gift milestone update failed.',
          ephemeral: true,
        });
      }
    } else if (subcommand === 'msg') {
      if (!(await SantaManager.isRegistered(interaction.user.id))) {
        await interaction.reply({
          content: '[ERROR] You are not registered.',
          ephemeral: true,
        });
        return;
      }

      if (!(await SantaManager.started())) {
        await interaction.reply({
          content: '[ERROR] The Secret Santa session has not started yet. Unable to send message.',
          ephemeral: true,
        });
        return;
      }

      logger.debug('Showing message target select menu...');
      await interaction.reply({
        content: 'Who do you want to message?',
        components: [await SantaMessaging.buildTargetSelectRow(interaction.client, interaction.user.id)],
        ephemeral: true,
      });
    }
  },
  /**
   * Handles select menu interactions namespaced under this command.
   * Currently only utilized by `/ss msg`.
   * @param {StringSelectMenuInteraction} interaction The select menu interaction to handle.
   */
  async selectMenu(interaction) {
    const [, action] = interaction.customId.split(':');
    if (action !== 'msgtarget') {
      return;
    }

    const target = SantaMessaging.parseTargetSelection(interaction);
    const modal = await SantaMessaging.buildComposeModal(target, interaction.user.id);
    if (!modal) {
      await interaction.update({
        content: '[ERROR] There are no other registered users to message.',
        components: [],
      });
      return;
    }

    logger.debug(`Showing compose modal for target: ${target}`);
    await interaction.showModal(modal);
  },
  /**
   * Handles button interactions namespaced under this command.
   * Currently only utilized by `/ss msg` for the Reply button.
   * @param {ButtonInteraction} interaction The button interaction to handle.
   */
  async button(interaction) {
    const [, action, direction, targetId, rpMode] = interaction.customId.split(':');
    if (action !== 'reply') {
      return;
    }

    if (!(await SantaManager.isRegistered(interaction.user.id))) {
      await interaction.reply({
        content: '[ERROR] You are not registered.',
        ephemeral: true,
      });
      return;
    }

    if (!(await SantaManager.started())) {
      await interaction.reply({
        content: '[ERROR] The Secret Santa session has not started yet. Unable to send message.',
        ephemeral: true,
      });
      return;
    }

    logger.debug(`Showing reply modal for direction: ${direction}`);
    await interaction.showModal(SantaMessaging.buildReplyModal(direction, targetId, rpMode));
  },
  /**
   * Handles modal submissions namespaced under this command.
   * @param {ModalSubmitInteraction} interaction The modal submit interaction to handle.
   */
  async modalSubmit(interaction) {
    const [, action] = interaction.customId.split(':');
    if (action === 'registermodal') {
      if (await SantaManager.started()) {
        await interaction.reply({
          content: '[ERROR] The Secret Santa session has already started. Failed to register.',
          ephemeral: true,
        });
        return;
      }

      const { name, address, notes } = SantaMessaging.parseRegistrationSubmission(interaction);
      const added = await SantaManager.addSanta({
        discordId: interaction.user.id,
        name, address, notes,
      });
      await interaction.reply({
        content: added ? 'Successfully registered.' : 'Successfully updated registration.',
        ephemeral: true,
      });
      return;
    }

    const { direction, targetId, rpMode, msg, error } = await SantaMessaging.parseModalSubmission(interaction);
    if (error) {
      await interaction.reply({
        content: `[ERROR] ${error}`,
        ephemeral: true,
      });
      return;
    }

    await interaction.deferReply({ ephemeral: true });
    try {
      await SantaMessaging.sendSantaMessage(interaction, direction, targetId, rpMode, msg);
    } catch (err) {
      logger.error(err);
      await interaction.followUp({
        content: `[ERROR] There was an issue sending your message to ${SantaMessaging.DIRECTION_LABEL[direction]}.\nMessage: ${msg}`,
        ephemeral: true,
      });
    }
  },
  /**
   * Handles errors thrown by execute/button/modalSubmit, notifying the user.
   * @param {Interaction} interaction The interaction that was being handled when the error occurred.
   * @param {Error} error The error that was thrown.
   */
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
