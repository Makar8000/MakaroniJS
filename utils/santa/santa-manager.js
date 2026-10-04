import { join } from "@std/path";
import { parse as parseJsonc } from "@std/jsonc";
import Database from "better-sqlite3";
import { EmbedBuilder } from "discord.js";
import LLMManager from "../llm/llm-manager.js";
import config from "../../config.js";
import logger from "../logger.js";

const db = new Database(join(import.meta.dirname, "../../data/secretsanta.db"));
db.pragma("foreign_keys = ON");

/**
 * Checks if this user is registered with Secret Santa.
 * @param {String} user
 *  The Discord ID of the user to check.
 * @returns
 *  True if this user is registered.
 *  False otherwise.
 */
function isRegistered(user) {
  const stmt = db.prepare("SELECT 1 FROM participants WHERE discord_id = ?");
  return !!stmt.get(user);
}

/**
 * Gets a registered participant's details.
 * @param {String} discordId
 *  The Discord ID of the participant to look up.
 * @returns
 *  The participant's { discordId, name, address, notes }, or undefined if not registered.
 */
function getParticipant(discordId) {
  const row = db.prepare("SELECT discord_id AS discordId, name, address, notes FROM participants WHERE discord_id = ?").get(discordId);
  return row;
}

/**
 * Registers a new user for Secret Santa.
 * @param {Object} santa
 *  The santa object to add.
 * @returns
 *  True if this santa is new.
 *  False if modifying an existing santa.
 */
function addSanta(santa) {
  const existing = isRegistered(santa.discordId);
  const stmt = db.prepare(`
    INSERT INTO participants (discord_id, name, address, notes)
    VALUES (?, ?, ?, ?)
    ON CONFLICT(discord_id) DO UPDATE SET
      name = excluded.name,
      address = excluded.address,
      notes = excluded.notes
  `);
  stmt.run(santa.discordId, santa.name, santa.address, santa.notes);
  return !existing;
}

/**
 * Unregisters a user for Secret Santa.
 * @param {String} santa
 *  The Discord ID of the santa to remove.
 * @returns
 *  True if this santa was removed.
 *  False if this santa didn't exist.
 */
function removeSanta(santa) {
  const stmt = db.prepare("DELETE FROM participants WHERE discord_id = ?");
  const result = stmt.run(santa);
  return result.changes > 0;
}

/**
 * Gets the number of registered santas.
 * @returns The number of registered santas.
 */
function size() {
  const row = db.prepare("SELECT COUNT(*) AS count FROM participants").get();
  return row.count;
}

/**
 * Gets the receiver for a santa.
 * @param {String} santa
 *  The Discord ID of the santa to find the receiver for.
 * @returns
 *  The Discord ID of the receiver for the specified santa.
 *  Returns undefined if the game is not started OR if this santa doesn't have a receiver.
 */
function getReceiver(santa) {
  if (!started()) {
    return undefined;
  }
  const row = db.prepare("SELECT receiver_id FROM pairings WHERE santa_id = ?").get(santa);
  return row?.receiver_id;
}

/**
 * Gets the santa for a receiver.
 * @param {String} receiver
 *  The Discord ID of the receiver to find the santa for.
 * @returns
 *  The Discord ID of the santa for this receiver.
 */
function getSanta(receiver) {
  if (!started()) {
    return undefined;
  }
  const row = db.prepare("SELECT santa_id FROM pairings WHERE receiver_id = ?").get(receiver);
  return row?.santa_id;
}

/**
 * Gets the Secret Santa session status.
 * @returns
 *  True if this Secret Santa session has started.
 *  False if this Secret Santa session is NOT started.
 */
function started() {
  const row = db.prepare("SELECT value FROM config WHERE key = 'game_started'").get();
  return row?.value === "true";
}

/**
 * Gets the primary channel id being used for this Secret Santa session.
 * @returns
 *  The Discord ID of the channel used for this Secret Santa session.
 */
function getChannelId() {
  const row = db.prepare("SELECT value FROM config WHERE key = 'channel_id'").get();
  return row?.value;
}

/**
 * Gets whether users are allowed to pick their own rp-mode on compose/reply modals.
 * @returns
 *  True if rp-mode selection is enabled.
 *  False if the default rp-mode should always be used instead.
 */
function isRpModeSelectionAllowed() {
  const row = db.prepare("SELECT value FROM config WHERE key = 'rp_mode_selection_allowed'").get();
  return row?.value === "true";
}

