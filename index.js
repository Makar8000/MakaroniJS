require('json5/lib/register');
const fs = require('fs');
const path = require('path');
const { Client, Collection, GatewayIntentBits, Partials, ActivityType } = require('discord.js');
const dotenv = require('dotenv');
dotenv.config();
const logger = require(path.join(__dirname, 'utils/logger.js'));
const parseCommands = require(path.join(__dirname, 'utils/parse-commands.js'));

const client = new Client({
  intents: Object.values(GatewayIntentBits).filter(v => v !== GatewayIntentBits.GuildBans),
  partials: Object.values(Partials),
  presence: {
    status: 'online',
    activities: [{
      name: 'music',
      type: ActivityType.Listening,
    }],
  },
});

logger.debug('Creating map of commands');
client.commands = {
  slash: new Collection(),
  message: new Collection(),
};
parseCommands(path.join(__dirname, 'commands/slash'), client.commands.slash);
parseCommands(path.join(__dirname, 'commands/message'), client.commands.message);

logger.debug('Finished creating map of commands. Registering events...');
const eventsPath = path.join(__dirname, 'events');
const eventFiles = fs.readdirSync(eventsPath).filter(file => file.endsWith('.js'));
for (const file of eventFiles) {
  const filePath = path.join(eventsPath, file);
  const event = require(filePath);
  if (event.once) {
    client.once(event.name, (...args) => event.execute(...args));
  } else {
    client.on(event.name, (...args) => event.execute(...args));
  }
}

logger.debug('Finished registering events. Logging in...');
client.login(process.env.DISCORD_TOKEN);
