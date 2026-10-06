import { join } from "@std/path";
import { parse as parseJsonc } from "@std/jsonc";
import Database from "better-sqlite3";
import type { ChatMessages } from "@openrouter/sdk/models";
import { type Client, EmbedBuilder, type User } from "discord.js";
import LLMManager from "../llm/llm-manager.ts";
import config from "../../config.ts";
import logger from "../logger.ts";
import { DIRECTIONS, RP_MODES, SANTA_COLORS, SANTA_LIMITS, TARGETS } from "./constants.ts";

/** A registered Secret Santa participant. */
interface Santa {
  discordId: string;
  name: string;
  address: string;
  notes?: string | null;
}

type PairedSanta = Santa & { receiver: Santa };
type DmPayload = Parameters<User["send"]>[0];

const db = new Database(join(import.meta.dirname!, "../../data/secretsanta.db"));
db.pragma("foreign_keys = ON");

/**
 * Checks if this user is registered with Secret Santa.
 * @param {String} user
 *  The Discord ID of the user to check.
 * @returns
 *  True if this user is registered.
 *  False otherwise.
 */
function isRegistered(user: string) {
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
function getParticipant(discordId: string): Santa {
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
function addSanta(santa: Santa) {
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
function removeSanta(santa: string) {
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
function getReceiver(santa: string) {
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
function getSanta(receiver: string) {
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
function updateGiftStatus(santaId: string, status: string) {
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
function getGiftTrackingList(): { receiver_id: string; gift_status: string; gift_status_timestamp: number }[] {
  const rows = db.prepare("SELECT receiver_id, gift_status, gift_status_timestamp FROM pairings").all();
  return rows as { receiver_id: string; gift_status: string; gift_status_timestamp: number }[];
}

// Directions where the sender is roleplaying as Santa, so the rp-mode transform applies.
const DIRECTIONS_WITH_RP_MODE = new Set<string>([DIRECTIONS.SANTA_TO_RECEIVER, DIRECTIONS.SANTA_TO_PUBLIC, DIRECTIONS.SANTA_TO_USER]);

/**
 * A conversation thread as seen by one participant: the direction of the messages they send into it,
 * and the direction of the messages the other person sends back.
 * Threads must never be mixed: the same two people can talk via the Santa/Receiver pairing, via
 * `/ss msg` -> User with one of them as the anonymous Santa, and the other way around.
 */
interface Thread {
  outgoing: string;
  incoming: string;
}

const THREADS: Record<typeof TARGETS.SANTA | typeof TARGETS.RECEIVER | typeof TARGETS.USER, Thread> = {
  // You talking to your own Santa.
  [TARGETS.SANTA]: { outgoing: DIRECTIONS.RECEIVER_TO_SANTA, incoming: DIRECTIONS.SANTA_TO_RECEIVER },
  // You (as Santa) talking to your receiver.
  [TARGETS.RECEIVER]: { outgoing: DIRECTIONS.SANTA_TO_RECEIVER, incoming: DIRECTIONS.RECEIVER_TO_SANTA },
  // You (as an anonymous Santa) talking to a user you picked via `/ss msg` -> User, and their replies.
  [TARGETS.USER]: { outgoing: DIRECTIONS.SANTA_TO_USER, incoming: DIRECTIONS.USER_TO_SANTA },
};

// The USER thread seen from the view of the user getting messaged with `/ss msg` -> User
const ANONYMOUS_SANTA_THREAD: Thread = { outgoing: THREADS[TARGETS.USER].incoming, incoming: THREADS[TARGETS.USER].outgoing };

// Directions whose conversation history should be fetched for LLM context in transformMessage,
// mapped to the thread that history is restricted to.
const HISTORY_THREAD_FOR_DIRECTION: Record<string, Thread> = {
  [DIRECTIONS.SANTA_TO_RECEIVER]: THREADS.RECEIVER,
  [DIRECTIONS.SANTA_TO_USER]: THREADS.USER,
};

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
async function transformMessage(senderId: string, targetId: string, direction: string, text: string, rpMode?: string) {
  // Non-Santa directions and disabled RP mode send the raw message without any LLM processing.
  if (!DIRECTIONS_WITH_RP_MODE.has(direction) || !rpMode || rpMode === RP_MODES.DISABLED) {
    return text;
  }

  let formattedHistory: ChatMessages[] = [];

  const thread = HISTORY_THREAD_FOR_DIRECTION[direction];
  if (thread) {
    const history = getConversationHistory(senderId, targetId, thread, SANTA_LIMITS.LLM_HISTORY_MESSAGES);

    // Format the database history records into standard LLM conversation objects.
    // Sender is 'assistant' role, Target is 'user' role
    formattedHistory = history.map((msg: Record<string, string>): ChatMessages => ({
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
 * @param {String} direction
 *  The message-routing direction, which identifies the conversation thread the message belongs to.
 * @param {String} originalText
 *  The original raw content submitted by the user.
 * @param {String} processedText
 *  The text that was actually sent.
 */
function logMessage(senderId: string, targetId: string, direction: string, originalText: string, processedText: string) {
  db.prepare(`
    INSERT INTO message_history (sender_id, target_id, direction, original_content, processed_content)
    VALUES (?, ?, ?, ?, ?)
  `).run(senderId, targetId, direction, originalText, processedText);
}

/**
 * Gets the message history for one conversation thread between sender and target.
 * The same two people can have several threads (see THREADS), so messages only count if they were
 * sent in the right direction by the right person.
 * @param {String} senderId
 *  The Discord ID of the user whose conversation thread should be retrieved.
 * @param {String} targetId
 *  The Discord ID of the other participant in the conversation thread.
 * @param {Thread} thread
 *  The thread to look up (one of THREADS), from the point of view of senderId.
 * @param {Number} limit
 *  The maximum number of recent messages to look up. Defaults to -1 (no limit).
 * @returns
 *  An array of history transaction ledger entries sorted chronologically.
 */
function getConversationHistory(senderId: string, targetId: string, thread: Thread, limit = -1) {
  const stmt = db.prepare(`
    SELECT sender_id, target_id, direction, original_content, processed_content, timestamp
    FROM message_history
    WHERE
      (sender_id = ? AND target_id = ? AND direction = ?)
      OR (sender_id = ? AND target_id = ? AND direction = ?)
    ORDER BY message_id DESC
    LIMIT ?
  `);
  return stmt.all(senderId, targetId, thread.outgoing, targetId, senderId, thread.incoming, limit).reverse();
}

/**
 * Gets the distinct users a user has deliberately messaged via `/ss msg` -> User, most recently messaged first.
 * Replies to an anonymous Santa (USER_TO_SANTA) are excluded on purpose, since listing those would
 * reveal who the anonymous Santa is.
 * @param {String} senderId
 *  The Discord ID of the user whose sent messages should be searched.
 * @returns {String[]}
 *  The Discord IDs of every user this user has messaged via `/ss msg` -> User.
 */
function getMessagedTargets(senderId: string): string[] {
  const rows = db.prepare(`
    SELECT target_id
    FROM message_history
    WHERE sender_id = ? AND direction = ?
    GROUP BY target_id
    ORDER BY MAX(message_id) DESC
  `).all(senderId, DIRECTIONS.SANTA_TO_USER);
  return rows.map((row: { target_id: string }) => row.target_id);
}

/**
 * Gets the distinct anonymous Santas who have messaged a user via `/ss msg` -> User, most recent first.
 * @param {String} targetId
 *  The Discord ID of the user who received the messages.
 * @returns {String[]}
 *  The Discord IDs of every santa who has messaged this user anonymously.
 */
function getAnonymousSantas(targetId: string): string[] {
  const rows = db.prepare(`
    SELECT sender_id
    FROM message_history
    WHERE target_id = ? AND direction = ?
    GROUP BY sender_id
    ORDER BY MAX(message_id) DESC
  `).all(targetId, DIRECTIONS.SANTA_TO_USER);
  return rows.map((row: { sender_id: string }) => row.sender_id);
}

/**
 * Gets the receivers of the anonymous Santas who have messaged a user via `/ss msg` -> User, most recent first.
 * This is how an anonymous Santa is identified in the UI ("<receiver>'s Santa"): the Santa's own ID is
 * deliberately never returned so it can't leak.
 * @param {String} targetId
 *  The Discord ID of the user who received the messages.
 * @returns {String[]}
 *  The distinct Discord IDs of those Santas' receivers.
 */
function getAnonymousSantaReceivers(targetId: string): string[] {
  const receiverIds: string[] = [];
  for (const santaId of getAnonymousSantas(targetId)) {
    const receiverId = getReceiver(santaId);
    if (receiverId && !receiverIds.includes(receiverId)) {
      receiverIds.push(receiverId);
    }
  }
  return receiverIds;
}

/**
 * Sets the state of the Secret Santa session as started and DMs every santa their receiver.
 * @returns
 *  False if no valid pairing could be made.
 *  Otherwise an object { failed } listing the Discord IDs of santas who could not be DMed.
 */
async function start(client: Client) {
  const santas = getAll(true);
  if (!santas.length) {
    return false;
  }

  const insertPair = db.prepare("INSERT INTO pairings (santa_id, receiver_id) VALUES (?, ?)");
  const transaction = db.transaction((pairingsList: PairedSanta[]) => {
    // Automatically wipe existing pairings right before inserting new ones
    db.prepare("DELETE FROM pairings").run();

    for (const pair of pairingsList) {
      insertPair.run(pair.discordId, pair.receiver.discordId);
    }
    db.prepare("INSERT INTO config (key, value) VALUES ('game_started', 'true') ON CONFLICT(key) DO UPDATE SET value = 'true'").run();
  });
  transaction(santas);

  return await resendPairs(client);
}

/**
 * DMs each of the given santas a payload.
 * @param {Client} client The Discord client.
 * @param {String[]} santaIds The Discord IDs of the santas to DM.
 * @param {Function} getPayload Given a santa's Discord ID, returns (or resolves to) the message payload to send.
 * @returns {Promise<{failed: String[]}>} The Discord IDs of santas who could not be DMed.
 */
async function dmSantas(client: Client, santaIds: string[], getPayload: (santaId: string) => DmPayload | Promise<DmPayload>) {
  const results = await Promise.allSettled(santaIds.map(async (santaId: string) => {
    const santaUser = await client.users.fetch(santaId);
    await santaUser.send(await getPayload(santaId));
  }));
  return { failed: santaIds.filter((_: string, i: number) => results[i].status === "rejected") };
}

/**
 * Re-sends every santa the embed telling them who their receiver is.
 * @param {Client} client The Discord client.
 * @returns
 *  False if the session hasn't started (there are no pairs).
 *  Otherwise an object { failed } listing the Discord IDs of santas who could not be DMed.
 */
async function resendPairs(client: Client) {
  if (!started()) {
    return false;
  }
  const pairs = getSelectedPairs();
  return await dmSantas(client, Object.keys(pairs), async (santaId: string) => {
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
async function messageAll(client: Client, message: string) {
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
function getEmbedForSanta(user: User, registrationInfo: Santa) {
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
    .setColor(SANTA_COLORS.RECEIVER_ASSIGNED)
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
 * @param {Number} userColor
 *  The embed color to use when the message is sent by a discord user (not a Santa).
 *  Defaults to the color for a user you messaged via `/ss msg` -> User.
 * @returns
 *  The Embed to send.
 */
function getEmbedForMessage(message: string, user?: User | string, userColor: number = SANTA_COLORS.USER) {
  if (!user || typeof user === "string") {
    const row = db.prepare("SELECT value FROM config WHERE key = 'santa_avatar'").get();
    const avatarUrl = row?.value;
    const embed = new EmbedBuilder()
      .setColor(SANTA_COLORS.SANTA)
      .setAuthor({
        name: `${typeof user === "string" ? user + "'s " : ""}${"Santa"}`,
        iconURL: avatarUrl,
      })
      .setDescription(message);
    return embed;
  } else {
    const embed = new EmbedBuilder()
      .setColor(userColor)
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
function getAll(shouldShuffle?: boolean): Santa[] & PairedSanta[] {
  const santas = db.prepare("SELECT discord_id AS discordId, name, address, notes FROM participants").all();
  if (!shouldShuffle) return santas;

  // blacklist lookup: giver -> set of receivers they can't have
  const restrictions = db.prepare("SELECT giver_id, receiver_id FROM restricted_pairs").all();
  const bannedMap = new Map<string, Set<string>>();
  for (const { giver_id, receiver_id } of restrictions) {
    if (!bannedMap.has(giver_id)) bannedMap.set(giver_id, new Set());
    bannedMap.get(giver_id)!.add(receiver_id);
  }

  // separate shuffled pool of receivers to assign from
  const receivers = [...santas];
  shuffle(receivers);

  // santa id -> receiver object chosen so far
  const givesTo = new Map<string, Santa>();
  const usedReceivers = new Set<string>();

  // Backtracking search to pair each santa with a valid receiver
  function assign(santaIndex: number): boolean {
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
    return santas.map((santa: Santa) => ({ ...santa, receiver: givesTo.get(santa.discordId)! }));
  }

  // Return empty if restrictions make pairings mathematically impossible
  return [];
}

/**
 * Gets a map of blacklisted pairs.
 * @returns
 *  A map of the blacklisted pairs.
 */
function getBlacklists(): Record<string, string[]> {
  const rows = db.prepare("SELECT giver_id, receiver_id FROM restricted_pairs").all();
  return rows.reduce((map: Record<string, string[]>, row: Record<string, string>) => {
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
function getSelectedPairs(): Record<string, string> {
  const rows = db.prepare("SELECT santa_id, receiver_id FROM pairings").all();
  return rows.reduce((map: Record<string, string>, row: Record<string, string>) => {
    map[row.santa_id] = row.receiver_id;
    return map;
  }, {});
}

/**
 * Pre-fetches every participant into the client's cache, so interactions are faster.
 * @param {Client} client The Discord client.
 */
async function warmUserCache(client: Client) {
  // Don't fetch unless Secret Santa is active
  if (!started()) {
    return;
  }

  const ids = getAll().map((santa) => santa.discordId);
  const found = new Set<string>();

  // Attempt to fetch using guild gateway first
  const guild = client.guilds.cache.get(config.guilds.CANADALAND);
  if (guild) {
    try {
      const members = await guild.members.fetch({ user: ids });
      members.forEach((member) => found.add(member.id));
    } catch (err) {
      logger.error({ err }, "Bulk member fetch failed, falling back to per-user fetches:");
    }
  }

  // A participant that still fails to fetch is simply left uncached and fetched on demand later.
  await Promise.allSettled(ids.filter((id: string) => !found.has(id)).map((id: string) => client.users.fetch(id)));
}

/**
 * Reads and parses santas-default.jsonc.
 */
function loadDefaults() {
  return parseJsonc(Deno.readTextFileSync(join(import.meta.dirname!, "santas-default.jsonc"))) as {
    santaAvatar?: string;
    defaultRpMode?: string;
    blacklistedPairs?: Record<string, string[]>;
  };
}

/**
 * Loads the default santa config, creates the DB if it doesnt
 * exist, and updates restricted pairs based on the config
 */
function seedDefaults() {
  const santaConf = loadDefaults();
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

    db.prepare("INSERT OR IGNORE INTO config (key, value) VALUES ('game_started', 'false')").run();
    db.prepare("INSERT OR IGNORE INTO config (key, value) VALUES ('channel_id', ?)").run(config.channels.SECRET_SANTA);
    db.prepare("INSERT OR IGNORE INTO config (key, value) VALUES ('santa_avatar', ?)").run(santaConf.santaAvatar);
    db.prepare("INSERT OR IGNORE INTO config (key, value) VALUES ('rp_mode_selection_allowed', 'false')").run();
    db.prepare("INSERT OR IGNORE INTO config (key, value) VALUES ('default_rp_mode', ?)").run(santaConf.defaultRpMode);
  })();
}

/**
 * Sets up Secret Santa. Called once from the ready event.
 * - Initializes the database based on the default config.
 * - Warms up the user cache so that interactions are faster.
 * @param {Client} client The Discord client.
 */
function init(client: Client) {
  db.exec(Deno.readTextFileSync(join(import.meta.dirname!, "ss-schema.sql")));
  seedDefaults();
  warmUserCache(client).catch((err) => logger.error({ err }, "Failed to warm the Secret Santa user cache:"));
}

/**
 * Gets all config keys and values currently stored.
 * @returns
 *  A map of config key -> value.
 */
function getConfig(): Record<string, string> {
  const rows = db.prepare("SELECT key, value FROM config").all();
  return rows.reduce((map: Record<string, string>, row: Record<string, string>) => {
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
function updateConfig(key: string, value: string) {
  const stmt = db.prepare("UPDATE config SET value = ? WHERE key = ?");
  const result = stmt.run(value, key);
  return result.changes > 0;
}

/**
 * Shuffles an array in-place.
 * @param {Array} array
 *  The array to shuffle.
 */
function shuffle<T>(array: T[]) {
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
  THREADS,
  ANONYMOUS_SANTA_THREAD,
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
  getConversationHistory,
  getMessagedTargets,
  getAnonymousSantas,
  getAnonymousSantaReceivers,
  start,
  resendPairs,
  messageAll,
  getEmbedForSanta,
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
