import { Collection } from "discord.js";
import { ANIME, type IAnimeResult, type ISearch, META } from "@consumet/extensions";
import type { AnimeParser } from "@consumet/extensions/dist/models";
import logger from "../logger.ts";
import { requireEnv } from "../common.ts";
import type { AnimeInfo } from "../types.ts";

const provider: AnimeParser = new ANIME[requireEnv("ANIME_PROVIDER") as keyof typeof ANIME]();
const consumet = new META.Anilist(provider);
const infoCache = new Collection<string, AnimeInfo>();
// 6 hour cache
const CACHE_TTL_MS = 6 * 60 * 60 * 1000;

/**
 * Search for an anime using the Consumet API.
 * @param {String} query
 *  The anime to search for.
 * @returns
 *  An array of results from the search.
 */
async function search(query: string) {
  try {
    const data = await consumet.search(query);
    if ((data?.results?.length ?? 0) > 0) {
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
async function fetchAnimeInfo(id: string, originalQuery: string, episodeNumber: number): Promise<AnimeInfo | null> {
  try {
    const time = Date.now();
    infoCache.sweep((a) => time > (a.expires ?? Infinity));

    const cached = infoCache.get(id);
    let data: AnimeInfo = cached?.episodes?.find((e) => e.number === episodeNumber) ? cached : await consumet.fetchAnimeInfo(id);
    const alternateTitles = [data.title.english, originalQuery];
    while (!data.episodes?.length && alternateTitles.length > 0) {
      const titleToSearch = alternateTitles.shift();
      if (!titleToSearch) {
        continue;
      }
      const providerSearch = await provider.search(titleToSearch) as ISearch<IAnimeResult>;
      if ((providerSearch?.results?.length ?? 0) > 0) {
        const newData = await provider.fetchAnimeInfo(providerSearch.results[0].id);
        data = { ...data, episodes: newData?.episodes ?? [] };
      }
    }
    if ((data.episodes?.length ?? 0) > 0) {
      if (!data.expires) {
        infoCache.set(id, { ...data, expires: Date.now() + CACHE_TTL_MS });
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
async function fetchEpisodeServers(episodeId: string) {
  try {
    const data = await consumet.fetchEpisodeServers(episodeId);
    if ((data?.length ?? 0) > 0) {
      return data;
    }
  } catch (error) {
    logger.error(error);
  }
  return [];
}

export default {
  search,
  fetchAnimeInfo,
  fetchEpisodeServers,
};
