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

  const ret: Record<string, unknown> = {};
  for await (const [k, v] of data.iterator()) {
    ret[k] = v;
  }
  return ret;
};

export default {
  getDiscordStr,
  getKeyvData,
  requireEnv,
};
