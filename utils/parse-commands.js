const fs = require('fs');
const path = require('path');
const logger = require(path.join(__dirname, 'logger.js'));

const parseCommandFiles = (cmdPath, commands) => {
	const commandFiles = fs.readdirSync(cmdPath);
	const jsFiles = commandFiles.filter(file => file.endsWith('.js'));
	const folders = commandFiles.filter(file => !file.endsWith('.js'));

	for (const folder of folders) {
		parseCommandFiles(path.join(cmdPath, folder), commands);
	}

	for (const file of jsFiles) {
		const command = require(path.join(cmdPath, file));
		commands.set(command.data.name, command);
	}
};

module.exports = (cmdPath, commands) => {
	if (typeof commands === 'object' && typeof commands.set === 'function') {
		parseCommandFiles(cmdPath, commands);
	}
	else {
		logger.error('Invalid collection provided');
	}
};