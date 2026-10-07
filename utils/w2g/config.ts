import { type APIEmbedField, EmbedBuilder, time, TimestampStyles, type User } from "discord.js";
import { getDiscordStr } from "../common.ts";
import type { AnimeInfo } from "../types.ts";

/** Formats a fuzzy date as a Discord long-date timestamp, or "???" if any part is missing. */
const formatFuzzyDate = (date?: { year?: number | null; month?: number | null; day?: number | null }) => {
  if (typeof date?.year !== "number" || typeof date.month !== "number" || typeof date.day !== "number") return "???";
  // Noon UTC keeps the calendar day the same for viewers in every timezone.
  return time(new Date(Date.UTC(date.year, date.month - 1, date.day, 12)), TimestampStyles.LongDate);
};

const embedOptions = Object.freeze({
  color: 0xFBCD3B,
  title: "Click to join!",
  thumbnailUrl: "https://static.w2g.tv/static/watch2gether-share.jpg",
  fieldVideoUrl: "Video URL",
  fieldRoomUrl: "Room URL",
  fieldId: "Room ID",
});

const createGeneric = (roomUrl: string, videoUrl: string, key: string, user: User, msg: string) => {
  try {
    const embed = new EmbedBuilder()
      .setColor(embedOptions.color)
      .setAuthor({
        name: `${user.displayName} ${msg}`,
        iconURL: `https://cdn.discordapp.com/avatars/${user.id}/${user.avatar}.png`,
        url: `${roomUrl}`,
      })
      .setThumbnail(embedOptions.thumbnailUrl)
      .setTitle(embedOptions.title)
      .setURL(`${roomUrl}`)
      .addFields(
        { name: embedOptions.fieldRoomUrl, value: `<${roomUrl}>` },
        { name: embedOptions.fieldVideoUrl, value: `${videoUrl}` },
        { name: embedOptions.fieldId, value: `\`${key}\`` },
      )
      .setTimestamp();
    return [embed];
  } catch {
    return [];
  }
};

const createSuccess = (roomUrl: string, videoUrl: string, key: string, user: User) => {
  return createGeneric(roomUrl, videoUrl, key, user, "has created a W2G Room!");
};

const addSuccess = (roomUrl: string, videoUrl: string, key: string, user: User) => {
  return createGeneric(roomUrl, videoUrl, key, user, "has added a video!");
};

const embedOptionsAnime = Object.freeze({
  color: 0x009FEE,
  title: "Click to join!",
  thumbnailUrl: "https://static.w2g.tv/static/watch2gether-share.jpg",
  fieldRoomUrl: "Room URL",
  fieldId: "Room ID",
  fieldGenres: "Genres",
  fieldType: "Type",
  fieldAired: "Aired",
  fieldStatus: "Status",
  fieldRating: "Rating",
  fieldExternalLinks: "External Links & More Info",
  mappings: {
    mal: {
      urlPrefix: "https://myanimelist.net/anime/",
      name: "MyAnimeList",
      hover: "View on MyAnimeList",
    },
    anilist: {
      urlPrefix: "https://anilist.co/anime/",
      name: "AniList",
      hover: "View on AniList",
    },
  },
});

const createGenericAnime = (animeInfo: AnimeInfo, user: User, msg: string) => {
  try {
    const fields: APIEmbedField[] = [];
    fields.push({ name: embedOptionsAnime.fieldRoomUrl, value: `<${animeInfo.roomUrl}>` });
    if (animeInfo.genres?.length) {
      fields.push({
        name: embedOptionsAnime.fieldGenres,
        value: `${animeInfo.genres.join(", ")}`,
      });
    }
    if (typeof animeInfo.type === "string") {
      fields.push({
        name: embedOptionsAnime.fieldType,
        value: `${animeInfo.type}`,
        inline: true,
      });
    }
    if (typeof animeInfo.startDate?.day === "number") {
      fields.push({
        name: embedOptionsAnime.fieldAired,
        value: `${formatFuzzyDate(animeInfo.startDate)} - ${formatFuzzyDate(animeInfo.endDate)}`,
        inline: true,
      });
    }
    if (typeof animeInfo.rating === "number") {
      fields.push({
        name: embedOptionsAnime.fieldRating,
        value: `${animeInfo.rating}/100`,
        inline: true,
      });
    }
    const externalSources: string[] = [];
    for (const key of Object.keys(embedOptionsAnime.mappings) as (keyof typeof embedOptionsAnime.mappings)[]) {
      if (animeInfo.mappings && animeInfo.mappings[key]) {
        const opts = embedOptionsAnime.mappings[key];
        const id = animeInfo.mappings[key];
        externalSources.push(`[${opts.name}](${opts.urlPrefix}${id} '${opts.hover}')`);
      }
    }
    if (externalSources.length > 0) {
      fields.push({
        name: embedOptionsAnime.fieldExternalLinks,
        value: `${externalSources.join(", ")}`,
      });
    }
    fields.push({ name: embedOptionsAnime.fieldId, value: `\`${animeInfo.roomId}\`` });

    const embed = new EmbedBuilder()
      .setColor((animeInfo.color ?? embedOptionsAnime.color) as `#${string}` | number)
      .setAuthor({
        name: `${user.displayName} ${msg}`,
        iconURL: `https://cdn.discordapp.com/avatars/${user.id}/${user.avatar}.png`,
        url: `${animeInfo.roomUrl}`,
      })
      .setThumbnail(animeInfo.image ?? null)
      .setImage(animeInfo.cover ?? null)
      .setTitle(`${getDiscordStr(animeInfo.title.romaji ?? "", 216)} - Episode ${animeInfo.episodeNumber}`)
      .setDescription(
        `${getDiscordStr((animeInfo.description ?? "").replaceAll(/<br\s?\/?>/g, "").replaceAll(/\n\n\(Source:\s[^)]+\).*$/gs, ""), 4095)}`,
      )
      .setURL(`${animeInfo.roomUrl}`)
      .addFields(fields)
      .setTimestamp();
    return [embed];
  } catch {
    return [];
  }
};

const createSuccessAnime = (animeInfo: AnimeInfo, user: User) => {
  return createGenericAnime(animeInfo, user, "has created an Anime room!");
};

const addSuccessAnime = (animeInfo: AnimeInfo, user: User) => {
  return createGenericAnime(animeInfo, user, "has added an episode!");
};

export default {
  createSuccess,
  addSuccess,
  createSuccessAnime,
  addSuccessAnime,
};
