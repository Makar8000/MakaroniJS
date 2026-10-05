import { join } from "@std/path";
import { ActivityType, Client, Collection, GatewayIntentBits, Partials } from "discord.js";
import logger from "./utils/logger.ts";
import parseCommands, { loadModules } from "./utils/parse-commands.ts";
import { requireEnv } from "./utils/common.ts";
import type { BotEvent, MessageCommand, SlashCommand } from "./utils/types.ts";

const root = import.meta.dirname!;

const client = new Client({
  intents: Object.values(GatewayIntentBits).filter((v): v is GatewayIntentBits => typeof v === "number" && v !== GatewayIntentBits.GuildBans),
  partials: Object.values(Partials).filter((v): v is Partials => typeof v === "number"),
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
  slash: new Collection<string, SlashCommand>(),
  message: new Collection<string, MessageCommand>(),
};
await parseCommands(join(root, "commands/slash"), client.commands.slash);
await parseCommands(join(root, "commands/message"), client.commands.message);

logger.debug("Finished creating map of commands. Registering events...");
const isEvent = (m: unknown): m is BotEvent => typeof m === "object" && m !== null && "name" in m && "execute" in m;
for (const event of await loadModules(join(root, "events"), isEvent)) {
  if (event.once) {
    client.once(event.name, (...args) => event.execute(...args));
  } else {
    client.on(event.name, (...args) => event.execute(...args));
  }
}

logger.debug("Finished registering events. Logging in...");
await client.login(requireEnv("DISCORD_TOKEN"));
