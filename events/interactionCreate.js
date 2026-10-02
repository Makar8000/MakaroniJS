import { Events } from 'discord.js';
import logger from '../utils/logger.js';

export default {
  name: Events.InteractionCreate,
  async execute(interaction) {
    if (interaction.isChatInputCommand()) {
      const command = interaction.client.commands.slash.get(interaction.commandName);
      if (!command) {
        logger.error(`No command matching ${interaction.commandName} was found.`);
        return;
      }

      try {
        await command.execute(interaction);
      } catch (error) {
        if (typeof command.error === 'function') {
          await command.error(interaction, error);
        } else {
          logger.error(error);
        }
      }
      return;
    }

    const isComponentOrModal = interaction.isButton() || interaction.isModalSubmit()
      || interaction.isStringSelectMenu() || interaction.isUserSelectMenu();
    if (isComponentOrModal) {
      // Component/Modal customIds are namespaced as `<commandName>:<...>` so they can be
      // routed back to the command that created them.
      const [commandName] = interaction.customId.split(':');
      const command = interaction.client.commands.slash.get(commandName);
      if (!command) {
        logger.error(`No command matching customId prefix "${commandName}" was found.`);
        return;
      }

      let handlerName;
      if (interaction.isButton()) {
        handlerName = 'button';
      } else if (interaction.isModalSubmit()) {
        handlerName = 'modalSubmit';
      } else {
        handlerName = 'selectMenu';
      }

      const handler = command[handlerName];
      if (typeof handler !== 'function') {
        logger.error(`Command "${commandName}" does not support ${handlerName} interactions.`);
        return;
      }

      try {
        await handler(interaction);
      } catch (error) {
        if (typeof command.error === 'function') {
          await command.error(interaction, error);
        } else {
          logger.error(error);
        }
      }
    }
  },
};
