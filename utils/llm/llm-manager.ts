import { OpenRouter } from "@openrouter/sdk";
import type { ChatMessages } from "@openrouter/sdk/models";
import { Collection, type Message } from "discord.js";
import config from "./config.ts";
import logger from "../logger.ts";
import { requireEnv } from "../common.ts";

const openRouter = new OpenRouter();
const prompts = new Collection<string, ChatMessages[]>();

/**
 * Gets the prompt context for a given message to provide context.
 * @param {Message} message
 *  The Discord Messsage object to use for finding context.
 * @returns
 *  An array of prompts used for the LLM.
 */
function getPromptContext(message: Message): ChatMessages[] {
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
function deletePromptContext(message: Message) {
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
function addPromptContext(messageId: string, context: ChatMessages[]) {
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
async function sendPrompt(message: Message, prompt: string): Promise<ChatMessages[] | null> {
  try {
    const messages: ChatMessages[] = [
      ...getPromptContext(message),
      { role: "user", content: prompt },
    ];

    const response = await openRouter.chat.send({
      chatRequest: {
        model: requireEnv("OPENROUTER_MODEL"),
        messages,
        stream: false,
      },
    });

    // `stream: false` makes the API return a ChatResult, but the SDK still types the response as `ChatResult | EventStream`, so narrow it.
    if ("choices" in response) {
      const responseMessage = response.choices.shift()?.message;
      if (responseMessage) {
        messages.push(responseMessage);
        deletePromptContext(message);
        return messages;
      }
    }
  } catch (error) {
    logger.error(`Invalid AI response. ${error instanceof Error ? error.message : error}`);
  }
  return null;
}

/**
 * Maps a Secret Santa RP mode to its corresponding LLM system message set.
 */
const rpModeSystemMessages: Record<string, "systemMessagesSantaUrianger" | "systemMessagesSantaSimple"> = {
  URIANGER: "systemMessagesSantaUrianger",
  SIMPLE: "systemMessagesSantaSimple",
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
async function sendSantaPrompt(prompt: string, historyContext: ChatMessages[], rpMode: string): Promise<string | null> {
  try {
    const systemMessagesKey = rpModeSystemMessages[rpMode];
    const messages: ChatMessages[] = [
      ...config[systemMessagesKey],
      ...historyContext,
      { role: "user", content: `<SANTA_MESSAGE>${prompt}</SANTA_MESSAGE>` },
    ];

    const response = await openRouter.chat.send({
      chatRequest: {
        model: requireEnv("OPENROUTER_MODEL"),
        messages,
        reasoning: { effort: "minimal" },
        stream: false,
      },
    });

    if ("choices" in response) {
      const content = response.choices[0]?.message.content;
      if (typeof content === "string" && content) {
        return content.trim();
      }
    }
  } catch (error) {
    logger.error(`Invalid Secret Santa AI response. ${error instanceof Error ? error.message : error}`);
  }
  return null;
}

export default {
  sendPrompt,
  sendSantaPrompt,
  addPromptContext,
};
