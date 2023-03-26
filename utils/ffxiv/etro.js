const path = require('path');
const fetch = require('node-fetch');
const { EmbedBuilder } = require('discord.js');
const config = require(path.join(__dirname, 'config.js'));
const logger = require(path.join(__dirname, '../logger.js'));

async function getFromUrl(etroUrl) {
  if (!etroUrl) {
    return null;
  }

  const idIndex = etroUrl.lastIndexOf('/');
  if (idIndex === -1) {
    return null;
  }

  const etroId = etroUrl.substr(idIndex + 1);
  const etroSet = await getFromId(etroId);
  return etroSet;
}

async function getFromId(etroId) {
  if (!etroId) {
    return null;
  }

  const set = { ...config.defaultEtroSet, etroId };
  try {
    // Grab etro data
    const json = await getJsonFromUrl(`${config.etroApiUrl}${etroId}`);
    if (!json) {
      return null;
    }
    set.job = json.jobAbbrev;

    // Get item names from XIVAPI
    const itemIds = Object.keys(config.augmentTokens).map(slot => json[slot]).join(',');
    const xivApiUrl = `${config.apiUrl}/Item?private_key=${process.env.XIVAPI_TOKEN}&ids=${itemIds}&columns=Name,ID`;
    const itemNameMap = (await getJsonFromUrl(xivApiUrl))?.Results.reduce((p, c) => {
      if (typeof c === 'object') {
        p[c.ID] = c.Name;
      }
      return p;
    }, {});
    if (!itemNameMap) { return null; }

    // Map out upgrade tokens vs raid pieces
    for (const slot of Object.keys(config.augmentTokens)) {
      const augType = config.augmentTokens[slot];
      const itemId = json[slot];

      if (!itemNameMap[itemId]) {
        return null;
      } else if (itemNameMap[itemId].startsWith('Augmented')) {
        if (augType === config.tokenTypes.RIGHT) {
          set.rightTokens++;
        } else if (augType === config.tokenTypes.LEFT) {
          set.leftTokens++;
        } else if (augType === config.tokenTypes.WEAPON) {
          set.weaponToken = true;
        }
      } else {
        set.raidPieces.push(slot.startsWith('finger') ? 'ring' : slot);
      }
    }
  } catch (error) {
    logger.error(error);
    return null;
  }

  return set;
}

function getAsEmbed(etroSet) {
  const fields = [];

  if (etroSet.leftTokens > 0) {
    fields.push({ name: config.tokenTypes.LEFT, value: `${etroSet.leftTokens}`, inline: true });
  }
  if (etroSet.rightTokens > 0) {
    fields.push({ name: config.tokenTypes.RIGHT, value: `${etroSet.rightTokens}`, inline: true });
  }
  if (etroSet.weaponToken) {
    fields.push({ name: config.tokenTypes.WEAPON, value: '1', inline: true });
  }

  const embed = new EmbedBuilder()
    .setColor(config.embedColor)
    .setThumbnail(config.thumbnailUrl)
    .setAuthor({
      name: config.embedName,
      iconURL: `${config.iconUrl}${etroSet.job}_Solid.png`,
      url: `${config.etroUrl}${etroSet.etroId}`,
    })
    .setTitle(config.embedTitle)
    .setDescription(etroSet.raidPieces.reduce((acc, cur, i) => {
      return `${acc}${cur.charAt(0).toUpperCase()}${cur.substr(1)}${i != etroSet.raidPieces.length - 1 ? ', ' : ''}`;
    }, ''))
    .addFields(fields);
  return embed;
}

async function getJsonFromUrl(url, options) {
  const resp = await fetch(url, options);
  if (!resp.ok) {
    logger.error(`${resp.status}: ${resp.statusText}`);
    logger.error(await resp.text());
    return null;
  }
  const json = await resp.json();
  return json;
}

module.exports = {
  getFromUrl,
  getFromId,
  getAsEmbed,
};