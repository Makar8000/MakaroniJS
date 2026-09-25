import LLMManager from '../../../utils/llm/llm-manager.js';
import logger from '../../../utils/logger.js';

const Regexes = {
  msg: /^<@[0-9]+>\s(?<msg>.+)$/,
};

export default {
  data: {
    name: `<@${process.env.DISCORD_USER_ID}>`,
    description: 'Use an LLM',
    ignorePrefix: true,
    params: [
      {
        name: 'msg',
        description: 'The message to feed into the LLM',
        isValid: message => message?.content?.trim()?.split(' ')?.length >= 2,
        getValue: message => message.content.trim().match(Regexes.msg)?.groups?.msg,
      },
    ],
  },
  async execute(message, params) {
    const msg = params.get('msg')?.value;
    if (!msg) {
      await message.channel.send('Sorry, but I was unable to parse your query.');
      return;
    }

    const respHistory = await LLMManager.sendPrompt(message, msg);
    const latest = respHistory[respHistory.length - 1];
    if (latest.content) {
      logger.info(`${msg}:\n${latest.content}`);
      const followUp = await message.channel.send(latest.content);
      await LLMManager.addPromptContext(followUp.id, respHistory);
    } else {
      logger.error('Unable to get LLM response.');
    }
  },
  async error(interaction, error) {
    logger.error(`Error executing ${interaction.commandName}`);
    logger.error(error);
  },
};