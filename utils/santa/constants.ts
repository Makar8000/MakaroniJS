/** Embed colors used by the Secret Santa feature. */
export const SANTA_COLORS = Object.freeze({
  /** Messages from any Santa. */
  SANTA: 0xE74C3C,
  /** Messages from your receiver. */
  RECEIVER: 0x2ECCC7,
  /** Messages from a user you messaged via `/ss msg` -> User. */
  USER: 0xB377FF,
  /** The embed announcing who was selected as your receiver. */
  RECEIVER_ASSIGNED: 0x22E669,
});

/** Message-routing directions, named `<SENDER>_TO_<RECIPIENT>`. */
export const DIRECTIONS = Object.freeze({
  RECEIVER_TO_SANTA: "RECEIVER_TO_SANTA",
  SANTA_TO_RECEIVER: "SANTA_TO_RECEIVER",
  SANTA_TO_PUBLIC: "SANTA_TO_PUBLIC",
  SANTA_TO_USER: "SANTA_TO_USER",
  USER_TO_SANTA: "USER_TO_SANTA",
});

/** User-facing choices in the `/ss msg` target menu and the `/ss history` menu. */
export const TARGETS = Object.freeze({
  SANTA: "SANTA",
  RECEIVER: "RECEIVER",
  CHANNEL: "CHANNEL",
  USER: "USER",
});

/**
 * Prefix of `/ss history` option values for an anonymous "<user>'s Santa" conversation, followed by the
 * Discord ID of that Santa's receiver.
 */
export const ANONYMOUS_SANTA_PREFIX = "SANTAOF_";

/** Roleplay styles a Santa message can be transformed with. */
export const RP_MODES = Object.freeze({
  URIANGER: "URIANGER",
  SIMPLE: "SIMPLE",
  DISABLED: "DISABLED",
});

/** Limits imposed by Discord. */
export const DISCORD_LIMITS = Object.freeze({
  /** Max characters in a message (and in our message inputs). */
  MESSAGE_LENGTH: 2000,
  /** Max options in a string select menu. */
  SELECT_OPTIONS: 25,
});

/** Limits specific to Secret Santa. */
export const SANTA_LIMITS = Object.freeze({
  /** Max characters of embed description per history page, leaving headroom under Discord's limit. */
  HISTORY_PAGE_CHARS: 3800,
  /** Max characters of a single message shown in the history viewer. */
  HISTORY_ENTRY_CHARS: 1500,
  /** Max characters of the "Original" text shown under a transformed message in the history viewer. */
  HISTORY_ORIGINAL_CHARS: 500,
  /** Santa and Receiver always take an option in the history select menu. */
  HISTORY_RESERVED_OPTIONS: 2,
  /** Max number of recent messages passed to the LLM as conversation context. */
  LLM_HISTORY_MESSAGES: 30,
  /** Max characters of the name in a registration. */
  NAME_LENGTH: 100,
  /** Max characters of the address in a registration. */
  ADDRESS_LENGTH: 300,
  /** Max characters of the notes in a registration. */
  NOTES_LENGTH: 500,
});

export default {
  SANTA_COLORS,
  DIRECTIONS,
  TARGETS,
  RP_MODES,
  DISCORD_LIMITS,
  SANTA_LIMITS,
};
