const { Events } = require('discord.js');
const path = require('path');
const logger = require(path.join(__dirname, '../utils/logger.js'));

module.exports = {
	name: Events.ClientReady,
	once: true,
	execute(client) {
		logger.info(`${client.user.username} is now online!`);
	},
};