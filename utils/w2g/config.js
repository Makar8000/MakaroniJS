const path = require('path');
const { EmbedBuilder } = require('discord.js');
const moment = require('moment');
const { getDiscordStr } = require(path.join(__dirname, '../common.js'));

const embedOptions = Object.freeze({
  color: 0xFBCD3B,
  title: 'Click to join!',
  thumbnailUrl: 'https://static.w2g.tv/static/watch2gether-share.jpg',
  fieldVideoUrl: 'Video URL',
  fieldRoomUrl: 'Room URL',
  fieldId: 'Room ID',
});

const createGeneric = (roomUrl, videoUrl, key, user, msg) => {
  try {
    const embed = new EmbedBuilder()
      .setColor(embedOptions.color)
      .setAuthor({
        name: `${user.username} ${msg}`,
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

const createSuccess = (roomUrl, videoUrl, key, user) => {
  return createGeneric(roomUrl, videoUrl, key, user, 'has created a W2G Room!');
};

const addSuccess = (roomUrl, videoUrl, key, user) => {
  return createGeneric(roomUrl, videoUrl, key, user, 'has added a video!');
};

const embedOptionsAnime = Object.freeze({
  color: 0x009FEE,
  title: 'Click to join!',
  thumbnailUrl: 'https://static.w2g.tv/static/watch2gether-share.jpg',
  fieldRoomUrl: 'Room URL',
  fieldId: 'Room ID',
  fieldGenres: 'Genres',
  fieldType: 'Type',
  fieldAired: 'Aired',
  fieldStatus: 'Status',
  fieldRating: 'Rating',
  fieldExternalLinks: 'External Links & More Info',
  mappings: {
    mal: {
      urlPrefix: 'https://myanimelist.net/anime/',
      name: 'MyAnimeList',
      hover: 'View on MyAnimeList',
    },
    anilist: {
      urlPrefix: 'https://anilist.co/anime/',
      name: 'AniList',
      hover: 'View on AniList',
    },
  },
});

const createGenericAnime = (animeInfo, user, msg) => {
  try {
    const fields = [];
    fields.push({ name: embedOptionsAnime.fieldRoomUrl, value: `<${animeInfo.roomUrl}>` });
    if (animeInfo.genres?.length > 0) {
      fields.push({
        name: embedOptionsAnime.fieldGenres,
        value: `${animeInfo.genres.join(', ')}`,
      });
    }
    if (typeof animeInfo.type === 'string') {
      fields.push({
        name: embedOptionsAnime.fieldType,
        value: `${animeInfo.type}`,
        inline: true,
      });
    }
    if (typeof animeInfo.startDate?.day === 'number') {
      const start = moment(`${animeInfo.startDate?.year}-${animeInfo.startDate?.month}-${animeInfo.startDate?.day}`, 'YYYY-M-D');
      const end = moment(`${animeInfo.endDate?.year}-${animeInfo.endDate?.month}-${animeInfo.endDate?.day}`, 'YYYY-M-D');
      fields.push({
        name: embedOptionsAnime.fieldAired,
        value: `${start.isValid() ? start.format('MMM Mo, YYYY') : '???'} - ${end.isValid() ? end.format('MMM Mo, YYYY') : '???'}`,
        inline: true,
      });
    }
    if (typeof animeInfo.rating === 'number') {
      fields.push({
        name: embedOptionsAnime.fieldRating,
        value: `${animeInfo.rating}/100`,
        inline: true,
      });
    }
    const externalSources = [];
    for (const key of Object.keys(embedOptionsAnime.mappings)) {
      if (animeInfo.mappings && animeInfo.mappings[key]) {
        const opts = embedOptionsAnime.mappings[key];
        const id = animeInfo.mappings[key];
        externalSources.push(`[${opts.name}](${opts.urlPrefix}${id} '${opts.hover}')`);
      }
    }
    if (externalSources.length > 0) {
      fields.push({
        name: embedOptionsAnime.fieldExternalLinks,
        value: `${externalSources.join(', ')}`,
      });
    }
    fields.push({ name: embedOptionsAnime.fieldId, value: `\`${animeInfo.roomId}\`` });

    const embed = new EmbedBuilder()
      .setColor(animeInfo.color ?? embedOptionsAnime.color)
      .setAuthor({
        name: `${user.username} ${msg}`,
        iconURL: `https://cdn.discordapp.com/avatars/${user.id}/${user.avatar}.png`,
        url: `${animeInfo.roomUrl}`,
      })
      .setThumbnail(animeInfo.image)
      .setImage(animeInfo.cover)
      .setTitle(`${getDiscordStr(animeInfo.title.romaji, 216)} - Episode ${animeInfo.episodeNumber}`)
      .setDescription(`${getDiscordStr(animeInfo.description, 4095)}`)
      .setURL(`${animeInfo.roomUrl}`)
      .addFields(fields)
      .setTimestamp();
    return [embed];
  } catch {
    return [];
  }
};

const createSuccessAnime = (animeInfo, user) => {
  return createGenericAnime(animeInfo, user, 'has created an Anime room!');
};

const addSuccessAnime = (animeInfo, user) => {
  return createGenericAnime(animeInfo, user, 'has added an episode!');
};

module.exports = {
  createSuccess,
  addSuccess,
  createSuccessAnime,
  addSuccessAnime,
};