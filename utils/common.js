const Keyv = require('keyv');
const { KeyvFile } = require('keyv-file');

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
const getDiscordStr = (str, maxLen) => {
  let newStr = str.trim();
  // Italics
  newStr = newStr.replaceAll(/<\/?i>/g, '_');
  // New Lines
  newStr = newStr.replaceAll(/<br\s?\/?>/g, '\n');
  // Bold
  newStr = newStr.replaceAll(/<\/?(?:b|strong)>/g, '**');
  // Other tags
  newStr = newStr.replaceAll(/<\/?[^<]+>/g, '').trim();

  // Max Length
  if (maxLen) {
    newStr = newStr.substring(str, maxLen);
  }

  return newStr.trim();
};

/**
 * Grabs the data in a specified keyv store
 * @param {Object} params
 *  Param object which should include inputFile and namespace
 * @returns
 *  The data which is stored at this keyv store
 */
const getKeyvData = async ({ inputFile, namespace, key }) => {
  const data = new Keyv({
    namespace: namespace,
    store: new KeyvFile({
      filename: inputFile,
    }),
  });

  if (key) {
    return await data.get(key);
  }

  const ret = {};
  for await (const [k, v] of data.interator()) {
    ret[k] = v;
  }
  return ret;
};

module.exports = {
  getDiscordStr,
  getKeyvData,
};