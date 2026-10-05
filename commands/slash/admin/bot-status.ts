import { ActivityType, MessageFlags, PermissionFlagsBits, type PresenceStatusData, SlashCommandBuilder } from "discord.js";
import type { ChatInputCommandInteraction } from "discord.js";
import type { SlashCommand } from "../../../utils/types.ts";
import config from "../../../config.ts";
import logger from "../../../utils/logger.ts";

export default {
  data: new SlashCommandBuilder()
    .setName("setpresence")
    .setDescription("Adjust the presence of the bot.")
    .addSubcommand((subcommand) =>
      subcommand
        .setName("activity")
        .setDescription("The activity of the bot.")
        .addStringOption((option) =>
          option
            .setName("name")
            .setDescription("The activity name.")
            .setRequired(true)
        )
        .addIntegerOption((option) =>
          option
            .setName("type")
            .setDescription("The activity type.")
            .addChoices(
              { name: "Playing", value: ActivityType.Playing },
              { name: "Watching", value: ActivityType.Watching },
              { name: "Listening to", value: ActivityType.Listening },
              { name: "Competing in", value: ActivityType.Competing },
              // Not allowed for bots
              // { name: 'Streaming', value: ActivityType.Streaming },
              // { name: 'Custom', value: ActivityType.Custom },
            )
            .setRequired(true)
        )
    )
    .addSubcommand((subcommand) =>
      subcommand
        .setName("status")
        .setDescription("The online status of the bot.")
        .addStringOption((option) =>
          option
            .setName("type")
            .setDescription("The online status to change to.")
            .addChoices(
              { name: "Online", value: "online" },
              { name: "Idle", value: "idle" },
              { name: "Do Not Disturb", value: "dnd" },
              { name: "Invisible", value: "invisible" },
            )
            .setRequired(true)
        )
    )
    .setDefaultMemberPermissions(PermissionFlagsBits.Administrator),
  async execute(interaction) {
    const client = interaction.client;
    const subcommand = interaction.options.getSubcommand();
    logger.debug(`Resolving subcommand: ${subcommand}`);

    if (!config.users.admins.includes(interaction.user.id)) {
      interaction.reply({
        content: "You do not have permission to run this command.",
        flags: MessageFlags.Ephemeral,
      });
    } else if (subcommand === "activity") {
      const name = interaction.options.getString("name", true);
      const type = interaction.options.getInteger("type", true);
      client.user.setActivity({ name, type });

      const reply = `Set ${subcommand} to "${name}" with type #${type}`;
      await interaction.reply({
        content: reply,
        flags: MessageFlags.Ephemeral,
      });
      logger.info(reply);
    } else if (subcommand === "status") {
      const type = interaction.options.getString("type", true) as PresenceStatusData;
      client.user.setStatus(type);

      const reply = `Set ${subcommand} to ${type}`;
      await interaction.reply({
        content: reply,
        flags: MessageFlags.Ephemeral,
      });
      logger.info(reply);
    }
  },
  // deno-lint-ignore require-await
  async error(interaction: ChatInputCommandInteraction, error: unknown) {
    logger.error(`Error executing ${interaction.commandName}`);
    logger.error(error);
  },
} satisfies SlashCommand;
