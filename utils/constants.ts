/** Limits imposed by Discord. */
export const DISCORD_LIMITS = Object.freeze({
  /** Max characters in a message (and in our message inputs). */
  MESSAGE_LENGTH: 2000,
  /** Max options in a string select menu. */
  SELECT_OPTIONS: 25,
  /** Max choices returned to an autocomplete interaction. */
  AUTOCOMPLETE_CHOICES: 25,
});

export default {
  DISCORD_LIMITS,
};
