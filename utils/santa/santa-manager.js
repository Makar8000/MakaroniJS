const fs = require('fs');
const path = require('path');
const AsyncLock = require('async-lock');
const lock = new AsyncLock();
const config = require(path.join(__dirname, '../../config.js'));
const santaConfigPath = path.join(__dirname, 'santas.json');
let santasConfig = loadSantas();

/**
 * Checks if this user is registered with Secret Santa.
 * @param {String} user
 *  The Discord ID of the user to check.
 * @returns
 *  True if this user is registered.
 *  False otherwise.
 */
function isRegistered(user) {
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
function addSanta(santa) {
  const ret = santasConfig.santas[santa.discordId];
  santasConfig.santas[santa.discordId] = santa;
  saveSantas();
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
function removeSanta(santa) {
  const ret = santasConfig.santas[santa];
  delete santasConfig.santas[santa];
  saveSantas();
  return !!ret;
}

/**
 * Gets the number of registered santas.
 * @returns The number of registered santas.
 */
function size() {
  return Object.keys(santasConfig.santas).length;
}

/**
 * Sets the receiver for a santa.
 * @param {String} santa
 *  The Discord ID of the santa to set the receiver for.
 * @param {String} receiver
 *  The Discord ID of the receiver.
 */
function setReceiver(santa, receiver) {
  santasConfig.selectedPairs[santa] = receiver;
  saveSantas();
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
  if (!santasConfig.gameStarted) {
    return undefined;
  }

  return santasConfig.selectedPairs[santa];
}

/**
 * Gets the santa for a receiver.
 * @param {String} receiver
 *  The Discord ID of the receiver to find the santa for.
 * @returns
 *  The Discord ID of the santa for this receiver.
 */
function getSanta(receiver) {
  if (!santasConfig.gameStarted) {
    return undefined;
  }

  for (const [santa, rec] of Object.entries(santasConfig.selectedPairs)) {
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
function started() {
  return santasConfig.gameStarted;
}

/**
 * Gets the primary channel id being used for this Secret Santa session.
 * @returns
 *  The Discord ID of the channel used for this Secret Santa session.
 */
function getChannelId() {
  return santasConfig.channelId;
}

/**
 * Sets the state of the Secret Santa session as started.
 */
function start() {
  santasConfig.gameStarted = true;
  saveSantas();
}

/**
 * Fully resets the state of the Secret Santa session.
 */
function reset() {
  santasConfig.santas = {};
  santasConfig.selectedPairs = {};
  santasConfig.gameStarted = false;
  saveSantas();
}

/**
 *
 * @returns
 *  An array of santa objects currently registered.
 */
function getAll() {
  const ret = Object.values(santasConfig.santas);
  shuffle(ret);
  while (!checkExclusions(ret)) {
    shuffle(ret);
  }
  return ret;
}

/**
 * Gets a map of blacklisted pairs.
 * @returns
 *  A map of the blacklisted pairs.
 */
function getBlacklists() {
  return santasConfig.blacklistedPairs;
}

/**
 *
 * @returns
 *  A string representation of all the santas currently registered.
 */
function toString() {
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
function checkExclusions(santas) {
  if (santas.length < 2) {
    return true;
  }

  for (let i = 0; i < santas.length; i++) {
    const j = i === santas.length - 1 ? 0 : i + 1;
    const santaId = santas[i].discordId;
    const receiverId = santas[j].discordId;

    const blkListedReceivers = santasConfig.blacklistedPairs.get(santaId);
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

/**
 * Loads the santa config object from disk.
 * @returns The santa config object.
 */
function loadSantas() {
  const santaConf = JSON.parse(fs.readFileSync(santaConfigPath));
  if (!santaConf.channelId) {
    santaConf.channelId = config.channels.SECRET_SANTA;
  }
  return santaConf;
}

/**
 * Saves the santa config object to disk.
 */
function saveSantas() {
  lock.acquire('santaLock', () => {
    fs.writeFileSync(santaConfigPath, JSON.stringify(santasConfig, null, 2));
  });
}

/**
 * Reloads the santa config object from disk.
 */
function reloadSantas() {
  lock.acquire('santaLock', () => {
    santasConfig = loadSantas();
  });
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
  reloadSantas,
};