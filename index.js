const fs = require('fs');
const path = require('path');
const { Client, Collection, GatewayIntentBits, Partials, ActivityType } = require('discord.js');
const logger = require(path.join(__dirname, 'utils/logger.js'));
const config = require(path.join(__dirname, 'config.js'));
const parseCommands = require(path.join(__dirname, 'utils/parse-commands.js'));

const client = new Client({
  intents: Object.values(GatewayIntentBits).filter(v => v !== GatewayIntentBits.GuildBans),
  partials: Object.values(Partials),
  presence: {
    status: 'online',
    activities: [{
      name: `The Sage of ${process.env.DISCORD_APP_ID === config.bots.MEDLIONI ? 'Earth' : 'Wind'}`,
      type: ActivityType.Custom,
    }],
  },
});

logger.debug('Creating map of commands');
client.commands = {
  slash: new Collection(),
  message: new Collection(),
};
parseCommands(path.join(__dirname, 'commands/slash'), client.commands.slash);

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
