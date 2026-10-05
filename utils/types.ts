import type { IAnimeInfo, ITitle } from "@consumet/extensions";
import type { Moment } from "moment";
import type {
  ButtonInteraction,
  ChatInputCommandInteraction,
  ClientEvents,
  Collection,
  Message,
  ModalSubmitInteraction,
  SlashCommandBuilder,
  SlashCommandOptionsOnlyBuilder,
  SlashCommandSubcommandsOnlyBuilder,
  StringSelectMenuInteraction,
  UserSelectMenuInteraction,
} from "discord.js";

type AnyInteraction =
  | ChatInputCommandInteraction
  | ButtonInteraction
  | ModalSubmitInteraction
  | StringSelectMenuInteraction
  | UserSelectMenuInteraction;

export interface SlashCommand {
  data: SlashCommandBuilder | SlashCommandOptionsOnlyBuilder | SlashCommandSubcommandsOnlyBuilder;
  execute(interaction: ChatInputCommandInteraction): Promise<void>;
  button?(interaction: ButtonInteraction): Promise<void>;
  modalSubmit?(interaction: ModalSubmitInteraction): Promise<void>;
  selectMenu?(interaction: StringSelectMenuInteraction | UserSelectMenuInteraction): Promise<void>;
  error?(interaction: AnyInteraction, error: unknown): Promise<void>;
}

export interface MessageParam {
  name: string;
  description: string;
  isValid(message: Message): boolean;
  getValue(message: Message): string | undefined;
}

export type ResolvedMessageParam = MessageParam & { value: string | undefined };

export interface MessageCommand {
  data: { name: string; description: string; ignorePrefix?: boolean; params: MessageParam[] };
  execute(message: Message, params: Collection<string, ResolvedMessageParam>): Promise<void>;
  hasPermission?(message: Message): boolean;
  error?(message: Message, error: unknown): Promise<void>;
}

export interface BotEvent<K extends keyof ClientEvents = keyof ClientEvents> {
  name: K;
  once?: boolean;
  execute(...args: ClientEvents[K]): void | Promise<void>;
}

export interface Reminder {
  id: string;
  unixTs: number;
  authorId: string;
  channelId?: string | null;
  mention?: string;
  message: string;
}

/** Consumet anime info, plus the fields this bot attaches while building a W2G room. */
export type AnimeInfo = IAnimeInfo & {
  title: ITitle;
  expires?: Moment;
  /** External ids (e.g. `mal`, `anilist`) supplied by the Anilist meta provider. */
  mappings?: Record<string, string | number>;
  videoUrl?: string;
  episodeId?: string;
  episodeNumber?: number;
  roomId?: string;
  roomUrl?: string;
};

declare module "discord.js" {
  interface Client {
    commands: {
      slash: Collection<string, SlashCommand>;
      message: Collection<string, MessageCommand>;
    };
  }
}
