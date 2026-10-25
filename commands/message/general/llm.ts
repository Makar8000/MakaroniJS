import type { Collection, Message } from "discord.js";
import { chunkText } from "../../../utils/common.ts";
import { DISCORD_LIMITS } from "../../../utils/constants.ts";
import LLMManager from "../../../utils/llm/llm-manager.ts";
import logger from "../../../utils/logger.ts";
import type { MessageCommand, ResolvedMessageParam } from "../../../utils/types.ts";

const Regexes = {
  msg: /^<@[0-9]+>\s(?<msg>.+)$/s,
};

export default {
  data: {
    name: `<@${Bun.env.DISCORD_USER_ID}>`,
    description: "Use an LLM",
    ignorePrefix: true,
    params: [
      {
        name: "msg",
        description: "The message to feed into the LLM",
        isValid: (message: Message) => message.content.trim().split(/\s+/).length >= 2,
        getValue: (message: Message) => message.content.trim().match(Regexes.msg)?.groups?.msg,
      },
    ],
  },
  async execute(message: Message, params: Collection<string, ResolvedMessageParam>) {
    const channel = message.channel;
    if (!channel.isSendable()) {
      return;
    }

    const msg = params.get("msg")?.value;
    if (!msg) {
      await channel.send("Sorry, but I was unable to parse your query.");
      return;
    }

    const respHistory = await LLMManager.sendPrompt(message, msg);
    const content = respHistory?.[respHistory.length - 1]?.content;
    // Assistant content may also be an array of content items; only plain text can be sent to Discord.
    if (respHistory && typeof content === "string" && content) {
      logger.info(`${msg}:\n${content}`);
      const [first, ...rest] = chunkText(content, DISCORD_LIMITS.MESSAGE_LENGTH);
      let followUp = await channel.send(first);
      for (const chunk of rest) {
        followUp = await channel.send(chunk);
      }
      await LLMManager.addPromptContext(followUp.id, respHistory);
    } else {
      logger.error("Unable to get LLM response.");
    }
  },
  async error(message: Message, error: unknown) {
    logger.error(`Error executing ${message.content.split(" ", 1)[0]}`);
    logger.error(error);
  },
} satisfies MessageCommand;
