import { type APIEmbedField, EmbedBuilder } from "discord.js";
import config from "./config.ts";
import logger from "../logger.ts";

/** A stat entry from an etro gearset's `totalParams`. */
interface EtroParam {
  id: number;
  name: string;
  value: number;
  units?: string;
}

/** The parsed result of an etro gearset */
interface EtroSet {
  etroId: string | null;
  job: string | null;
  name?: string;
  leftTokens: number;
  rightTokens: number;
  weaponToken: boolean;
  tomes: number;
  raidPieces: string[];
  params?: EtroParam[];
  gcd?: EtroParam[];
  dmg?: number;
  notes?: string;
  food?: string;
}

type Slot = keyof typeof config.augmentTokens;

async function getFromUrl(etroUrl?: string | null) {
  if (!etroUrl) {
    return null;
  }

  const idIndex = etroUrl.lastIndexOf("/");
  if (idIndex === -1) {
    return null;
  }

  const etroId = etroUrl.substr(idIndex + 1);
  const etroSet = await getFromId(etroId);
  return etroSet;
}

async function getFromId(etroId?: string | null) {
  if (!etroId) {
    return null;
  }

  const set: EtroSet = { ...JSON.parse(JSON.stringify(config.defaultEtroSet)), etroId };
  try {
    // Grab etro data
    const json = await getJsonFromUrl(`${config.etroApiUrl}${etroId}`);
    if (!json) {
      return null;
    }

    // Parse total params
    if (json.totalParams?.length > 0) {
      json.totalParams = json.totalParams.map((p: EtroParam) => {
        p.id = Number.parseInt(`${p.id}`);
        if (p.name.startsWith("Weapon")) {
          p.name = "WD";
        }
        return p;
      });
    }

    // Get item names from XIVAPI
    const itemIds = Object.keys(config.augmentTokens).map((slot) => json[slot]).join(",");
    const xivApiUrl = `${config.apiUrl}/Item?private_key=${Deno.env.get("XIVAPI_TOKEN")}&ids=${itemIds}&columns=Name,ID`;
    const itemNameMap = (await getJsonFromUrl(xivApiUrl))?.Results.reduce((p: Record<string, string>, c: { ID: number; Name: string }) => {
      if (typeof c === "object") {
        p[c.ID] = c.Name;
      }
      return p;
    }, {});
    if (!itemNameMap) return null;

    // Add other etro info
    set.name = json.name;
    set.job = json.jobAbbrev;
    set.params = json.totalParams?.filter((p: EtroParam) => config.etroParams.statOrder.includes(p.id))
      .sort((a: EtroParam, b: EtroParam) => config.etroParams.statOrder.indexOf(a.id) - config.etroParams.statOrder.indexOf(b.id));
    set.gcd = json.totalParams?.filter((p: EtroParam) => p.name.startsWith(config.etroParams.gcd))
      .sort((a: EtroParam, b: EtroParam) => a.name.localeCompare(b.name));
    set.dmg = json.totalParams?.find((p: EtroParam) => p.name === config.etroParams.dmg)?.value;
    set.notes = json.notes?.replaceAll(/<(?:hr|\/(?:h[0-9]|p|li))>/g, "\n")?.replaceAll(/<[^<]+>/g, " ").trim();
    if (json.food && typeof json.food === "number") {
      const foodJson = await getJsonFromUrl(`${config.etroFoodApiUrl}${json.food}`);
      if (foodJson) {
        set.food = foodJson.name;
      }
    }

    // Map out upgrade tokens vs raid pieces
    const slots = Object.keys(config.augmentTokens) as Slot[];
    const ringSlots = [...slots].reverse().splice(0, 2);
    const ringItemNames: string[] = [];
    for (const slot of slots) {
      const augType = config.augmentTokens[slot];
      const itemId = json[slot];

      if (!itemNameMap[itemId]) {
        return null;
      } else if (itemNameMap[itemId].startsWith("Augmented")) {
        if (augType === config.tokenTypes.RIGHT) {
          set.rightTokens++;
        } else if (augType === config.tokenTypes.LEFT) {
          set.leftTokens++;
        } else if (augType === config.tokenTypes.WEAPON) {
          set.weaponToken = true;
        }
        set.tomes += config.tomeCost[slot];
      } else {
        const raidPiece = slot.startsWith("finger") ? "ring" : slot;
        if (!set.raidPieces.includes(raidPiece)) {
          set.raidPieces.push(slot.startsWith("finger") ? "ring" : slot);
        }
      }

      // Hack for non-augmented tome rings
      if (ringSlots.includes(slot)) {
        ringItemNames.push(itemNameMap[itemId]);
        if (
          ringItemNames.length === 2 && ringItemNames[0] !== ringItemNames[1] &&
          (
            (ringItemNames[0].startsWith("Augmented") && ringItemNames[0].endsWith(ringItemNames[1])) ||
            (ringItemNames[1].startsWith("Augmented") && ringItemNames[1].endsWith(ringItemNames[0]))
          )
        ) {
          // Add an extra ring to the tome counter and remove it from raidPieces
          set.tomes += config.tomeCost[slot];
          const idx = set.raidPieces.indexOf("ring");
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

function getAsEmbed(etroSet: EtroSet) {
  const fields: APIEmbedField[] = [];

  if (etroSet.tomes > 0) {
    fields.push({ name: "Tomes", value: `${etroSet.tomes}`, inline: true });
  }
  if (etroSet.leftTokens > 0) {
    fields.push({ name: config.tokenTypes.LEFT, value: `${etroSet.leftTokens}`, inline: true });
  }
  if (etroSet.rightTokens > 0) {
    fields.push({ name: config.tokenTypes.RIGHT, value: `${etroSet.rightTokens}`, inline: true });
  }
  if (etroSet.weaponToken) {
    fields.push({ name: config.tokenTypes.WEAPON, value: "1", inline: true });
  }

  if (etroSet.dmg) {
    fields.push({ name: config.embedOptions.damageName, value: `${etroSet.dmg}`, inline: false });
  }
  if (etroSet.params?.length) {
    etroSet.params.forEach((p) => {
      fields.push({ name: p.name, value: `${p.value}`, inline: true });
    });
  }
  if (etroSet.gcd?.length) {
    etroSet.gcd.forEach((p) => {
      fields.push({ name: p.name, value: `${p.value}${p.units ? p.units : ""}`, inline: true });
    });
  }
  if (etroSet.food) {
    fields.push({ name: config.embedOptions.foodName, value: `${etroSet.food}`, inline: false });
  }
  if (etroSet.notes) {
    fields.push({ name: config.embedOptions.noteName, value: `\`\`\`${etroSet.notes}\`\`\``, inline: false });
  }

  const description = etroSet.raidPieces.reduce((acc: string, cur: string, i: number) => {
    return `${acc}${cur.charAt(0).toUpperCase()}${cur.substr(1)}${i != etroSet.raidPieces.length - 1 ? ", " : ""}`;
  }, "");
  const embed = new EmbedBuilder()
    .setColor(config.embedOptions.color)
    .setThumbnail(`${config.embedOptions.thumbnailUrl}${etroSet.job}_Solid.png`)
    .setAuthor({
      name: etroSet.name ? etroSet.name : config.embedOptions.name,
      iconURL: config.embedOptions.iconUrl,
      url: `${config.etroUrl}${etroSet.etroId}`,
    })
    .setTitle(config.embedOptions.title)
    .setDescription(description.length > 0 ? description : "None")
    .addFields(fields);
  return embed;
}

// deno-lint-ignore no-explicit-any
async function getJsonFromUrl(url: string, options?: RequestInit): Promise<any> {
  const resp = await fetch(url, options);
  if (!resp.ok) {
    logger.error(`${resp.status}: ${resp.statusText}`);
    logger.error(await resp.text());
    return null;
  }
  const json = await resp.json();
  return json;
}

export default {
  getFromUrl,
  getFromId,
  getAsEmbed,
};
