import { Collection, REST, Routes } from "discord.js";
import { join } from "@std/path";
import { parseArgs } from "@std/cli/parse-args";
import config from "../config.ts";
import logger from "./logger.ts";
import parseCommands from "./parse-commands.ts";
import { requireEnv } from "./common.ts";
import type { SlashCommand } from "./types.ts";
const args = parseArgs(Deno.args, { boolean: ["remove", "local"] });

const collection = new Collection<string, SlashCommand>();
if (!args.remove) {
  await parseCommands(join(import.meta.dirname!, "../commands/slash"), collection);
}

const rest = new REST().setToken(requireEnv("DISCORD_TOKEN"));
const appId = requireEnv("DISCORD_APP_ID");
const deploy = async (deployAll: boolean) => {
  const commands = Array.from(collection.values()).map((c) => c.data.toJSON());
  const action = args.remove ? "delet" : "deploy";
  const cmdLen = args.remove ? "all" : commands.length;
  if (deployAll) {
    logger.info(`Started ${action}ing ${cmdLen} application (/) command(s) globally.`);
    await rest.put(
      Routes.applicationCommands(appId),
      { body: commands },
    );
    logger.info(`Successfully ${action}ed ${cmdLen} application (/) command(s) globally.`);
  } else {
    for (const [guildName, guildId] of Object.entries(config.guilds)) {
      logger.info(`Started ${action}ing ${cmdLen} application (/) command(s) for ${guildName}.`);
      await rest.put(
        Routes.applicationGuildCommands(appId, guildId),
        { body: commands },
      );
      logger.info(`Successfully ${action}ed ${cmdLen} application (/) command(s) for ${guildName}.`);
    }
  }
};

await deploy(!args.local);
