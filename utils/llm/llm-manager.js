import { OpenRouter } from '@openrouter/sdk';
import { Collection } from 'discord.js';
import config from './config.js';
import logger from '../logger.js';

const openRouter = new OpenRouter();
const prompts = new Collection();

/**
 * Gets the prompt context for a given message to provide context.
 * @param {Message} message
 *  The Discord Messsage object to use for finding context.
 * @returns
 *  An array of prompts used for the LLM.
 */
function getPromptContext(message) {
  const messageId = message.reference?.messageId;
  if (messageId) {
    return prompts.get(messageId) ?? [...config.systemMessages];
  }
  return [...config.systemMessages];
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
 *  The LLM context array.
 */
function addPromptContext(messageId, context) {
  prompts.set(messageId, context);
}

/**
 * Sends a prompt using the OpenRouter API
 * @param {Message} message
 *  The Discord Message object used for building context
 * @param {String} prompt
 *  The prompt for the LLM model
 * @returns
 *  The response from OpenRouter
 */
async function sendPrompt(message, prompt) {
  try {
    const newPrompt = { role: 'user', content: prompt };
    const prevMessages = getPromptContext(message);
    const messages = [
      ...prevMessages,
      newPrompt,
    ];

    const response = await openRouter.chat.send({
      chatRequest: {
        model: process.env.OPENROUTER_MODEL,
        messages,
      },
    });

    const responseMessage = response?.choices?.shift()?.message;
    if (typeof responseMessage === 'object') {
      messages.push(responseMessage);
      deletePromptContext(message);
      return messages;
    }
  } catch (error) {
    logger.error(`Invalid AI response. ${error.message}`);
  }
  return null;
}

/**
 * Maps a Secret Santa RP mode to its corresponding LLM system message set.
 */
const rpModeSystemMessages = {
  URIANGER: 'systemMessagesSantaUrianger',
  SIMPLE: 'systemMessagesSantaSimple',
};

/**
 * Sends a secret santa prompt using the OpenRouter API
 * @param {String} prompt
 *  The new message being sent by the Santa.
 * @param {Array} historyContext
 *  The pre-formatted message history context array from the database.
 * @param {String} rpMode
 *  The RP mode to use for translation.
 * @returns
 *  The translated string from OpenRouter, or null if it fails.
 */
async function sendSantaPrompt(prompt, historyContext, rpMode) {
  try {
    const systemMessagesKey = rpModeSystemMessages[rpMode];
    const messages = [
      ...config[systemMessagesKey],
      ...historyContext,
      { role: 'user', content: `<SANTA_MESSAGE>${prompt}</SANTA_MESSAGE>` },
    ];

    const response = await openRouter.chat.send({
      chatRequest: {
        model: process.env.OPENROUTER_MODEL,
        messages,
      },
    });

    const responseMessage = response?.choices?.[0]?.message;
    if (responseMessage?.content) {
      return responseMessage.content.trim();
    }
  } catch (error) {
    logger.error(`Invalid Secret Santa AI response. ${error.message}`);
  }
  return null;
}

export default {
  sendPrompt,
  sendSantaPrompt,
  addPromptContext,
};