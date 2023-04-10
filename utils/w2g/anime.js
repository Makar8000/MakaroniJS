const path = require('path');
const { Collection } = require('discord.js');
const { ANIME } = require('@consumet/extensions');
const moment = require('moment');
const logger = require(path.join(__dirname, '../logger.js'));

const consumet = new ANIME[process.env.ANIME_PROVIDER]();
const infoCache = new Collection();

/**
 * Search for an anime using the Consumet API.
 * @param {String} query
 *  The anime to search for.
 * @returns
 *  An array of results from the search.
 */
async function search(query) {
  try {
    const data = await consumet.search(query);
    if (data?.results?.length > 0) {
      return data.results.filter(d => d.subOrDub === 'sub');
    }
  } catch (error) {
    logger.error(error);
  }
  return [];
}

/**
 * Gets anime information and episode lists for a given Anime ID.
 * @param {String} id
 *  The Anime ID provided by the Consumet API.
 * @returns
 *  The anime information, or null if the ID is invalid.
 */
async function fetchAnimeInfo(id) {
  try {
    const time = moment();
    infoCache.sweep(a => time.isAfter(a.expires));

    let data = infoCache.get(id);
    if (!data) {
      data = await consumet.fetchAnimeInfo(id);
    }
    if (data?.episodes?.length > 0) {
      infoCache.set(id, { ...data, expires: moment().add(2, 'hours') });
      return data;
    }
  } catch (error) {
    logger.error(error);
  }
  return null;
}

/**
 * Gets server information for a given Episode ID.
 * @param {String} episodeId
 *  The Episode ID provided by the Consumet API.
 * @returns
 *  The server information, or null if the ID is invalid.
 */
async function fetchEpisodeServers(episodeId) {
  try {
    const data = await consumet.fetchEpisodeServers(episodeId);
    if (data?.length > 0) {
      return data;
    }
  } catch (error) {
    logger.error(error);
  }
  return [];
}

module.exports = {
  search,
  fetchAnimeInfo,
  fetchEpisodeServers,
};