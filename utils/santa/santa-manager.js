import fs from 'fs';
import path from 'path';
import Database from 'better-sqlite3';
import { EmbedBuilder } from 'discord.js';
import LLMManager from '../llm/llm-manager.js';
import JSON5 from 'json5';
import config from '../../config.js';

const db = new Database('./data/secretsanta.db');
db.pragma('foreign_keys = ON');
/* eslint-disable quotes */

/**
 * Checks if this user is registered with Secret Santa.
 * @param {String} user
 *  The Discord ID of the user to check.
 * @returns
 *  True if this user is registered.
 *  False otherwise.
 */
async function isRegistered(user) {
  const stmt = db.prepare('SELECT 1 FROM participants WHERE discord_id = ?');
  return !!stmt.get(user);
}

/**
 * Registers a new user for Secret Santa.
 * @param {Object} santa
 *  The santa object to add.
 * @returns
 *  True if this santa is new.
 *  False if modifying an existing santa.
 */
async function addSanta(santa) {
  const existing = await isRegistered(santa.discordId);
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
async function removeSanta(santa) {
  const stmt = db.prepare('DELETE FROM participants WHERE discord_id = ?');
  const result = stmt.run(santa);
  return result.changes > 0;
}

/**
 * Gets the number of registered santas.
 * @returns The number of registered santas.
 */
async function size() {
  const row = db.prepare('SELECT COUNT(*) AS count FROM participants').get();
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
async function getReceiver(santa) {
  if (!(await started())) {
    return undefined;
  }
  const row = db.prepare('SELECT receiver_id FROM pairings WHERE santa_id = ?').get(santa);
  return row?.receiver_id;
}

/**
 * Gets the santa for a receiver.
 * @param {String} receiver
 *  The Discord ID of the receiver to find the santa for.
 * @returns
 *  The Discord ID of the santa for this receiver.
 */
async function getSanta(receiver) {
  if (!(await started())) {
    return undefined;
  }
  const row = db.prepare('SELECT santa_id FROM pairings WHERE receiver_id = ?').get(receiver);
  return row?.santa_id;
}

/**
 * Gets the Secret Santa session status.
 * @returns
 *  True if this Secret Santa session has started.
 *  False if this Secret Santa session is NOT started.
 */
async function started() {
  const row = db.prepare("SELECT value FROM config WHERE key = 'game_started'").get();
  return row?.value === 'true';
}

/**
 * Gets the primary channel id being used for this Secret Santa session.
 * @returns
 *  The Discord ID of the channel used for this Secret Santa session.
 */
async function getChannelId() {
  const row = db.prepare("SELECT value FROM config WHERE key = 'channel_id'").get();
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
async function updateGiftStatus(santaId, status) {
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
async function getGiftTrackingList() {
  const rows = db.prepare('SELECT receiver_id, gift_status, gift_status_timestamp FROM pairings').all();
  return rows;
}

/**
 * Transforms the provided message using conversation history context if applicable.
 * @param {String} santaId
 *  The Discord ID of the santa sending the message.
 * @param {String} direction
 *  The dynamic routing classification track (e.g. 'SANTA_TO_RECEIVER' or 'SANTA_TO_PUBLIC').
 * @param {String} text
 *  The raw message text to be filtered or translated.
 * @returns
 *  The post-processed or translated text string.
 */
async function transformMessage(santaId, direction, text) {
  let formattedHistory = [];

  // Only fetch history if it is a private direct message to the receiver
  if (direction === 'SANTA_TO_RECEIVER') {
    const history = await getMessageHistory(santaId);

    // Format the database history records into standard LLM conversation objects
    formattedHistory = history.map(msg => {
      if (msg.direction === 'SANTA_TO_RECEIVER') {
        return {
          role: 'assistant',
          content: msg.processed_content || msg.original_content,
        };
      } else {
        return {
          role: 'user',
          content: msg.original_content,
        };
      }
    });
  }

  const processedText = await LLMManager.sendSantaPrompt(text, formattedHistory);
  return processedText || text;
}

/**
 * Logs a message to the database and applies a transformation filter if applicable.
 * @param {String} senderId
 *  The Discord ID of the user sending the message.
 * @param {String} direction
 *  The dynamic routing classification track.
 * @param {String} originalText
 *  The original raw content submitted by the user.
 * @returns
 *  The transformed text if filtered, or the original text string.
 */
async function logAndTransformMessage(senderId, direction, originalText) {
  let processedText = originalText;
  if (direction === 'SANTA_TO_RECEIVER' || direction === 'SANTA_TO_PUBLIC') {
    processedText = await transformMessage(senderId, direction, originalText);
  }
  const stmt = db.prepare(`
    INSERT INTO message_history (sender_id, direction, original_content, processed_content)
    VALUES (?, ?, ?, ?)
  `);
  stmt.run(senderId, direction, originalText, processedText);
  return processedText;
}

/**
 * Gets the recent message history context window between two matched participants.
 * @param {String} santaId
 *  The Discord ID of the santa whose matching history should be retrieved.
 * @param {Number} limit
 *  The maximum number of recent messages to look up. Defaults to -1 (no limit).
 * @returns
 *  An array of history transaction ledger entries sorted chronologically.
 */
async function getMessageHistory(santaId, limit = -1) {
  const stmt = db.prepare(`
    SELECT h.direction, h.original_content, h.processed_content, h.timestamp 
    FROM message_history h
    JOIN pairings p ON p.santa_id = ?
    WHERE 
      -- Matches messages sent by the Santa
      (h.sender_id = p.santa_id AND h.direction = 'SANTA_TO_RECEIVER')
      -- Matches messages sent by the Receiver
      OR (h.sender_id = p.receiver_id AND h.direction = 'RECEIVER_TO_SANTA')
    ORDER BY h.timestamp DESC
    LIMIT ?
  `);
  return stmt.all(santaId, limit).reverse();
}

/**
 * Sets the state of the Secret Santa session as started.
 * @returns
 *  True if successfully started. False otherwise.
 */
async function start(client) {
  const santas = await getAll(true);
  if (!santas.length) {
    return false;
  }

  const transaction = db.transaction((pairingsList) => {
    // Automatically wipe existing pairings right before inserting new ones
    db.prepare('DELETE FROM pairings').run();

    for (const pair of pairingsList) {
      const stmt = db.prepare('INSERT INTO pairings (santa_id, receiver_id) VALUES (?, ?)');
      stmt.run(pair.discordId, pair.receiver.discordId);
    }
    db.prepare("INSERT INTO config (key, value) VALUES ('game_started', 'true') ON CONFLICT(key) DO UPDATE SET value = 'true'").run();
  });
  transaction(santas);

  for (const santa of santas) {
    const santaUser = await client.users.fetch(santa.discordId);
    const receiverUser = await client.users.fetch(santa.receiver.discordId);
    santaUser.send({
      embeds: [getEmbedForSanta(receiverUser, santa.receiver)],
    });
  }
  return true;
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
    name: 'Name',
    value: `${registrationInfo.name}`,
    inline: false,
  }, {
    name: 'Address',
    value: `${registrationInfo.address}`,
    inline: false,
  }, {
    name: 'Notes',
    value: `${registrationInfo.notes}`,
    inline: false,
  }];
  const embed = new EmbedBuilder()
    .setColor(0x22E669)
    .setAuthor({
      name: `${user.displayName} was selected as your receiver!`,
      iconURL: `https://cdn.discordapp.com/avatars/${user.id}/${user.avatar}.png`,
    })
    .setDescription('Send them a gift for Christmas :)')
    .addFields(fields);
  return embed;
}

/**
 * Gets an embed to send to the Secret Santa / Receiver with a custom message.
 * @param {String} message
 *  The message to send.
 * @param {User} user
 *  The discord user who will send the message, or Santa if undefined.
 * @returns
 *  The Embed to send.
 */
async function getEmbedForMessage(message, user) {
  if (!user) {
    const row = db.prepare("SELECT value FROM config WHERE key = 'santa_avatar'").get();
    const avatarUrl = row?.value;
    const embed = new EmbedBuilder()
      .setColor(0xE74C3C)
      .setAuthor({
        name: 'Santa',
        iconURL: avatarUrl,
      })
      .setDescription(message);
    return embed;
  } else {
    const embed = new EmbedBuilder()
      .setColor(0xB377FF)
      .setAuthor({
        name: user.displayName,
        iconURL: `https://cdn.discordapp.com/avatars/${user.id}/${user.avatar}.png`,
      })
      .setDescription(message);
    return embed;
  }
}

/**
 * Resets the state of the Secret Santa session.
 */
async function reset() {
  const transaction = db.transaction(() => {
    db.prepare('DELETE FROM pairings').run();
    db.prepare('DELETE FROM message_history').run();
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
async function getAll(shouldShuffle) {
  const santas = db.prepare('SELECT discord_id AS discordId, name, address, notes FROM participants').all();
  if (!shouldShuffle) return santas;
  if (santas.length < 3) return [];

  // the min size of an assignment chain/circle
  const MIN_LOOP_SIZE = 3;

  // blacklist lookup: giver -> set of receivers they can't have
  const restrictions = db.prepare('SELECT giver_id, receiver_id FROM restricted_pairs').all();
  const bannedMap = new Map();
  for (const { giver_id, receiver_id } of restrictions) {
    if (!bannedMap.has(giver_id)) bannedMap.set(giver_id, new Set());
    bannedMap.get(giver_id).add(receiver_id);
  }

  // separate shuffled pool of receivers to assign from
  const receivers = [...santas];
  shuffle(receivers);

  // helpers for tracking who's assigned to who
  const santaIndexById = new Map(santas.map((santa, index) => [santa.discordId, index]));
  const assignment = new Array(santas.length);
  const usedReceivers = new Set();

  // Makes sure every gifting loop is at least MIN_LOOP_SIZE long,
  // otherwise two people could end up gifting directly to each other.
  function hasOnlyValidLoops() {
    const visited = new Array(santas.length).fill(false);
    for (let i = 0; i < santas.length; i++) {
      if (visited[i]) continue;

      let loopLength = 0;
      let current = i;
      while (!visited[current]) {
        visited[current] = true;
        loopLength++;
        const receiverId = receivers[assignment[current]].discordId;
        current = santaIndexById.get(receiverId);
      }

      if (loopLength < MIN_LOOP_SIZE) return false;
    }
    return true;
  }

  // Backtracking search to pair each santa with a valid receiver
  function assign(santaIndex) {
    if (santaIndex === santas.length) return hasOnlyValidLoops();

    const santa = santas[santaIndex];

    for (let i = 0; i < receivers.length; i++) {
      const receiver = receivers[i];

      // already taken
      if (usedReceivers.has(receiver.discordId)) continue;
      // no self-gifting
      if (santa.discordId === receiver.discordId) continue;
      // blacklisted
      if (bannedMap.get(santa.discordId)?.has(receiver.discordId)) continue;

      usedReceivers.add(receiver.discordId);
      assignment[santaIndex] = i;

      // try to pair the rest of the santas with this pick locked in
      if (assign(santaIndex + 1)) return true;

      // didn't work out, undo and try the next receiver
      usedReceivers.delete(receiver.discordId);
      assignment[santaIndex] = undefined;
    }
    // no receiver worked for this santa
    return false;
  }

  // start the search from the first santa
  if (assign(0)) {
    return santas.map((santa, index) => ({ ...santa, receiver: receivers[assignment[index]] }));
  }

  // Return empty if restrictions make pairings mathematically impossible
  return [];
}

/**
 * Gets a map of blacklisted pairs.
 * @returns
 *  A map of the blacklisted pairs.
 */
async function getBlacklists() {
  const rows = db.prepare('SELECT giver_id, receiver_id FROM restricted_pairs').all();
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
async function getSelectedPairs() {
  const rows = db.prepare('SELECT santa_id, receiver_id FROM pairings').all();
  return rows.reduce((map, row) => {
    map[row.santa_id] = row.receiver_id;
    return map;
  }, {});
}

/**
 *
 * @returns
 *  A string representation of all the santas currently registered.
 */
async function toString() {
  const rows = db.prepare('SELECT name, discord_id, address, notes FROM participants').all();
  return rows.map(s => `Name: ${s.name}\nDiscord ID: ${s.discord_id}\nAddress: ${s.address}\nNotes: ${s.notes}\n\n`).join('');
}

/**
 * Loads the default santa config if one doesn't already exist
 */
async function initSantas() {
  try {
    const schemaPath = path.resolve('./utils/santa/ss-schema.sql');
    if (fs.existsSync(schemaPath)) {
      const schema = fs.readFileSync(schemaPath, 'utf8');
      db.exec(schema);
    }

    // Validate whether or not the DB has been initialized
    const hasInitializedConfig = db.prepare("SELECT 1 FROM config WHERE key = 'game_started'").get();
    if (!hasInitializedConfig) {
      // Set default config
      const santaConfigPath = './utils/santa/santas-default.jsonc';
      if (fs.existsSync(santaConfigPath)) {
        const santaConf = JSON5.parse(fs.readFileSync(santaConfigPath, 'utf8'));
        if (!santaConf.santaAvatar) {
          throw new Error('No Santa avatar defined');
        }
        if (santaConf.blacklistedPairs) {
          const insertPair = db.prepare('INSERT OR IGNORE INTO restricted_pairs (giver_id, receiver_id) VALUES (?, ?)');
          for (const [giver, receivers] of Object.entries(santaConf.blacklistedPairs)) {
            for (const receiver of receivers) {
              insertPair.run(giver, receiver);
            }
          }
        }

        db.prepare("INSERT INTO config (key, value) VALUES ('game_started', 'false')").run();
        db.prepare("INSERT INTO config (key, value) VALUES ('channel_id', ?)").run(config.channels.SECRET_SANTA);
        db.prepare("INSERT INTO config (key, value) VALUES ('santa_avatar', ?)").run(santaConf.santaAvatar);
      } else {
        throw new Error('No default config');
      }
    }
  } catch (err) {
    console.error('Failed to init database setup execution structure:', err);
  }
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

export default {
  isRegistered,
  addSanta,
  removeSanta,
  size,
  getReceiver,
  getSanta,
  started,
  getChannelId,
  updateGiftStatus,
  getGiftTrackingList,
  logAndTransformMessage,
  getMessageHistory,
  start,
  getEmbedForMessage,
  reset,
  getAll,
  getBlacklists,
  getSelectedPairs,
  toString,
  initSantas,
};