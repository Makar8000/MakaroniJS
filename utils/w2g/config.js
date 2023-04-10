const { EmbedBuilder } = require('discord.js');

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
  fieldType: 'Season',
  fieldStatus: 'Status',
});

const createGenericAnime = (animeInfo, user, msg) => {
  try {
    const fields = [];
    fields.push({ name: embedOptionsAnime.fieldRoomUrl, value: `<${animeInfo.roomUrl}>` });
    if (animeInfo.genres?.length > 0) {
      fields.push({
        name: embedOptionsAnime.fieldGenres,
        value: `${animeInfo.genres.join(', ')}`,
        inline: true,
      });
    }
    if (animeInfo.type) {
      fields.push({
        name: embedOptionsAnime.fieldType,
        value: `${animeInfo.type}`,
        inline: true,
      });
    }
    if (animeInfo.status) {
      fields.push({
        name: embedOptionsAnime.fieldStatus,
        value: `${animeInfo.status}`,
        inline: true,
      });
    }
    fields.push({ name: embedOptionsAnime.fieldId, value: `\`${animeInfo.roomId}\`` });

    const embed = new EmbedBuilder()
      .setColor(embedOptionsAnime.color)
      .setAuthor({
        name: `${user.username} ${msg}`,
        iconURL: `https://cdn.discordapp.com/avatars/${user.id}/${user.avatar}.png`,
        url: `${animeInfo.roomUrl}`,
      })
      .setThumbnail(animeInfo.image)
      .setTitle(`${animeInfo.title.trim().substring(0, 216)} - Episode ${animeInfo.episodeNumber}`)
      .setDescription(`${animeInfo.description.trim().substring(0, 4095)}`)
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