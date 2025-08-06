const fs = require('fs');
const path = require('path');
const scheduler = require('node-schedule');
const logger = require(path.join(__dirname, '../logger.js'));
const { repoConfig } = require(path.join(__dirname, 'config.js'));
const Keyv = require('keyv');
const { KeyvFile } = require('keyv-file');
const { Collection, AttachmentBuilder } = require('discord.js');
const { downloadJsonFile, getLatestCommitHash, getLatestCommit } = require(path.join(__dirname, 'github-utils.js'));
const incDataDefaultPath = path.join(__dirname, 'inclination-types.json');
const jobs = new Collection();

const hsr = new Keyv({
  namespace: 'hsr',
  store: new KeyvFile({
    filename: path.join(__dirname, '../../data/hsr.json'),
  }),
});
let curInclHash;
let curInclData;

/**
 * Grabs the inclination data from the repo.
 * @param {String} sha
 *  (optional) The ref of the commit to get information of.
 * @returns
 *  The inclination data.
 */
async function loadIncData(sha) {
  const incData = JSON.parse(fs.readFileSync(incDataDefaultPath));
  const incText = await downloadJsonFile(repoConfig.FILES.InclinationText, sha);
  const talkSentence = await downloadJsonFile(repoConfig.FILES.TalkSentenceConfig, sha);
  const textMap = await downloadJsonFile(repoConfig.FILES.TextMapEN, sha);

  Object.keys(incText).map(key => {
    incText[key].InclinationTypeList.forEach(type => {
      if (incData[`${type}`]) {
        const id = incText[key].TalkSentenceID;
        const textId = talkSentence[`${id}`].TalkSentenceText.Hash;
        incData[`${type}`].textMapList.push({ id: id, text: textMap[`${textId}`] });
      }
    });
  });

  return incData;
}

/**
 * Checks for updated inclination types
 * @param {Client} client
 *  The discord.js client.
 */
async function checkForInclinationTypes(client) {
  if (jobs.get(repoConfig.KEYS.INCLINATION.jobName).running) {
    return;
  }

  const newHash = await getLatestCommitHash();
  if (newHash !== curInclHash) {
    const patch = (await getLatestCommit()).commit.message;
    const newData = await loadIncData();
    const outputList = [];
    let atLeastOne = false;
    Object.keys(newData).map(type => {
      newData[type].textMapList.map(newD => {
        if (!curInclData[type].textMapList.find(oldD => oldD.id === newD.id)) {
          newData[type].newTextMapList.push(newD);
        }
      });

      if (newData[type].newTextMapList.length) {
        outputList.push(`### ${newData[type].name}${newData[type].newTextMapList.map(({ text }) => `\n- ${text}`).join('')}`);
        atLeastOne = true;
      } else {
        outputList.push(`### ${newData[type].name}\n_no new dialogue options_`);
      }
    });

    if (atLeastOne) {
      const output = `## ${patch}\nSee below for a list of new dialogue options available for each achievement.\n${outputList.join('\n')}`;
      sendMessageToUsers(client, output);
    } else {
      const output = `## ${patch}\n_no new dialogue options this patch_`;
      sendMessageToUsers(client, output);
    }

    curInclHash = newHash;
    curInclData = newData;
    curInclData.newTextMapList = [];
  }
}

async function sendMessageToUsers(client, output) {
  const users = await hsr.get(repoConfig.KEYS.INCLINATION.userList);
  for (const [userId, enabled] of Object.entries(users)) {
    if (enabled) {
      if (output.length > repoConfig.CHARACTER_LIMIT) {
        await client.users.send(userId, {
          files: [new AttachmentBuilder(Buffer.from(output), { name: 'content.txt' })],
        });
      } else {
        await client.users.send(userId, `\`\`\`${output}\`\`\``);
      }
    }
  }
}

/**
 * Schedules a periodic check for new inclination data.
 * @param {Client} client
 *  The discord.js client.
 * @param {String} userId
 *  The userId to send the data to.
 * @param {Boolean} isInitial
 *  A boolean value representing whether or not this is an initial schedule.
 * @returns
 *  A reference to the scheduled job.
 */
