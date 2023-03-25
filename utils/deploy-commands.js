const { REST, Routes } = require('discord.js');
const fs = require('fs');
const path = require('path');
const config = require(path.join(__dirname, '../config.json'));
const logger = require(path.join(__dirname, 'logger.js'));
const args = require('minimist')(process.argv.slice(2), { boolean: true });

const commands = [];
const commandsPath = path.join(__dirname, '../commands');
const commandFiles = fs.readdirSync(commandsPath).filter(file => file.endsWith('.js'));

for (const file of commandFiles) {
	const command = require(path.join(commandsPath, file));
	commands.push(command.data.toJSON());
}

// const rest = new REST({ version: '10' }).setToken(process.env.DISCORD_TOKEN);
(async () => {
	try {
		if (!args.local) {
			logger.info(`Started refreshing ${commands.length} application (/) commands globally.`);

			/*
      const data = await rest.put(
        Routes.applicationCommands(process.env.DISCORD_APP_ID),
        { body: commands },
      );
      */

			logger.info(`Successfully reloaded ${commands.length} application (/) commands globally.`);
		}
		else {
			for (const [guildName, guildId] of Object.entries(config.guilds)) {
				logger.info(`Started refreshing ${commands.length} application (/) commands into ${guildName}.`);

				/*
        const data = await rest.put(
          Routes.applicationGuildCommands(process.env.DISCORD_APP_ID, guildId),
          { body: commands },
        );
        */

				logger.info(`Successfully reloaded ${commands.length} application (/) commands into ${guildName}.`);
			}
		}

	}
	catch (error) {
		logger.error(error);
	}
})();