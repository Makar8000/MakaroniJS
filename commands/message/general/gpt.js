const path = require('path');
const GPTManager = require('../../../utils/gpt/gpt-manager');
const logger = require(path.join(__dirname, '../../../utils/logger.js'));

const Regexes = {
  msg: /^<@[0-9]+>\s(?<msg>.+)$/,
};

module.exports = {
  data: {
    name: `<@${process.env.DISCORD_USER_ID}>`,
    description: 'Use GPT-3.5 Turbo',
    ignorePrefix: true,
    params: [
      {
        name: 'msg',
        description: 'The message to feed into GPT 3.5 Turbo',
        isValid: message => message?.content?.trim()?.split(' ')?.length >= 2,
        getValue: message => message.content.trim().match(Regexes.msg)?.groups?.msg,
      },
    ],
  },
  async execute(message, params) {
    const msg = params.get('msg')?.value;
    if (!msg) {
      await message.channel.send(`Sorry, but I was unable to parse your query.`);
      return;
    }

    const respHistory = await GPTManager.sendPrompt(message, msg);
    const latest = respHistory[respHistory.length - 1];
    if (latest.content) {
      logger.info(`${msg}:\n${latest.content}`);
      const followUp = await message.channel.send(latest.content);
      await GPTManager.addPromptContext(followUp.id, respHistory);
    } else {
      logger.error('Unable to get GTP response.');
    }
  },
  async error(interaction, error) {
    logger.error(`Error executing ${interaction.commandName}`);
    logger.error(error);
  },
};