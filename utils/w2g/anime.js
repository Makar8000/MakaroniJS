const path = require('path');
const { Collection } = require('discord.js');
const { META, ANIME } = require('@consumet/extensions');
const moment = require('moment');
const logger = require(path.join(__dirname, '../logger.js'));

const provider = new ANIME[process.env.ANIME_PROVIDER]();
const consumet = new META.Anilist(provider);
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
      return data.results;
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
 * @param {String} originalQuery
 *  The original query to use as a backup if no episodes are found.
 * @param {Number} episodeNumber
 *  The optional episode number that we are specifically looking for.
 * @returns
 *  The anime information, or null if the ID is invalid.
 */
async function fetchAnimeInfo(id, originalQuery, episodeNumber) {
  try {
    const time = moment();
    infoCache.sweep(a => time.isAfter(a.expires));

    let data = infoCache.get(id);
    if (!data?.episodes?.find(e => e.number === episodeNumber)) {
      data = await consumet.fetchAnimeInfo(id);
    }
    const alternateTitles = [data.title.english, originalQuery];
    while (!data?.episodes?.length && alternateTitles.length > 0) {
      const titleToSearch = alternateTitles.shift();
      if (!titleToSearch) {
        continue;
      }
      const providerSearch = await provider.search(titleToSearch);
      if (providerSearch?.results?.length > 0) {
        const newData = await provider.fetchAnimeInfo(providerSearch.results[0].id);
        data = { ...data, episodes: newData?.episodes ?? [] };
      }
    }
    if (data?.episodes?.length > 0) {
      if (!data.expires) {
        infoCache.set(id, { ...data, expires: moment().add(6, 'hours') });
      }
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