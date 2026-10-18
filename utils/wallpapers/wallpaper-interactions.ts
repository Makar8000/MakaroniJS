import wallpaperConfig from "./config.ts";
import wallpapers from "./wallpapers.ts";

/**
 * Fetches one page of wallpapers and renders it.
 * @returns the message payload, or an error string if the API call failed
 */
const buildListPage = async (tags: string, offset: number, limit: number) => {
  let r = await wallpapers.list({ tags, offset, limit });
  if (!r.ok) {
    return wallpaperConfig.formatError(r);
  }
  // Wallpapers may have been deleted since the buttons were rendered; fall back to the last page that exists.
  const { total } = r;
  let start = offset;
  if (!r.data?.length && total > 0) {
    start = Math.floor((total - 1) / limit) * limit;
    r = await wallpapers.list({ tags, offset: start, limit });
    if (!r.ok) {
      return wallpaperConfig.formatError(r);
    }
  }
  return wallpaperConfig.createListMessage(r.data ?? [], total, start, limit, tags);
};

export default {
  buildListPage,
};
