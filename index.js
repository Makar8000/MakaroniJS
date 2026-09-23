import 'json5/lib/register.js';
import fs from 'fs';
import path from 'path';
import { pathToFileURL } from 'url';
import { Client, Collection, GatewayIntentBits, Partials, ActivityType } from 'discord.js';
import dotenv from 'dotenv';
import logger from './utils/logger.js';
import parseCommands from './utils/parse-commands.js';
dotenv.config();

const client = new Client({
  intents: Object.values(GatewayIntentBits).filter(v => v !== GatewayIntentBits.GuildBans),
  partials: Object.values(Partials),
  presence: {
    status: 'online',
    activities: [{
      name: '🌱',
      type: ActivityType.Playing,
    }],
  },
});

logger.debug('Creating map of commands');
client.commands = {
  slash: new Collection(),
  message: new Collection(),
};
await parseCommands('./commands/slash', client.commands.slash);
await parseCommands('./commands/message', client.commands.message);

logger.debug('Finished creating map of commands. Registering events...');
const eventFiles = fs.readdirSync('./events').filter(file => file.endsWith('.js'));
for (const file of eventFiles) {
  const absoluteFilePath = path.resolve(path.join('./events', file));
  const fileUrl = pathToFileURL(absoluteFilePath).href;
  const eventModule = await import(fileUrl);
  const event = eventModule.default || eventModule;
  if (event.once) {
    client.once(event.name, (...args) => event.execute(...args));
  } else {
    client.on(event.name, (...args) => event.execute(...args));
  }
}

logger.debug('Finished registering events. Logging in...');
client.login(process.env.DISCORD_TOKEN);