/**
 * Gets the rp-mode to use when rp-mode selection is disabled, or as the preselected default when
 * it is enabled.
 * @returns
 *  The default rp style ('URIANGER', 'SIMPLE', or 'DISABLED').
 */
function getDefaultRpMode() {
  const row = db.prepare("SELECT value FROM config WHERE key = 'default_rp_mode'").get();
  return row?.value;
}

/**
 * Updates the active gift tracking milestone status.
 * @param {String} santaId
 *  The Discord ID of the santa to update the status for.
 * @param {String} status
 *  The new milestone status string (e.g. 'NOT_SENT', 'SENT', 'DELIVERED').
 * @returns
 *  True if the update was successful.
 *  False otherwise.
 */
function updateGiftStatus(santaId, status) {
  const unixTimestamp = Math.floor(Date.now() / 1000);
  const stmt = db.prepare(`
    UPDATE pairings
    SET gift_status = ?, gift_status_timestamp = ?
    WHERE santa_id = ?
  `);
  const result = stmt.run(status, unixTimestamp, santaId);
  return result.changes > 0;
}

/**
 * Gets a tracking list of all gift statuses and timestamps.
 * @returns {Array} An array of pairing tracking objects.
 */
function getGiftTrackingList() {
  const rows = db.prepare("SELECT receiver_id, gift_status, gift_status_timestamp FROM pairings").all();
  return rows;
}

// Directions where the sender is roleplaying as Santa, so the rp-mode transform applies.
const DIRECTIONS_WITH_RP_MODE = new Set(["SANTA_TO_RECEIVER", "SANTA_TO_PUBLIC", "SANTA_TO_USER"]);

// Directions whose conversation history should be fetched for LLM context in transformMessage.
const DIRECTIONS_WITH_HISTORY = new Set(["SANTA_TO_RECEIVER", "SANTA_TO_USER"]);

// Max number of recent messages passed to the LLM as conversation context.
const HISTORY_LIMIT = 30;

/**
 * Transforms the provided message using conversation history context if applicable.
 * Directions that aren't roleplayed as Santa (see DIRECTIONS_WITH_RP_MODE) return the text as-is.
 * @param {String} senderId
 *  The Discord ID of the user sending the message.
 * @param {String} targetId
 *  The Discord ID of the message's recipient.
 * @param {String} direction
 *  The direction of the message ('SANTA_TO_RECEIVER', 'SANTA_TO_PUBLIC', or 'SANTA_TO_USER').
 * @param {String} text
 *  The raw message text to be filtered or translated.
 * @param {String} rpMode
 *  The RP mode to use for translation.
 * @returns
 *  The post-processed or translated text string.
 */
async function transformMessage(senderId, targetId, direction, text, rpMode) {
  // Non-Santa directions and disabled RP mode send the raw message without any LLM processing.
  if (!DIRECTIONS_WITH_RP_MODE.has(direction) || !rpMode || rpMode === "DISABLED") {
    return text;
  }

  let formattedHistory = [];

  if (DIRECTIONS_WITH_HISTORY.has(direction)) {
    const history = getConversationHistory(senderId, targetId, HISTORY_LIMIT);

    // Format the database history records into standard LLM conversation objects.
    // Sender is 'assistant' role, Target is 'user' role
    formattedHistory = history.map((msg) => ({
      role: msg.sender_id === senderId ? "assistant" : "user",
      content: (msg.sender_id === senderId ? msg.processed_content : null) || msg.original_content,
    }));
  }

  const processedText = await LLMManager.sendSantaPrompt(text, formattedHistory, rpMode);
  return processedText || text;
}

/**
 * Logs a message to the database. Call only after the message was delivered successfully.
 * @param {String} senderId
 *  The Discord ID of the user sending the message.
 * @param {String} targetId
 *  The Discord ID of the message's recipient.
 * @param {String} originalText
 *  The original raw content submitted by the user.
 * @param {String} processedText
 *  The text that was actually sent.
 */
function logMessage(senderId, targetId, originalText, processedText) {
  db.prepare(`
    INSERT INTO message_history (sender_id, target_id, original_content, processed_content)
    VALUES (?, ?, ?, ?)
  `).run(senderId, targetId, originalText, processedText);
}

/**
 * Gets the message history for a 2-party conversation thread between sender and target.
 * @param {String} senderId
 *  The Discord ID of the user whose conversation thread should be retrieved.
 * @param {String} targetId
 *  The Discord ID of the other participant in the conversation thread.
 * @param {Number} limit
 *  The maximum number of recent messages to look up. Defaults to -1 (no limit).
 * @returns
 *  An array of history transaction ledger entries sorted chronologically.
 */
