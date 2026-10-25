import {
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  ContainerBuilder,
  EmbedBuilder,
  MediaGalleryBuilder,
  MediaGalleryItemBuilder,
  MessageFlags,
  SeparatorBuilder,
  TextDisplayBuilder,
} from "discord.js";
import { truncate } from "../common.ts";
import type { ApiResult, Wallpaper, WallpaperDomain } from "../types.ts";

/** Namespace prefix for customIds, matching the `/wallpaper` command name. */
const COMMAND_NAME = "wallpaper";

const embedOptions = Object.freeze({
  color: 0x9b59b6,
  fieldTags: "Tags",
  fieldEnabled: "Enabled",
  noTags: "None",
  disabledMark: " *(disabled)*",
  titleChars: 200,
  tagChars: 300,
});

const listOptions = Object.freeze({
  pageSize: 9,
  titleChars: 150,
  tagChars: 100,
  altChars: 1024,
  /**
   * Max characters of the `tags` filter. It is carried in each button's customId (100 chars max) after the
   * `wallpaper:page:<offset>:<limit>:<label>:` prefix, which is at most ~35 characters.
   */
  maxFilterChars: 60,
});

/** An embed for one wallpaper, with the image as a thumbnail and the title linking to the file. */
const createEmbed = (w: Wallpaper, heading?: string) => {
  const embed = new EmbedBuilder()
    .setColor(embedOptions.color)
    .setTitle(truncate(`#${w.id} ${w.tag_string}`, embedOptions.titleChars))
    .setURL(w.file_url)
    .setThumbnail(w.file_url)
    .addFields(
      {
        name: embedOptions.fieldTags,
        value: truncate(w.tags.trim(), embedOptions.tagChars) || embedOptions.noTags,
      },
      { name: embedOptions.fieldEnabled, value: w.enabled ? "Yes" : "No" },
    );
  if (heading) {
    embed.setAuthor({ name: heading });
  }
  return embed;
};

/** First/prev/indicator/next/last buttons. Page state lives in the customId: `wallpaper:page:<offset>:<limit>:<label>:<tags>`. */
const createPagination = (offset: number, limit: number, total: number, tags = "") => {
  const page = Math.floor(offset / limit);
  const pageCount = Math.max(1, Math.ceil(total / limit));
  const atStart = page <= 0;
  const atEnd = page >= pageCount - 1;
  // The trailing label keeps customIds unique (e.g. "first" and "prev" can target the same page).
  // Tags go last because they may contain ":".
  const id = (target: number, label: string) =>
    `${COMMAND_NAME}:page:${Math.max(0, target) * limit}:${limit}:${label}:${tags}`;
  return new ActionRowBuilder<ButtonBuilder>().addComponents(
    new ButtonBuilder().setCustomId(id(0, "first")).setEmoji("⏮️").setStyle(ButtonStyle.Secondary).setDisabled(atStart),
    new ButtonBuilder()
      .setCustomId(id(page - 1, "prev"))
      .setEmoji("◀️")
      .setStyle(ButtonStyle.Primary)
      .setDisabled(atStart),
    new ButtonBuilder()
      .setCustomId(`${COMMAND_NAME}:indicator`)
      .setLabel(`${page + 1} / ${pageCount}`)
      .setStyle(ButtonStyle.Secondary)
      .setDisabled(true),
    new ButtonBuilder()
      .setCustomId(id(page + 1, "next"))
      .setEmoji("▶️")
      .setStyle(ButtonStyle.Primary)
      .setDisabled(atEnd),
    new ButtonBuilder()
      .setCustomId(id(pageCount - 1, "last"))
      .setEmoji("⏭️")
      .setStyle(ButtonStyle.Secondary)
      .setDisabled(atEnd),
  );
};

/** A Components V2 message for one page of wallpapers: details, a media gallery of the images, and page buttons. */
const createListMessage = (rows: Wallpaper[], total: number, offset: number, limit: number, tags = "") => {
  const container = new ContainerBuilder().setAccentColor(embedOptions.color);
  const filter = tags ? ` matching \`${tags}\`` : "";
  if (!rows.length) {
    container.addTextDisplayComponents(new TextDisplayBuilder().setContent(`No wallpapers found${filter}.`));
  } else {
    const details = rows
      .map((w) => {
        const title = truncate(w.tag_string, listOptions.titleChars);
        const tagLine = truncate(w.tags.trim(), listOptions.tagChars) || embedOptions.noTags;
        return `**#${w.id}**${w.enabled ? "" : embedOptions.disabledMark} [${title}](${w.file_url})\n-# ${tagLine}`;
      })
      .join("\n");
    container
      .addTextDisplayComponents(
        new TextDisplayBuilder().setContent(
          `### Wallpapers${filter}\n-# Showing ${offset + 1}-${offset + rows.length} of ${total}`,
        ),
      )
      .addSeparatorComponents(new SeparatorBuilder())
      .addTextDisplayComponents(new TextDisplayBuilder().setContent(details))
      .addMediaGalleryComponents(
        new MediaGalleryBuilder().addItems(
          rows.map((w) =>
            new MediaGalleryItemBuilder()
              .setURL(w.file_url)
              .setDescription(truncate(`#${w.id} ${w.tag_string}`, listOptions.altChars)),
          ),
        ),
      )
      .addSeparatorComponents(new SeparatorBuilder())
      .addActionRowComponents(createPagination(offset, limit, total, tags));
  }
  return { components: [container], flags: MessageFlags.IsComponentsV2 as const };
};

const formatError = (r: ApiResult<unknown>) => `[ERROR] ${r.status || "Network"}: ${r.error ?? "request failed"}`;

const formatDomain = (d: WallpaperDomain, heading?: string) =>
  `${heading ? `${heading}: ` : ""}**${d.name}** (${d.type})\n<${d.base_url}>\n-# ${truncate(d.tags.trim(), embedOptions.tagChars) || embedOptions.noTags}`;

export default {
  listOptions,
  createEmbed,
  createListMessage,
  formatError,
  formatDomain,
};
