const fs = require('fs');
const path = require('path');
const Keyv = require('keyv');
const { KeyvFile } = require('keyv-file');
const { EmbedBuilder } = require('discord.js');
const config = require(path.join(__dirname, '../../config.js'));

const santasDb = new Keyv({
  namespace: 'secretsanta',
  store: new KeyvFile({
    filename: path.join(__dirname, '../../data/santas.json'),
  }),
});
const santasConfigKey = 'santasConfig';

/**
 * Checks if this user is registered with Secret Santa.
 * @param {String} user
 *  The Discord ID of the user to check.
 * @returns
 *  True if this user is registered.
 *  False otherwise.
 */
async function isRegistered(user) {
  const santasConfig = await santasDb.get(santasConfigKey);
  return !!santasConfig.santas[user];
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
  const santasConfig = await santasDb.get(santasConfigKey);
  const ret = santasConfig.santas[santa.discordId];
  santasConfig.santas[santa.discordId] = santa;
  await santasDb.set(santasConfigKey, santasConfig);
  return !ret;
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
  const santasConfig = await santasDb.get(santasConfigKey);
  const ret = santasConfig.santas[santa];
  delete santasConfig.santas[santa];
  await santasDb.set(santasConfigKey, santasConfig);
  return !!ret;
}

/**
 * Gets the number of registered santas.
 * @returns The number of registered santas.
 */
async function size() {
  const santasConfig = await santasDb.get(santasConfigKey);
  if (!santasConfig?.santas) {
    return 0;
  }
  return Object.keys(santasConfig?.santas).length;
}

/**
 * Sets the receiver for a santa.
 * @param {String} santa
 *  The Discord ID of the santa to set the receiver for.
 * @param {String} receiver
 *  The Discord ID of the receiver.
 */
async function setReceiver(santa, receiver) {
  const santasConfig = await santasDb.get(santasConfigKey);
  santasConfig.selectedPairs[santa] = receiver;
  await santasDb.set(santasConfigKey, santasConfig);
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
  const santasConfig = await santasDb.get(santasConfigKey);
  if (!santasConfig?.gameStarted) {
    return undefined;
  }
  return santasConfig?.selectedPairs[santa];
}

/**
 * Gets the santa for a receiver.
 * @param {String} receiver
 *  The Discord ID of the receiver to find the santa for.
 * @returns
 *  The Discord ID of the santa for this receiver.
 */
async function getSanta(receiver) {
  const santasConfig = await santasDb.get(santasConfigKey);
  if (!santasConfig?.gameStarted) {
    return undefined;
  }

  for (const [santa, rec] of Object.entries(santasConfig?.selectedPairs)) {
    if (rec === receiver) {
      return santa;
    }
  }
  return undefined;
}

/**
 * Gets the Secret Santa session status.
 * @returns
 *  True if this Secret Santa session has started.
 *  False if this Secret Santa session is NOT started.
 */
async function started() {
  const santasConfig = await santasDb.get(santasConfigKey);
  return santasConfig?.gameStarted;
}

/**
 * Gets the primary channel id being used for this Secret Santa session.
 * @returns
 *  The Discord ID of the channel used for this Secret Santa session.
 */
async function getChannelId() {
  const santasConfig = await santasDb.get(santasConfigKey);
  return santasConfig?.channelId;
}

/**
 * Sets the state of the Secret Santa session as started.
 * @returns
 *  True if successfully started. False otherwise.
 */
async function start(client) {
  const santas = await getAll();
  if (!santas.length) {
    return false;
  }
  for (let i = 0; i < santas.length; i++) {
    const j = i === (santas.length - 1) ? 0 : i + 1;
    const santa = santas[i].discordId;
    const receiver = santas[j].discordId;
    await setReceiver(santa, receiver);
    const santaUser = await client.users.fetch(santa);
    const receiverUser = await client.users.fetch(receiver);
    santaUser.send({
      embeds: [getEmbedForSanta(receiverUser)],
    });
  }
  const santasConfig = await santasDb.get(santasConfigKey);
  santasConfig.gameStarted = true;
  await santasDb.set(santasConfigKey, santasConfig);
  return true;
}

