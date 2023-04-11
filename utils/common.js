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

module.exports = {
  getDiscordStr,
};