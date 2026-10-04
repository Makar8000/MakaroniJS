import { Collection, REST, Routes } from "discord.js";
import { join } from "@std/path";
import { parseArgs } from "@std/cli/parse-args";
import config from "../config.js";
import logger from "./logger.js";
import parseCommands from "./parse-commands.js";
const args = parseArgs(Deno.args, { boolean: ["remove", "local"] });

const collection = new Collection();
if (!args.remove) {
  await parseCommands(join(import.meta.dirname, "../commands/slash"), collection);
}

const rest = new REST().setToken(Deno.env.get("DISCORD_TOKEN"));
const deploy = async (deployAll) => {
  const commands = Array.from(collection.values()).map((c) => c.data.toJSON());
  const action = args.remove ? "delet" : "deploy";
  const cmdLen = args.remove ? "all" : commands.length;
  if (deployAll) {
    logger.info(`Started ${action}ing ${cmdLen} application (/) command(s) globally.`);
    await rest.put(
      Routes.applicationCommands(Deno.env.get("DISCORD_APP_ID")),
      { body: commands },
    );
    logger.info(`Successfully ${action}ed ${cmdLen} application (/) command(s) globally.`);
  } else {
    for (const [guildName, guildId] of Object.entries(config.guilds)) {
      logger.info(`Started ${action}ing ${cmdLen} application (/) command(s) for ${guildName}.`);
      await rest.put(
        Routes.applicationGuildCommands(Deno.env.get("DISCORD_APP_ID"), guildId),
        { body: commands },
      );
      logger.info(`Successfully ${action}ed ${cmdLen} application (/) command(s) for ${guildName}.`);
    }
  }
};

await deploy(!args.local);
