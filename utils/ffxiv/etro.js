const path = require('path');
const fetch = require('node-fetch');
const config = require(path.join(__dirname, 'config.js'));
const logger = require(path.join(__dirname, '../logger.js'));

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
  getFromId,
};