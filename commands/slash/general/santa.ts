import { DiscordAPIError, MessageFlags, RESTJSONErrorCodes, SlashCommandBuilder, type StringSelectMenuInteraction } from "discord.js";
import type { SlashCommand } from "../../../utils/types.ts";
import SantaManager from "../../../utils/santa/santa-manager.ts";
import SantaMessaging from "../../../utils/santa/santa-interactions.ts";
import logger from "../../../utils/logger.ts";

export default {
  data: new SlashCommandBuilder()
    .setName("ss")
    .setDescription("Secret Santa commands.")
    .addSubcommand((subcommand) =>
      subcommand
        .setName("msg")
        .setDescription("Compose a Secret Santa message.")
    )
    .addSubcommand((subcommand) =>
      subcommand
        .setName("gift")
        .setDescription("Update your gift status milestone tracking details.")
        .addStringOption((option) =>
          option
            .setName("status")
            .setDescription("The milestone state.")
            .setRequired(true)
            .addChoices(...Object.entries(SantaMessaging.GIFT_STATUS_LABEL).map(([value, name]) => ({ name, value })))
        )
    )
    .addSubcommand((subcommand) =>
      subcommand
        .setName("register")
        .setDescription("Register for Secret Santa or update your registration information.")
    )
    .addSubcommand((subcommand) =>
      subcommand
        .setName("unregister")
        .setDescription("Unregister for Secret Santa.")
    ),
  async execute(interaction) {
    const subcommand = interaction.options.getSubcommand();
    logger.debug(`Resolving subcommand: ${subcommand}`);

    if (subcommand.endsWith("register")) {
      if (SantaManager.started()) {
        await interaction.reply({
          content: `[ERROR] The Secret Santa session has already started. Failed to ${subcommand}.`,
          flags: MessageFlags.Ephemeral,
        });
        return;
      }

      if (subcommand === "register") {
        const existing = SantaManager.getParticipant(interaction.user.id);
        logger.debug("Showing register modal...");
        await interaction.showModal(SantaMessaging.buildRegisterModal(existing));
      } else if (subcommand === "unregister") {
        const removed = SantaManager.removeSanta(interaction.user.id);
        if (removed) {
          await interaction.reply({
            content: "Successfully unregistered.",
            flags: MessageFlags.Ephemeral,
          });
        } else {
          await interaction.reply({
            content: "[ERROR] You are not registered.",
            flags: MessageFlags.Ephemeral,
          });
        }
      }
    } else if (subcommand === "gift") {
      if (!SantaManager.isRegistered(interaction.user.id)) {
        await interaction.reply({
          content: "[ERROR] You are not registered.",
          flags: MessageFlags.Ephemeral,
        });
        return;
      }

      if (!SantaManager.started()) {
        await interaction.reply({
          content: "[ERROR] The Secret Santa session has not started yet.",
          flags: MessageFlags.Ephemeral,
        });
        return;
      }

      const targetStatus = interaction.options.getString("status", true);
      SantaManager.updateGiftStatus(interaction.user.id, targetStatus);
      await interaction.reply({
        content: `Successfully updated tracking gift status to: **${targetStatus}**`,
        flags: MessageFlags.Ephemeral,
      });
    } else if (subcommand === "msg") {
      if (!SantaManager.isRegistered(interaction.user.id)) {
        await interaction.reply({
          content: "[ERROR] You are not registered.",
          flags: MessageFlags.Ephemeral,
        });
        return;
      }

      if (!SantaManager.started()) {
        await interaction.reply({
          content: "[ERROR] The Secret Santa session has not started yet. Unable to send message.",
          flags: MessageFlags.Ephemeral,
        });
        return;
      }

      logger.debug("Showing message target select menu...");
      await interaction.reply({
        content: "Who do you want to message?",
        components: [await SantaMessaging.buildTargetSelectRow(interaction.client, interaction.user.id)],
        flags: MessageFlags.Ephemeral,
      });
    }
  },
  /**
   * Handles select menu interactions namespaced under this command.
   * Currently only utilized by `/ss msg`.
   * @param {StringSelectMenuInteraction} interaction The select menu interaction to handle.
   */
  async selectMenu(interaction: StringSelectMenuInteraction) {
    const [, action] = interaction.customId.split(":");
    if (action !== "msgtarget") {
      return;
    }

    const target = SantaMessaging.parseTargetSelection(interaction);
    const modal = await SantaMessaging.buildComposeModal(interaction.client, target, interaction.user.id);
    if (!modal) {
      await interaction.update({
        content: "[ERROR] There are no other registered users to message.",
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
    const [, action, direction, targetId, rpMode] = interaction.customId.split(":");
    if (action !== "reply") {
      return;
    }

    if (!SantaManager.isRegistered(interaction.user.id)) {
      await interaction.reply({
        content: "[ERROR] You are not registered.",
        flags: MessageFlags.Ephemeral,
      });
      return;
    }

    if (!SantaManager.started()) {
      await interaction.reply({
        content: "[ERROR] The Secret Santa session has not started yet. Unable to send message.",
        flags: MessageFlags.Ephemeral,
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
    const [, action] = interaction.customId.split(":");
    if (action === "registermodal") {
      if (SantaManager.started()) {
        await interaction.reply({
          content: "[ERROR] The Secret Santa session has already started. Failed to register.",
          flags: MessageFlags.Ephemeral,
        });
        return;
      }

      const { name, address, notes } = SantaMessaging.parseRegistrationSubmission(interaction);
      const added = SantaManager.addSanta({
        discordId: interaction.user.id,
        name,
        address,
        notes,
      });
      await interaction.reply({
        content: added ? "Successfully registered." : "Successfully updated registration.",
        flags: MessageFlags.Ephemeral,
      });
      return;
    }

    const { direction, targetId, rpMode, msg, error } = SantaMessaging.parseModalSubmission(interaction);
    if (error) {
      await interaction.reply({
        content: `[ERROR] ${error}`,
        flags: MessageFlags.Ephemeral,
      });
      return;
    }

    await interaction.deferReply({ flags: MessageFlags.Ephemeral });
    try {
      await SantaMessaging.sendSantaMessage(interaction, direction, targetId, rpMode, msg);
    } catch (err) {
      logger.error(err);
      const label = SantaMessaging.DIRECTION_LABEL[direction];
      const reason = err instanceof DiscordAPIError && err.code === RESTJSONErrorCodes.CannotSendMessagesToThisUser
        ? `The ${label} has their DMs closed, so your message could not be delivered.`
        : `There was an issue sending your message to ${label}.`;
      await interaction.followUp({
        content: `[ERROR] ${reason}\nMessage: ${msg}`,
        flags: MessageFlags.Ephemeral,
      });
    }
  },
  error: SantaMessaging.handleError,
} satisfies SlashCommand;
