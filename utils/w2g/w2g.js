const path = require('path');
const fetch = require('node-fetch');
const logger = require(path.join(__dirname, '../logger.js'));

/**
 * Creates a new W2G room.
 * @param {String} url
 *  The URL of the initial video for W2G.
 * @returns
 *  The streamkey for the W2G room.
 */
async function createRoom(url) {
  try {
    const resp = await fetch('https://api.w2g.tv/rooms/create.json', {
      method: 'POST',
      headers: {
        'Accept': 'application/json',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        w2g_api_key: `${process.env.W2G_KEY}`,
        share: `${url}`,
        bg_color: '#1F1F1F',
        bg_opacity: '100',
      }),
    });

    if (!resp.ok) {
      logger.error(`${resp.status}: ${resp.statusText}`);
      logger.error(await resp.text());
      return null;
    }

    const json = await resp.json();
    return json.streamkey;
  } catch (error) {
    logger.error(error);
  }
  return null;
}

/**
 * Adds a video to an existing W2G room.
 * @param {String} streamkey
 *  The room ID to add the video to.
 * @param {String} url
 *  The URL of the video to add.
 * @returns
 *  True if successfully added. False otherwise.
 */
async function addToRoom(streamkey, url) {
  try {
    const resp = await fetch(`https://api.w2g.tv/rooms/${streamkey}/playlists/current/playlist_items/sync_update`, {
      method: 'POST',
      headers: {
        'Accept': 'application/json',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        w2g_api_key: `${process.env.W2G_KEY}`,
        add_items: [{ 'url': `${url}` }],
      }),
    });

    if (!resp.ok) {
      logger.error(`${resp.status}: ${resp.statusText}`);
      logger.error(await resp.text());
      return false;
    }

    return true;
  } catch (error) {
    logger.error(error);
  }
  return false;
}

/**
 * Gets a W2G room url for a given streamkey.
 * @param {String} streamkey
 *  The W2G stream key.
 * @returns
 *  The url for the W2G room.
 */
function getRoomUrl(streamkey) {
  return `https://w2g.tv/rooms/${streamkey}`;
}

module.exports = {
  createRoom,
  addToRoom,
  getRoomUrl,
};