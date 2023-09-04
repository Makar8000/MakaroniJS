const path = require('path');
const { Octokit } = require('@octokit/rest');
const { throttling } = require('@octokit/plugin-throttling');
const { retry } = require('@octokit/plugin-retry');
const { repoConfig } = require(path.join(__dirname, 'config.js'));
const logger = require(path.join(__dirname, '../logger.js'));

const MyOctokit = Octokit.plugin(throttling, retry);
const octokit = new MyOctokit({
  auth: process.env.GITHUB_TOKEN,
  throttle: {
    onRateLimit: (retryAfter, options, _octokit, retryCount) => {
      logger.warn(`GitHub RateLimit detected for request: ${options.method} ${options.url}\nWill retry after approx. ${Math.round(retryAfter / 60)} minutes.`);
      return retryCount < 1;
    },
    onSecondaryRateLimit: (_retryAfter, options) => {
      logger.warn(`GitHub SecondaryRateLimit detected for request ${options.method} ${options.url}`);
    },
  },
});

/**
 * Grabs the SHA hash of the latest commit.
 * @returns
 *  The SHA hash of the latest commit.
 */
function getLatestCommitHash() {
  return new Promise((resolve, reject) => {
    octokit.rest.repos.getCommit({
      headers: {
        accept: 'application/vnd.github.sha',
      },
      owner: repoConfig.OWNER,
      repo: repoConfig.REPO,
      ref: repoConfig.BRANCH,
    }).then(res => {
      resolve(res.data);
    }).catch(err => {
      reject(err);
    });
  });
}

/**
 * Grabs information about the latest commit.
 * @returns
 *  Information about the latest commit.
 */
function getLatestCommit() {
  return new Promise((resolve, reject) => {
    octokit.rest.repos.getCommit({
      owner: repoConfig.OWNER,
      repo: repoConfig.REPO,
      ref: repoConfig.BRANCH,
    }).then(res => {
      resolve(res.data);
    }).catch(err => {
      reject(err);
    });
  });
}

/**
 * Grabs information about a commit.
 * @param {String} sha
 *  (optional) The ref of the commit to get information of.
 * @returns
 *  Information about the commit.
 */
function getCommit(sha) {
  return new Promise((resolve, reject) => {
    octokit.rest.repos.getCommit({
      owner: repoConfig.OWNER,
      repo: repoConfig.REPO,
      ref: sha,
    }).then(res => {
      resolve(res.data);
    }).catch(err => {
      reject(err);
    });
  });
}

/**
 * Downloads a json file from the repo.
 * @param {String} file
 *  The file to download from github.
 * @param {String} sha
 *  (optional) The ref to download from.
 * @returns
 *  An object representing the json data downloaded.
 */
function downloadJsonFile(file, sha) {
  return new Promise((resolve, reject) => {
    octokit.rest.repos.getContent({
      headers: {
        accept: 'application/vnd.github.raw',
      },
      owner: repoConfig.OWNER,
      repo: repoConfig.REPO,
      path: file,
      ref: sha,
    }).then(res => {
      resolve(JSON.parse(res.data));
    }).catch(err => {
      reject(err);
    });
  });
}

module.exports = {
  getLatestCommitHash,
  getLatestCommit,
  getCommit,
  downloadJsonFile,
};