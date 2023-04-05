const { Events, Collection } = require('discord.js');
const path = require('path');
const logger = require(path.join(__dirname, '../utils/logger.js'));

module.exports = {
  name: Events.MessageCreate,
  async execute(message) {
    if (message.author.id === message.client.user.id) {
      return;
    }

    const messageCmd = message.content.split(' ', 2).shift().toLowerCase();
    const command = message.client.commands.message.get(messageCmd);
    if (!command) {
      return;
    }

    if (typeof command.hasPermission === 'function' && !command.hasPermission(message)) {
      logger.error(`You do not have permission to use \`${process.env.MESSAGE_PREFIX}${messageCmd}\``);
      return;
    }

    try {
      const params = new Collection();
      for (const param of command.data.params) {
        if (!param.isValid(message)) {
          logger.error(`Invalid use of command \`${process.env.MESSAGE_PREFIX}${messageCmd}\``);
          return;
        }
        params.set(param.name, {
          ...param,
          value: param.getValue(message),
        });
      }

      await command.execute(message, params);
    } catch (error) {
      await command.error(message, error);
    }
  },
};