function getConversationHistory(senderId, targetId, limit = -1) {
  const stmt = db.prepare(`
    SELECT sender_id, target_id, original_content, processed_content, timestamp
    FROM message_history
    WHERE
      (sender_id = ? AND target_id = ?)
      OR (sender_id = ? AND target_id = ?)
    ORDER BY message_id DESC
    LIMIT ?
  `);
  return stmt.all(senderId, targetId, targetId, senderId, limit).reverse();
}

/**
 * Sets the state of the Secret Santa session as started and DMs every santa their receiver.
 * @returns
 *  False if no valid pairing could be made.
 *  Otherwise an object { failed } listing the Discord IDs of santas who could not be DMed.
 */
// deno-lint-ignore require-await
async function start(client) {
  const santas = getAll(true);
  if (!santas.length) {
    return false;
  }

  const insertPair = db.prepare("INSERT INTO pairings (santa_id, receiver_id) VALUES (?, ?)");
  const transaction = db.transaction((pairingsList) => {
    // Automatically wipe existing pairings right before inserting new ones
    db.prepare("DELETE FROM pairings").run();

    for (const pair of pairingsList) {
      insertPair.run(pair.discordId, pair.receiver.discordId);
    }
    db.prepare("INSERT INTO config (key, value) VALUES ('game_started', 'true') ON CONFLICT(key) DO UPDATE SET value = 'true'").run();
  });
  transaction(santas);

  return resendPairs(client);
}

/**
 * DMs each of the given santas a payload.
 * @param {Client} client The Discord client.
 * @param {String[]} santaIds The Discord IDs of the santas to DM.
 * @param {Function} getPayload Given a santa's Discord ID, returns (or resolves to) the message payload to send.
 * @returns {Promise<{failed: String[]}>} The Discord IDs of santas who could not be DMed.
 */
async function dmSantas(client, santaIds, getPayload) {
  const results = await Promise.allSettled(santaIds.map(async (santaId) => {
    const santaUser = await client.users.fetch(santaId);
    await santaUser.send(await getPayload(santaId));
  }));
  return { failed: santaIds.filter((_, i) => results[i].status === "rejected") };
}

/**
 * Re-sends every santa the embed telling them who their receiver is.
 * @param {Client} client The Discord client.
 * @returns
 *  False if the session hasn't started (there are no pairs).
 *  Otherwise an object { failed } listing the Discord IDs of santas who could not be DMed.
 */
// deno-lint-ignore require-await
async function resendPairs(client) {
  if (!started()) {
    return false;
  }
  const pairs = getSelectedPairs();
  return dmSantas(client, Object.keys(pairs), async (santaId) => {
    const receiverId = pairs[santaId];
    const receiverUser = await client.users.fetch(receiverId);
    return { embeds: [getEmbedForSanta(receiverUser, getParticipant(receiverId))] };
  });
}

/**
 * DMs a message from Santa to every registered santa.
 * @param {Client} client The Discord client.
 * @param {String} message The message to send.
 * @returns {Promise<{sent: Number, failed: String[]}>} How many santas were messaged, and who could not be DMed.
 */
async function messageAll(client, message) {
  const ids = getAll().map((santa) => santa.discordId);
  const { failed } = await dmSantas(client, ids, () => ({ embeds: [getEmbedForMessage(message)] }));
  return { sent: ids.length - failed.length, failed };
}

/**
 * Gets an embed to send to the Secret Santa about their receiver.
 * @param {User} user
 *  The receiver (Discord User) of the Santa.
 * @param {Object} registrationInfo
 *  The receiver (Santa Object) of the Santa.
 * @returns
 *  The Embed to send to the Santa.
 */
function getEmbedForSanta(user, registrationInfo) {
  const fields = [{
    name: "Name",
    value: `${registrationInfo.name}`,
    inline: false,
  }, {
    name: "Address",
    value: `${registrationInfo.address}`,
    inline: false,
  }, {
    name: "Notes",
    value: `${registrationInfo.notes || "None"}`,
    inline: false,
  }];
  const embed = new EmbedBuilder()
    .setColor(0x22E669)
    .setAuthor({
      name: `${user.displayName} was selected as your receiver!`,
      iconURL: user.displayAvatarURL(),
    })
    .setDescription("Send them a gift for Christmas :)")
    .addFields(fields);
  return embed;
}

/**
 * Gets an embed to send to the Secret Santa / Receiver with a custom message.
 * @param {String} message
 *  The message to send.
 * @param {User | String} user
 *  The discord user who will send the message, or Santa if undefined.
 *  Can also be a string if the Santa is for someone else
 * @returns
 *  The Embed to send.
 */
