import type { ButtonInteraction, ChatInputCommandInteraction } from "discord.js";
import { MessageFlags, PermissionFlagsBits, SlashCommandBuilder } from "discord.js";
import config from "../../../config.ts";
import logger from "../../../utils/logger.ts";
import type { SlashCommand } from "../../../utils/types.ts";
import wallpaperConfig from "../../../utils/wallpapers/config.ts";
import WallpaperInteractions from "../../../utils/wallpapers/wallpaper-interactions.ts";
import wallpapers from "../../../utils/wallpapers/wallpapers.ts";

export default {
  data: new SlashCommandBuilder()
    .setName("wallpaper")
    .setDescription("Manage wallpapers.")
    .setDefaultMemberPermissions(PermissionFlagsBits.Administrator)
    .addSubcommand((sub) =>
      sub
        .setName("list")
        .setDescription("Browse enabled wallpapers.")
        .addStringOption((o) =>
          o
            .setName("tags")
            .setDescription("Space-delimited tags.")
            .setMaxLength(wallpaperConfig.listOptions.maxFilterChars),
        ),
    )
    .addSubcommand((sub) =>
      sub
        .setName("add")
        .setDescription("Add a wallpaper.")
        .addStringOption((o) => o.setName("file-url").setDescription("Image URL.").setRequired(true))
        .addStringOption((o) => o.setName("title").setDescription("Title.").setRequired(true))
        .addStringOption((o) => o.setName("tags").setDescription("Space-delimited tags.").setRequired(true))
        .addBooleanOption((o) => o.setName("enabled").setDescription("Enabled? (default true)")),
    )
    .addSubcommand((sub) =>
      sub
        .setName("edit")
        .setDescription("Edit a wallpaper. Only provided fields change.")
        .addIntegerOption((o) => o.setName("id").setDescription("Wallpaper ID.").setRequired(true))
        .addStringOption((o) => o.setName("file-url").setDescription("Image URL."))
        .addStringOption((o) => o.setName("title").setDescription("Title."))
        .addStringOption((o) => o.setName("tags").setDescription("Space-delimited tags."))
        .addBooleanOption((o) => o.setName("enabled").setDescription("Enabled?")),
    )
    .addSubcommand((sub) =>
      sub
        .setName("delete")
        .setDescription("Delete a wallpaper.")
        .addIntegerOption((o) => o.setName("id").setDescription("Wallpaper ID.").setRequired(true)),
    ),
  async execute(interaction) {
    if (!config.users.admins.includes(interaction.user.id)) {
      await interaction.reply({
        content: "You do not have permission to run this command.",
        flags: MessageFlags.Ephemeral,
      });
      return;
    }
    await interaction.deferReply({ flags: MessageFlags.Ephemeral });
    const opts = interaction.options;

    switch (opts.getSubcommand()) {
      case "list": {
        const page = await WallpaperInteractions.buildListPage(
          opts.getString("tags") ?? "",
          0,
          wallpaperConfig.listOptions.pageSize,
        );
        await interaction.editReply(page);
        break;
      }
      case "add": {
        const r = await wallpapers.create({
          file_url: opts.getString("file-url", true),
          title: opts.getString("title", true),
          tags: opts.getString("tags", true),
          enabled: opts.getBoolean("enabled") ?? true,
        });
        await interaction.editReply(
          r.data
            ? { embeds: [wallpaperConfig.createEmbed(r.data, "Wallpaper added")] }
            : wallpaperConfig.formatError(r),
        );
        break;
      }
      case "edit": {
        const patch = {
          file_url: opts.getString("file-url") ?? undefined,
          title: opts.getString("title") ?? undefined,
          tags: opts.getString("tags") ?? undefined,
          enabled: opts.getBoolean("enabled") ?? undefined,
        };
        if (Object.values(patch).every((v) => v === undefined)) {
          await interaction.editReply("Nothing to update.");
          return;
        }
        const r = await wallpapers.update(opts.getInteger("id", true), patch);
        await interaction.editReply(
          r.data
            ? { embeds: [wallpaperConfig.createEmbed(r.data, "Wallpaper updated")] }
            : wallpaperConfig.formatError(r),
        );
        break;
      }
      case "delete": {
        const id = opts.getInteger("id", true);
        const r = await wallpapers.remove(id);
        await interaction.editReply(r.ok ? `Deleted #${id}.` : wallpaperConfig.formatError(r));
        break;
      }
    }
  },
  /** Pagination buttons. customId format: wallpaper:page:<offset>:<limit>:<label>:<tags> */
  async button(interaction) {
    const [, action, offset, limit, , ...tags] = interaction.customId.split(":");
    if (action !== "page") {
      return;
    }
    if (!config.users.admins.includes(interaction.user.id)) {
      await interaction.reply({
        content: "You do not have permission to use this.",
        flags: MessageFlags.Ephemeral,
      });
      return;
    }
    // Tags are last because they may themselves contain ":".
    const page = await WallpaperInteractions.buildListPage(tags.join(":"), Number(offset), Number(limit));
    if (typeof page === "string") {
      // A Components V2 message can't hold plain content, so report failures separately.
      await interaction.reply({ content: page, flags: MessageFlags.Ephemeral });
      return;
    }
    await interaction.update(page);
  },
  async error(interaction: ChatInputCommandInteraction | ButtonInteraction, error: unknown) {
    logger.error(`Error executing ${"commandName" in interaction ? interaction.commandName : interaction.customId}`);
    logger.error(error);
  },
} satisfies SlashCommand;
