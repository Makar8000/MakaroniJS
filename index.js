import { resolve, toFileUrl } from "@std/path";
import { ActivityType, Client, Collection, GatewayIntentBits, Partials } from "discord.js";
import logger from "./utils/logger.js";
import parseCommands from "./utils/parse-commands.js";

const client = new Client({
  intents: Object.values(GatewayIntentBits).filter((v) => v !== GatewayIntentBits.GuildBans),
  partials: Object.values(Partials),
  presence: {
    status: "online",
    activities: [{
      name: "🌱",
      type: ActivityType.Playing,
    }],
  },
});

logger.debug("Creating map of commands");
client.commands = {
  slash: new Collection(),
  message: new Collection(),
};
await parseCommands("./commands/slash", client.commands.slash);
await parseCommands("./commands/message", client.commands.message);

logger.debug("Finished creating map of commands. Registering events...");
for (const { name: file } of Deno.readDirSync("./events")) {
  if (!file.endsWith(".js")) continue;
  const eventModule = await import(toFileUrl(resolve("./events", file)).href);
  const event = eventModule.default || eventModule;
  if (event.once) {
    client.once(event.name, (...args) => event.execute(...args));
  } else {
    client.on(event.name, (...args) => event.execute(...args));
  }
}

logger.debug("Finished registering events. Logging in...");
client.login(Deno.env.get("DISCORD_TOKEN"));