function getEmbedForMessage(message, user) {
  if (!user || typeof user === "string") {
    const row = db.prepare("SELECT value FROM config WHERE key = 'santa_avatar'").get();
    const avatarUrl = row?.value;
    const embed = new EmbedBuilder()
      .setColor(0xE74C3C)
      .setAuthor({
        name: `${typeof user === "string" ? user + "'s " : ""}${"Santa"}`,
        iconURL: avatarUrl,
      })
      .setDescription(message);
    return embed;
  } else {
    const embed = new EmbedBuilder()
      .setColor(0xB377FF)
      .setAuthor({
        name: user.displayName,
        iconURL: user.displayAvatarURL(),
      })
      .setDescription(message);
    return embed;
  }
}

/**
 * Resets the state of the Secret Santa session.
 */
function reset() {
  const transaction = db.transaction(() => {
    db.prepare("DELETE FROM pairings").run();
    db.prepare("DELETE FROM message_history").run();
    db.prepare("INSERT INTO config (key, value) VALUES ('game_started', 'false') ON CONFLICT(key) DO UPDATE SET value = 'false'").run();
  });
  transaction();
}

/**
 * Gets registered santas. If shouldShuffle is true, every santa is paired
 * with a receiver (or an empty array if no valid full pairing exists).
 * @param {Boolean} shouldShuffle Whether to randomly arrange participants.
 * @returns {Array} Santa objects, each with a .receiver property when shuffled.
 */
function getAll(shouldShuffle) {
  const santas = db.prepare("SELECT discord_id AS discordId, name, address, notes FROM participants").all();
  if (!shouldShuffle) return santas;

  // blacklist lookup: giver -> set of receivers they can't have
  const restrictions = db.prepare("SELECT giver_id, receiver_id FROM restricted_pairs").all();
  const bannedMap = new Map();
  for (const { giver_id, receiver_id } of restrictions) {
    if (!bannedMap.has(giver_id)) bannedMap.set(giver_id, new Set());
    bannedMap.get(giver_id).add(receiver_id);
  }

  // separate shuffled pool of receivers to assign from
  const receivers = [...santas];
  shuffle(receivers);

  // santa id -> receiver object chosen so far
  const givesTo = new Map();
  const usedReceivers = new Set();

  // Backtracking search to pair each santa with a valid receiver
  function assign(santaIndex) {
    if (santaIndex === santas.length) return true;

    const santa = santas[santaIndex];

    for (const receiver of receivers) {
      // already taken
      if (usedReceivers.has(receiver.discordId)) continue;
      // no self-gifting
      if (santa.discordId === receiver.discordId) continue;
      // blacklisted
      if (bannedMap.get(santa.discordId)?.has(receiver.discordId)) continue;
      // no direct swaps (A <-> B); this is what makes every loop at least 3 long
      if (givesTo.get(receiver.discordId)?.discordId === santa.discordId) continue;

      usedReceivers.add(receiver.discordId);
      givesTo.set(santa.discordId, receiver);

      // try to pair the rest of the santas with this pick locked in
      if (assign(santaIndex + 1)) return true;

      // didn't work out, undo and try the next receiver
      usedReceivers.delete(receiver.discordId);
      givesTo.delete(santa.discordId);
    }
    // no receiver worked for this santa
    return false;
  }

  // start the search from the first santa
  if (assign(0)) {
    return santas.map((santa) => ({ ...santa, receiver: givesTo.get(santa.discordId) }));
  }

  // Return empty if restrictions make pairings mathematically impossible
  return [];
}

/**
 * Gets a map of blacklisted pairs.
 * @returns
 *  A map of the blacklisted pairs.
 */
function getBlacklists() {
  const rows = db.prepare("SELECT giver_id, receiver_id FROM restricted_pairs").all();
  return rows.reduce((map, row) => {
    if (!map[row.giver_id]) {
      map[row.giver_id] = [];
    }
    map[row.giver_id].push(row.receiver_id);
    return map;
  }, {});
}

/**
 * Gets a map of selected pairs.
 * @returns
 *  A map of the selected pairs.
 */
function getSelectedPairs() {
  const rows = db.prepare("SELECT santa_id, receiver_id FROM pairings").all();
  return rows.reduce((map, row) => {
    map[row.santa_id] = row.receiver_id;
    return map;
  }, {});
}

/**
 * Pre-fetches every participant into the client's cache, so interactions are faster.
 * @param {Client} client The Discord client.
 */
