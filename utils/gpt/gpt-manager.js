const path = require('path');
const { Configuration, OpenAIApi } = require('openai');
const { Collection } = require('discord.js');
const logger = require(path.join(__dirname, '../logger.js'));

const openai = new OpenAIApi(new Configuration({
  apiKey: process.env.OPENAI_KEY,
}));

const prompts = new Collection();

/**
 * Gets the prompt context for a given message to provide context.
 * @param {Message} message
 *  The Discord Messsage object to use for finding context.
 * @returns
 *  An array of prompts used for GPT.
 */
function getPromptContext(message) {
  const messageId = message.reference?.messageId;
  if (messageId) {
    return prompts.get(messageId) ?? [];
  }
  return [];
}

/**
 * Deletes the prompt context for a given message.
 * Used for clearing context once the context has already been used.
 * @param {Message} message
 *  The Discord Messsage object to use for finding context.
 */
function deletePromptContext(message) {
  const messageId = message.reference?.messageId;
  if (messageId) {
    prompts.delete(messageId);
  }
}

/**
 * Adds prompt context to be used when the message is replied to.
 * @param {String} messageId
 *  The message ID that this context is associated with.
 * @param {Array} context
 *  The GTP context array.
 */
function addPromptContext(messageId, context) {
  prompts.set(messageId, context);
}

/**
 * Sends a prompt using the OpenAI API
 * @param {Message} message
 *  The Discord Message object used for building context
 * @param {String} prompt
 *  The prompt for the GPT model
 * @returns
 *  The response from OpenAI
 */
async function sendPrompt(message, prompt) {
  try {
    const newPrompt = { role: 'user', content: prompt };
    const prevMessages = getPromptContext(message);
    const messages = [
      ...prevMessages,
      newPrompt,
    ];
    const response = await openai.createChatCompletion({ model: 'gpt-3.5-turbo', messages });
    if (response.status === 200) {
      const responseMessage = response?.data?.choices?.shift()?.message;
      if (typeof responseMessage === 'object') {
        messages.push(responseMessage);
        deletePromptContext(message);
        return messages;
      }
    }
    logger.error(`Invalid GPT response. [${response.status}]`);
  } catch (error) {
    logger.error(error);
  }
  return null;
}

module.exports = {
  sendPrompt,
  addPromptContext,
};