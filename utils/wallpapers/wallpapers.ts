import logger from "../logger.ts";
import type { ApiResult, PagedResult, Wallpaper, WallpaperBody, WallpaperDomain } from "../types.ts";

/** Calls the MakaroniHTTP wallpapers API. Never throws; network failures resolve to `{ ok: false, status: 0 }`. */
async function request<T>(
  method: string,
  path = "",
  body?: Partial<WallpaperBody> | Partial<WallpaperDomain>,
): Promise<ApiResult<T>> {
  try {
    const resp = await fetch(`${Bun.env.INTERNAL_API_URL}/wallpapers${path}`, {
      method,
      headers: {
        Authorization: `${Bun.env.INTERNAL_API_AUTH}`,
        ...(body && { "Content-Type": "application/json" }),
      },
      body: body && JSON.stringify(body),
    });
    const data = await resp.json().catch(() => null);
    return {
      ok: resp.ok,
      status: resp.status,
      data: resp.ok ? data : null,
      error: resp.ok ? undefined : data?.error,
      headers: resp.headers,
    };
  } catch (error) {
    logger.error(error);
    return {
      ok: false,
      status: 0,
      data: null,
      error: "Unable to reach the wallpapers API.",
      headers: new Headers(),
    };
  }
}

/** One page of enabled wallpapers in stable id order, optionally containing ALL of the space-delimited `tags`. */
const list = async (opts: { limit?: number; offset?: number; tags?: string } = {}): Promise<PagedResult<Wallpaper>> => {
  const params = new URLSearchParams({ random: "false" });
  if (opts.limit) {
    params.set("limit", `${opts.limit}`);
  }
  if (opts.offset) {
    params.set("offset", `${opts.offset}`);
  }
  if (opts.tags) {
    params.set("tags", opts.tags);
  }
  const r = await request<Wallpaper[]>("GET", `?${params}`);
  // The API reports the unpaginated match count in a header; fall back to this page's size if it is missing.
  return { ...r, total: Number(r.headers.get("X-Total-Count") ?? r.data?.length ?? 0) };
};

const create = (body: WallpaperBody) => request<Wallpaper>("POST", "", body);

const update = (id: number, patch: Partial<WallpaperBody>) => request<Wallpaper>("PUT", `/${id}`, patch);

const remove = (id: number) => request<null>("DELETE", `/${id}`);

const listDomains = () => request<WallpaperDomain[]>("GET", "/domains");

// `type` is optional on create; the API defaults it to "danbooru".
const createDomain = (body: Omit<WallpaperDomain, "type"> & Partial<Pick<WallpaperDomain, "type">>) =>
  request<WallpaperDomain>("POST", "/domains", body);

const updateDomain = (name: string, patch: Partial<Omit<WallpaperDomain, "name">>) =>
  request<WallpaperDomain>("PUT", `/domains/${encodeURIComponent(name)}`, patch);

const removeDomain = (name: string) => request<null>("DELETE", `/domains/${encodeURIComponent(name)}`);

export default {
  list,
  create,
  update,
  remove,
  listDomains,
  createDomain,
  updateDomain,
  removeDomain,
};