async function warmUserCache(client) {
  // Don't fetch unless Secret Santa is active
  if (!started()) {
    return;
  }

  const ids = getAll().map((santa) => santa.discordId);
  const found = new Set();

  // Attempt to fetch using guild gateway first
  const guild = client.guilds.cache.get(config.guilds.CANADALAND);
  if (guild) {
    try {
      const members = await guild.members.fetch({ user: ids });
      members.forEach((member) => found.add(member.id));
    } catch (err) {
      logger.error("Bulk member fetch failed, falling back to per-user fetches:", err);
    }
  }

  // A participant that still fails to fetch is simply left uncached and fetched on demand later.
  await Promise.allSettled(ids.filter((id) => !found.has(id)).map((id) => client.users.fetch(id)));
}

/**
 * Loads the default santa config. Only called when the DB hasn't been seeded yet.
 */
function seedDefaults() {
  const santaConf = parseJsonc(Deno.readTextFileSync(join(import.meta.dirname, "santas-default.jsonc")));
  if (!santaConf.santaAvatar) {
    throw new Error("No Santa avatar defined");
  }
  if (!santaConf.defaultRpMode) {
    throw new Error("No default rp-mode defined");
  }

  // One transaction so a failure part-way through can't leave a half-seeded config behind.
  db.transaction(() => {
    if (santaConf.blacklistedPairs) {
      const insertPair = db.prepare("INSERT OR IGNORE INTO restricted_pairs (giver_id, receiver_id) VALUES (?, ?)");
      for (const [giver, receivers] of Object.entries(santaConf.blacklistedPairs)) {
        for (const receiver of receivers) {
          insertPair.run(giver, receiver);
        }
      }
    }

    db.prepare("INSERT INTO config (key, value) VALUES ('game_started', 'false')").run();
    db.prepare("INSERT INTO config (key, value) VALUES ('channel_id', ?)").run(config.channels.SECRET_SANTA);
    db.prepare("INSERT INTO config (key, value) VALUES ('santa_avatar', ?)").run(santaConf.santaAvatar);
    db.prepare("INSERT INTO config (key, value) VALUES ('rp_mode_selection_allowed', 'false')").run();
    db.prepare("INSERT INTO config (key, value) VALUES ('default_rp_mode', ?)").run(santaConf.defaultRpMode);
  })();
}

/**
 * Sets up Secret Santa. Called once from the ready event.
 * - Initializes the database based on the default config.
 * - Warms up the user cache so that interactions are faster.
 * @param {Client} client The Discord client.
 */
function init(client) {
  db.exec(Deno.readTextFileSync(join(import.meta.dirname, "ss-schema.sql")));
  if (!db.prepare("SELECT 1 FROM config WHERE key = 'game_started'").get()) {
    seedDefaults();
  }
  warmUserCache(client).catch((err) => logger.error("Failed to warm the Secret Santa user cache:", err));
}

/**
 * Gets all config keys and values currently stored.
 * @returns
 *  A map of config key -> value.
 */
function getConfig() {
  const rows = db.prepare("SELECT key, value FROM config").all();
  return rows.reduce((map, row) => {
    map[row.key] = row.value;
    return map;
  }, {});
}

/**
 * Updates the value of an existing config key.
 * @param {String} key
 *  The config key to update.
 * @param {String} value
 *  The new value to set for this key.
 * @returns
 *  True if the key existed and was updated.
 *  False if the key does not exist.
 */
function updateConfig(key, value) {
  const stmt = db.prepare("UPDATE config SET value = ? WHERE key = ?");
  const result = stmt.run(value, key);
  return result.changes > 0;
}

/**
 * Shuffles an array in-place.
 * @param {Array} array
 *  The array to shuffle.
 */
function shuffle(array) {
  for (let i = array.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    const temp = array[i];
    array[i] = array[j];
    array[j] = temp;
  }
}

/**
 * Closes the database. Called on shutdown so SQLite flushes cleanly.
 */
function close() {
  db.close();
}

export default {
  DIRECTIONS_WITH_RP_MODE,
  isRegistered,
  getParticipant,
  addSanta,
  removeSanta,
  size,
  getReceiver,
  getSanta,
  started,
  getChannelId,
  isRpModeSelectionAllowed,
  getDefaultRpMode,
  updateGiftStatus,
  getGiftTrackingList,
  transformMessage,
  logMessage,
  start,
  resendPairs,
  messageAll,
  getEmbedForMessage,
  reset,
  getAll,
  getBlacklists,
  getSelectedPairs,
  init,
  getConfig,
  updateConfig,
  close,
};