/**
 * Gets an embed to send to the Secret Santa about their receiver.
 * @param {User} user
 *  The receiver of the Santa.
 * @returns
 *  The Embed to send to the Santa.
 */
function getEmbedForSanta(user) {
  const fields = [{
    name: 'Name',
    value: `${user.name}`,
    inline: false,
  }, {
    name: 'Address',
    value: `${user.address}`,
    inline: false,
  }, {
    name: 'Notes',
    value: `${user.notes}`,
    inline: false,
  }];
  const embed = new EmbedBuilder()
    .setColor(0xE67E22)
    .setAuthor({
      name: `${user.username} was selected as your receiver!`,
      iconURL: `https://cdn.discordapp.com/avatars/${user.id}/${user.avatar}.png`,
    })
    .setDescription('Send them a gift for Christmas :)')
    .addFields(fields);
  return embed;
}

/**
 * Fully resets the state of the Secret Santa session.
 */
async function reset() {
  const santasConfig = await santasDb.get(santasConfigKey);
  santasConfig.santas = {};
  santasConfig.selectedPairs = {};
  santasConfig.gameStarted = false;
  await santasDb.set(santasConfigKey, santasConfig);
}

/**
 *
 * @returns
 *  An array of santa objects currently registered.
 */
async function getAll() {
  const santasConfig = await santasDb.get(santasConfigKey);
  const ret = Object.values(santasConfig.santas);
  if (ret.length < 3) { return []; }
  shuffle(ret);
  while (!(await checkExclusions(ret))) {
    shuffle(ret);
  }
  return ret;
}

/**
 * Gets a map of blacklisted pairs.
 * @returns
 *  A map of the blacklisted pairs.
 */
async function getBlacklists() {
  const santasConfig = await santasDb.get(santasConfigKey);
  return santasConfig?.blacklistedPairs;
}

/**
 *
 * @returns
 *  A string representation of all the santas currently registered.
 */
async function toString() {
  const santasConfig = await santasDb.get(santasConfigKey);
  return Object.values(santasConfig.santas).reduce((ret, s) => {
    ret += `Name: ${s.name}\nDiscord ID: ${s.discordId}\nAddress: ${s.address}\nNotes: ${s.notes}\n\n`;
  }, '');
}

/**
 * Checks if the array provided is valid (blacklists are not violated).
 * @param {Array} santas
 *  The array of santa objects.
 * @returns
 *  True if this array is sorted in a way that respects blacklists.
 *  False if this array sorting conflicts with blacklists.
 */
async function checkExclusions(santas) {
  if (santas.length < 2) {
    return true;
  }

  const santasConfig = await santasDb.get(santasConfigKey);
  for (let i = 0; i < santas.length; i++) {
    const j = i === santas.length - 1 ? 0 : i + 1;
    const santaId = santas[i].discordId;
    const receiverId = santas[j].discordId;

    const blkListedReceivers = santasConfig.blacklistedPairs[santaId];
    if (!blkListedReceivers || blkListedReceivers?.length === 0) {
      continue;
    }

    for (const blkListedReceiver of blkListedReceivers) {
      if (receiverId === blkListedReceiver) {
        return false;
      }
    }
  }

  return true;
}

async function initSantas() {
  if (!(await santasDb.get(santasConfigKey))) {
    const santaConfigPath = path.join(__dirname, 'santas-default.json');
    const santaConf = JSON.parse(fs.readFileSync(santaConfigPath));
    if (!santaConf.channelId) {
      santaConf.channelId = config.channels.SECRET_SANTA;
    }
    await santasDb.set(santasConfigKey, santaConf);
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

module.exports = {
  isRegistered,
  addSanta,
  removeSanta,
  size,
  setReceiver,
  getReceiver,
  getSanta,
  started,
  getChannelId,
  start,
  reset,
  getAll,
  getBlacklists,
  toString,
  initSantas,
};