async function scheduleInclinationCheck(client, userId, isInitial) {
  if (!client) {
    return null;
  }

  // Check if this user is already subscribed
  if (!isInitial) {
    const users = await hsr.get(repoConfig.KEYS.INCLINATION.userList);
    if (users[userId]) {
      return null;
    } else {
      users[userId] = true;
      await hsr.set(repoConfig.KEYS.INCLINATION.userList, users);
    }
  }

  // Load current data
  if (!curInclHash || !curInclData) {
    curInclHash = await getLatestCommitHash();
    curInclData = await loadIncData();
    // Demo SHA for testing purposes.
    // curInclHash = 'aa811519a5de772bf4055e8ea8b9254f90b7746c';
    // curInclData = await loadIncData('aa811519a5de772bf4055e8ea8b9254f90b7746c');
  }

  // Don't run the job again if it's already running
  const job = jobs.get(repoConfig.KEYS.INCLINATION.jobName);
  if (job) {
    return job;
  }

  return startJob(repoConfig.KEYS.INCLINATION.jobName, repoConfig.SCHEDULE, checkForInclinationTypes.bind(null, client));
}

/**
 * Cancels the periodic check for new inclination data.
 * @param {String} userId
 *  The userId who is canceling.
 * @returns
 *  True if cancelation was successful. False otherwise.
 */
async function cancelInclinationCheck(userId) {
  if (jobs.has(repoConfig.KEYS.INCLINATION.jobName)) {
    // Remove user from subscriptions
    const users = await hsr.get(repoConfig.KEYS.INCLINATION.userList);
    if (users[userId]) {
      delete users[userId];
      await hsr.set(repoConfig.KEYS.INCLINATION.userList, users);
    } else {
      return false;
    }

    if (Object.values(users).filter(v => v).length === 0) {
      return cancelJob(repoConfig.KEYS.INCLINATION.jobName);
    }
    return true;
  }

  return false;
}

/**
 * Schedules a periodic check for b___ role updates.
 * @param {Client} client
 *  The discord.js client.
 * @param {String} userId
 *  The userId to send the data to.
 * @param {Boolean} isInitial
 *  A boolean value representing whether or not this is an initial schedule.
 * @returns
 *  A reference to the scheduled job.
 */
// eslint-disable-next-line no-unused-vars
async function scheduleRoleCheck(client, userId, isInitial) {
  // TODO: Implement
  return null;
}

/**
 * Cancels the periodic check for b___ role updates.
 * @param {String} userId
 *  The userId who is canceling.
 * @returns
 *  True if cancelation was successful. False otherwise.
 */
// eslint-disable-next-line no-unused-vars
async function cancelRoleCheck(userId) {
  // TODO: Implement
  return null;
}

/**
 * Schedule a job with a given jobName
 * @param {Object} jobName
 *  The job name.
 * @param {Object} sched
 *  The schedule at which the job will run.
 * @param {Function} fn
 *  The function to run on the specified schedule.
 * @returns
 *  A reference to the scheduled job.
 */
function startJob(jobName, sched, fn) {
  try {
    logger.info(`Scheduling job ${jobName}`);
    const job = scheduler.scheduleJob(sched, fn);
    if (job) {
      jobs.set(jobName, job);
    }
    return job;
  } catch (error) {
    logger.error(error);
    return null;
  }
}

/**
 * Cancels a scheduled job.
 * @param {String} jobName
 *  The name of the job to cancel.
 * @returns
 *  True if cancelation was successful. False otherwise.
 */
function cancelJob(jobName) {
  if (jobs.has(jobName)) {
    jobs.get(jobName).cancel();
    return true;
  }
  return false;
}

/**
 * Loads and schedules jobs for all reminders.
 * Ran at startup.
 * @param {Client} client
 *  The discord.js client.
 */
async function initJobs(client) {
  // Inclination check
  let inclinationCheckUsers = await hsr.get(repoConfig.KEYS.INCLINATION.userList);
  if (!inclinationCheckUsers) {
    await hsr.set(repoConfig.KEYS.INCLINATION.userList, {});
    inclinationCheckUsers = {};
  }
  for (const [userId, enabled] of Object.entries(inclinationCheckUsers)) {
    if (enabled) {
      const successful = !!(await scheduleInclinationCheck(client, userId, true));
      logger.info(`Scheduling HSR Inclination subscription for ${userId} was ${successful ? '' : 'un'}successful.`);
    }
  }
}

module.exports = {
  initJobs,
  scheduleInclinationCheck,
  cancelInclinationCheck,
};