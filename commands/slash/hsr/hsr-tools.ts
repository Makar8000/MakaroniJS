import { MessageFlags, SlashCommandBuilder } from "discord.js";
import type { ChatInputCommandInteraction } from "discord.js";
import type { SlashCommand } from "../../../utils/types.ts";
import HSRManager from "../../../utils/hsr/hsr-manager.ts";
import logger from "../../../utils/logger.ts";
import { messages } from "../../../utils/hsr/config.ts";

export default {
  data: new SlashCommandBuilder()
    .setName("hsr")
    .setDescription("Various tools for HSR.")
    .addSubcommand((subcommand) =>
      subcommand
        .setName("inclination")
        .setDescription("Get notifications when new patch data contains changes for inclination text.")
        .addIntegerOption((option) =>
          option
            .setName("action")
            .setDescription("Are you subscribing or unsubscribing?")
            .addChoices(
              { name: "Subscribe", value: 1 },
              { name: "Unsubscribe", value: 0 },
            )
            .setRequired(true)
        )
    )
    .addSubcommand((subcommand) =>
      subcommand
        .setName("b-role")
        .setDescription("Get notifications when new b___ roles are assigned.")
        .addIntegerOption((option) =>
          option
            .setName("action")
            .setDescription("Are you subscribing or unsubscribing?")
            .addChoices(
              { name: "Subscribe", value: 1 },
              { name: "Unsubscribe", value: 0 },
            )
            .setRequired(true)
        )
    ),
  async execute(interaction) {
    await interaction.deferReply({ flags: MessageFlags.Ephemeral });
    const client = interaction.client;
    const subcommand = interaction.options.getSubcommand();
    logger.debug(`Resolving subcommand: ${subcommand}`);

    if (subcommand === "inclination") {
      const subscribe = interaction.options.getInteger("action");
      if (subscribe) {
        const resp = await HSRManager.scheduleInclinationCheck(client, interaction.user.id);
        if (resp) {
          await interaction.followUp({
            content: messages.subscribeSuccess,
            flags: MessageFlags.Ephemeral,
          });
        } else {
          await interaction.followUp({
            content: messages.subscribeError,
            flags: MessageFlags.Ephemeral,
          });
        }
      } else {
        const resp = await HSRManager.cancelInclinationCheck(interaction.user.id);
        if (resp) {
          await interaction.followUp({
            content: messages.unsubscribeSuccess,
            flags: MessageFlags.Ephemeral,
          });
        } else {
          await interaction.followUp({
            content: messages.unsubscribeError,
            flags: MessageFlags.Ephemeral,
          });
        }
      }
    } else if (subcommand === "b-role") {
      const subscribe = interaction.options.getInteger("action");
      if (subscribe) {
        const resp = await HSRManager.scheduleRoleCheck(client, interaction.user.id);
        if (resp) {
          await interaction.followUp({
            content: messages.subscribeSuccess,
            flags: MessageFlags.Ephemeral,
          });
        } else {
          await interaction.followUp({
            content: messages.subscribeError,
            flags: MessageFlags.Ephemeral,
          });
        }
      } else {
        const resp = await HSRManager.cancelRoleCheck(interaction.user.id);
        if (resp) {
          await interaction.followUp({
            content: messages.unsubscribeSuccess,
            flags: MessageFlags.Ephemeral,
          });
        } else {
          await interaction.followUp({
            content: messages.unsubscribeError,
            flags: MessageFlags.Ephemeral,
          });
        }
      }
    }
  },
  // deno-lint-ignore require-await
  async error(interaction: ChatInputCommandInteraction, error: unknown) {
    logger.error(`Error executing ${interaction.commandName}`);
    logger.error(error);
  },
} satisfies SlashCommand;
