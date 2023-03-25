const { Events } = require('discord.js');
const path = require('path');
const logger = require(path.join(__dirname, '../utils/logger.js'));

module.exports = {
	name: Events.InteractionCreate,
	async execute(interaction) {
		if (!interaction.isChatInputCommand()) {
			return;
		}

		const command = interaction.client.commands.get(interaction.commandName);
		if (!command) {
			logger.error(`No command matching ${interaction.commandName} was found.`);
			return;
		}

		try {
			await command.execute(interaction);
		}
		catch (error) {
			await command.error(interaction, error);
		}
	},
};