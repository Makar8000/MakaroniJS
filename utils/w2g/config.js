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

module.exports = {
  createSuccess,
  addSuccess,
};