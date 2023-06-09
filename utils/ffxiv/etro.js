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

  const set = { ...JSON.parse(JSON.stringify(config.defaultEtroSet)), etroId };
  try {
    // Grab etro data
    const json = await getJsonFromUrl(`${config.etroApiUrl}${etroId}`);
    if (!json) {
      return null;
    }

    // Parse total params
    if (json.totalParams?.length > 0) {
      json.totalParams = json.totalParams.map(p => {
        p.id = Number.parseInt(p.id);
        if (p.name.startsWith('Weapon')) {
          p.name = 'WD';
        }
        return p;
      });
    }

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

    // Add other etro info
    set.name = json.name;
    set.job = json.jobAbbrev;
    set.params = json.totalParams?.filter(p => config.etroParams.statOrder.includes(p.id))
      .sort((a, b) => config.etroParams.statOrder.indexOf(a.id) - config.etroParams.statOrder.indexOf(b.id));
    set.gcd = json.totalParams?.filter(p => p.name.startsWith(config.etroParams.gcd))
      .sort((a, b) => a.name.localeCompare(b.name));
    set.dmg = json.totalParams?.find(p => p.name === config.etroParams.dmg)?.value;
    set.notes = json.notes?.replaceAll(/<(?:hr|\/(?:h[0-9]|p|li))>/g, '\n')?.replaceAll(/<[^<]+>/g, ' ').trim();
    if (json.food && typeof json.food === 'number') {
      const foodJson = await getJsonFromUrl(`${config.etroFoodApiUrl}${json.food}`);
      if (foodJson) {
        set.food = foodJson.name;
      }
    }

    // Map out upgrade tokens vs raid pieces
    const ringSlots = Object.keys(config.augmentTokens).reverse().splice(0, 2);
    const ringItemNames = [];
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
        set.tomes += config.tomeCost[slot];
      } else {
        const raidPiece = slot.startsWith('finger') ? 'ring' : slot;
        if (!set.raidPieces.includes(raidPiece)) {
          set.raidPieces.push(slot.startsWith('finger') ? 'ring' : slot);
        }
      }

      // Hack for non-augmented tome rings
      if (ringSlots.includes(slot)) {
        ringItemNames.push(itemNameMap[itemId]);
        if (ringItemNames.length === 2 && ringItemNames[0] !== ringItemNames[1]
          && (
            (ringItemNames[0].startsWith('Augmented') && ringItemNames[0].endsWith(ringItemNames[1]))
            || (ringItemNames[1].startsWith('Augmented') && ringItemNames[1].endsWith(ringItemNames[0]))
          )
        ) {
          // Add an extra ring to the tome counter and remove it from raidPieces
          set.tomes += config.tomeCost[slot];
          const idx = set.raidPieces.indexOf('ring');
          if (idx >= 0) {
            set.raidPieces.splice(idx, 1);
          }
        }
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

  if (etroSet.tomes > 0) {
    fields.push({ name: 'Tomes', value: `${etroSet.tomes}`, inline: true });
  }
  if (etroSet.leftTokens > 0) {
    fields.push({ name: config.tokenTypes.LEFT, value: `${etroSet.leftTokens}`, inline: true });
  }
  if (etroSet.rightTokens > 0) {
    fields.push({ name: config.tokenTypes.RIGHT, value: `${etroSet.rightTokens}`, inline: true });
  }
  if (etroSet.weaponToken) {
    fields.push({ name: config.tokenTypes.WEAPON, value: '1', inline: true });
  }

  if (etroSet.dmg) {
    fields.push({ name: config.embedOptions.damageName, value: `${etroSet.dmg}`, inline: false });
  }
  if (etroSet.params?.length > 0) {
    etroSet.params.forEach(p => {
      fields.push({ name: p.name, value: `${p.value}`, inline: true });
    });
  }
  if (etroSet.gcd?.length > 0) {
    etroSet.gcd.forEach(p => {
      fields.push({ name: p.name, value: `${p.value}${p.units ? p.units : ''}`, inline: true });
    });
  }
  if (etroSet.food) {
    fields.push({ name: config.embedOptions.foodName, value: `${etroSet.food}`, inline: false });
  }
  if (etroSet.notes) {
    fields.push({ name: config.embedOptions.noteName, value: `\`\`\`${etroSet.notes}\`\`\``, inline: false });
  }

  const description = etroSet.raidPieces.reduce((acc, cur, i) => {
    return `${acc}${cur.charAt(0).toUpperCase()}${cur.substr(1)}${i != etroSet.raidPieces.length - 1 ? ', ' : ''}`;
  }, '');
  const embed = new EmbedBuilder()
    .setColor(config.embedOptions.color)
    .setThumbnail(`${config.embedOptions.thumbnailUrl}${etroSet.job}_Solid.png`)
    .setAuthor({
      name: etroSet.name ? etroSet.name : config.embedOptions.name,
      iconURL: config.embedOptions.iconUrl,
      url: `${config.etroUrl}${etroSet.etroId}`,
    })
    .setTitle(config.embedOptions.title)
    .setDescription(description.length > 0 ? description : 'None')
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