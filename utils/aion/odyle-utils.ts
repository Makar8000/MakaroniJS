import type { ChatInputCommandInteraction, SlashCommandSubcommandBuilder } from "discord.js";
import { type Character, capOf, capTime, currentEnergy, getCharacter, getUserCharacters } from "./odyle-manager.ts";

/** Thrown for user-facing problems; the message is sent back as the reply. */
export class UserError extends Error {}

export const NAME = "character-name";
export const MAX_CAP = 840;

export const nameOption = (sub: SlashCommandSubcommandBuilder, description = "Character name") =>
  sub.addStringOption((o) => o.setName(NAME).setDescription(description).setMaxLength(32).setAutocomplete(true));

export const amountOption = (sub: SlashCommandSubcommandBuilder, description: string) =>
  sub.addIntegerOption((o) =>
    o.setName("amount").setDescription(description).setMinValue(0).setMaxValue(MAX_CAP).setRequired(true),
  );

/** "Do you have membership?" Yes/No, shared by `register` and `membership`. */
export const membershipOption = (sub: SlashCommandSubcommandBuilder) =>
  sub.addStringOption((o) =>
    o
      .setName("membership")
      .setDescription("Do you have membership?")
      .addChoices({ name: "Yes", value: "yes" }, { name: "No", value: "no" })
      .setRequired(true),
  );

/** Reads the `membershipOption` answer as the 1/0 stored in the database. */
export const getMembership = (interaction: ChatInputCommandInteraction) =>
  interaction.options.getString("membership", true) === "yes" ? 1 : 0;

/**
 * Finds the character a subcommand applies to. Defaults to the caller's only character.
 * Unless `anyOwner`, the character must belong to the caller.
 */
export function resolveCharacter(interaction: ChatInputCommandInteraction, anyOwner = false): Character {
  const name = interaction.options.getString(NAME);
  const mine = getUserCharacters(interaction.user.id);

  if (name) {
    const found = getCharacter(name);
    if (!found || (!anyOwner && found.owner_id !== interaction.user.id)) {
      throw new UserError(`Could not find ${anyOwner ? "a" : "one of your"} registered character named \`${name}\`.`);
    }
    return found;
  }
  if (mine.length === 0) {
    throw new UserError("You have no registered characters. Use `/odyle register` first.");
  }
  if (mine.length > 1) {
    throw new UserError(
      `You have multiple characters, so please specify a \`${NAME}\`: ${mine.map((c) => `\`${c.name}\``).join(", ")}`,
    );
  }
  return mine[0];
}

/** One-line summary: "**Name** - 120/840 - caps <t:..:F> (<t:..:R>)". */
export function summary(c: Character) {
  const cap = capTime(c);
  const when = cap === null ? "**capped**" : `caps <t:${cap}:F> (<t:${cap}:R>)`;
  return `**${c.name}** - ${currentEnergy(c)}/${capOf(c.member)} - ${when}`;
}

/** Re-reads a character that is known to exist (e.g. just written). */
export const fresh = (name: string) => getCharacter(name) as Character;
