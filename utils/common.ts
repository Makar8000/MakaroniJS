import Keyv from "keyv";
import { KeyvFile } from "keyv-file";

/**
 * Parses an string that may contain HTML tags into
 * something more discord-friendly.
 * @param {String} str
 *  The string to manipulate
 * @param {Number} maxLen
 *  The max length of the string.
 * @returns
 *  A discord-friendly string.
 */
export const getDiscordStr = (str: string, maxLen?: number) => {
  let newStr = str.trim();
  // Italics
  newStr = newStr.replaceAll(/<\/?i>/g, "_");
  // New Lines
  newStr = newStr.replaceAll(/<br\s?\/?>/g, "\n");
  // Bold
  newStr = newStr.replaceAll(/<\/?(?:b|strong)>/g, "**");
  // Other tags
  newStr = newStr.replaceAll(/<\/?[^<]+>/g, "").trim();

  // Max Length
  if (maxLen) {
    newStr = newStr.substring(0, maxLen);
  }

  return newStr.trim();
};

/**
 * Adjusts a cut position so it doesn't split an emoji (surrogate pair) in half.
 * @param {String} text The text being cut.
 * @param {Number} end The index to cut at (exclusive).
 * @returns {Number} `end`, or `end - 1` if cutting there would separate a surrogate pair.
 */
const safeCutIndex = (text: string, end: number) => {
  const last = text.charCodeAt(end - 1);
  if (last >= 0xD800 && last <= 0xDBFF) {
    return end - 1;
  }
  return end;
};

/**
 * Splits text into pieces that each fit in a single Discord message
 * @param {String} text The text to split.
 * @param {Number} max The maximum length of each piece.
 * @returns {String[]} The pieces, in order. A single piece if the text already fits.
 */
export const chunkText = (text: string, max: number) => {
  const chunks: string[] = [];
  let rest = text;
  while (rest.length > max) {
    let cut = Math.max(rest.lastIndexOf("\n", max), rest.lastIndexOf(" ", max));
    let skip = 1;
    if (cut <= 0) {
      cut = safeCutIndex(rest, max);
      skip = 0;
    }
    chunks.push(rest.slice(0, cut));
    // The newline/space we broke on is dropped, since it only separated the two pieces.
    rest = rest.slice(cut + skip);
  }
  chunks.push(rest);
  return chunks;
};

/**
 * Truncates text to a maximum length, adding an ellipsis if it was cut.
 * Closes any code block the cut left open.
 * @param {String} text The text to truncate.
 * @param {Number} max The maximum length.
 * @returns {String} The possibly-truncated text.
 */
export const truncate = (text: string, max: number) => {
  let result = text;
  if (text.length > max) {
    result = `${text.slice(0, safeCutIndex(text, max - 1))}…`;
  }

  // Handle partial code blocks
  const fenceCount = result.split("```").length - 1;
  const hasOpenCodeBlock = fenceCount % 2 === 1;
  if (hasOpenCodeBlock) {
    result += "\n```";
  }

  return result;
};

/**
 * Reads a required environment variable, failing fast when it is missing.
 * @param {String} key
 *  The name of the environment variable.
 * @returns
 *  The (non-empty) value of the environment variable.
 */
export const requireEnv = (key: string): string => {
  const value = Deno.env.get(key);
  if (!value) throw new Error(`Missing required environment variable: ${key}`);
  return value;
};

/**
 * Grabs the data in a specified keyv store
 * @param {Object} params
 *  Param object which should include inputFile and namespace
 * @returns
 *  The data which is stored at this keyv store
 */
export const getKeyvData = async ({ inputFile, namespace, key }: { inputFile: string; namespace: string; key?: string }) => {
  const data = new Keyv({
    namespace: namespace,
    store: new KeyvFile({
      filename: inputFile,
    }),
  });

  if (key) {
    return await data.get(key);
  }

  if (!data.iterator) {
    throw new Error(`Keyv store for namespace "${namespace}" does not support iteration`);
  }

  const ret: Record<string, unknown> = {};
  for await (const [k, v] of data.iterator(namespace)) {
    ret[k] = v;
  }
  return ret;
};

export default {
  getDiscordStr,
  chunkText,
  truncate,
  getKeyvData,
  requireEnv,
};
