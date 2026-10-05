import { Octokit } from "@octokit/rest";
import { throttling } from "@octokit/plugin-throttling";
import { retry } from "@octokit/plugin-retry";
import { repoConfig } from "./config.ts";
import logger from "../logger.ts";

const MyOctokit = Octokit.plugin(throttling, retry);
const octokit = new MyOctokit({
  auth: Deno.env.get("GITHUB_TOKEN"),
  throttle: {
    onRateLimit: (retryAfter, options, _octokit, retryCount) => {
      logger.warn(
        `GitHub RateLimit detected for request: ${options.method} ${options.url}\nWill retry after approx. ${Math.round(retryAfter / 60)} minutes.`,
      );
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
export async function getLatestCommitHash(): Promise<string> {
  const res = await octokit.rest.repos.getCommit({
    headers: {
      accept: "application/vnd.github.sha",
    },
    owner: repoConfig.OWNER,
    repo: repoConfig.REPO,
    ref: repoConfig.BRANCH,
  });
  // The sha media type returns the hash as a plain string rather than the typed commit object.
  return res.data as unknown as string;
}

/**
 * Grabs information about the latest commit.
 * @returns
 *  Information about the latest commit.
 */
export async function getLatestCommit() {
  const res = await octokit.rest.repos.getCommit({
    owner: repoConfig.OWNER,
    repo: repoConfig.REPO,
    ref: repoConfig.BRANCH,
  });
  return res.data;
}

/**
 * Grabs information about a commit.
 * @param {String} sha
 *  (optional) The ref of the commit to get information of.
 * @returns
 *  Information about the commit.
 */
export async function getCommit(sha: string) {
  const res = await octokit.rest.repos.getCommit({
    owner: repoConfig.OWNER,
    repo: repoConfig.REPO,
    ref: sha,
  });
  return res.data;
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
// deno-lint-ignore no-explicit-any
export async function downloadJsonFile(file: string, sha?: string): Promise<any> {
  const res = await octokit.rest.repos.getContent({
    headers: {
      accept: "application/vnd.github.raw",
    },
    owner: repoConfig.OWNER,
    repo: repoConfig.REPO,
    path: file,
    ref: sha,
  });
  // The raw media type returns the file body as a string.
  return JSON.parse(res.data as unknown as string);
}

export default {
  getLatestCommitHash,
  getLatestCommit,
  getCommit,
  downloadJsonFile,
};
