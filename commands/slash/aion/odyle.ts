import type { ChatInputCommandInteraction } from "discord.js";
import { MessageFlags, SlashCommandBuilder } from "discord.js";
import {
  addCharacter,
  addReminder,
  capOf,
  currentEnergy,
  getAllCharacters,
  getUserCharacters,
  removeCharacter,
  removeReminders,
  updateCharacter,
} from "../../../utils/aion/odyle-manager.ts";
import {
  amountOption,
  fresh,
  getMembership,
  MAX_CAP,
  membershipOption,
  NAME,
  nameOption,
  resolveCharacter,
  summary,
  UserError,
} from "../../../utils/aion/odyle-utils.ts";
import { chunkText } from "../../../utils/common.ts";
import logger from "../../../utils/logger.ts";
import type { SlashCommand } from "../../../utils/types.ts";

export default {
  data: new SlashCommandBuilder()
    .setName("odyle")
    .setDescription("Track Aion 2 Odyle Energy.")
    .addSubcommand((sub) =>
      membershipOption(
        sub
          .setName("register")
          .setDescription("Add a character to track.")
          .addStringOption((o) => o.setName(NAME).setDescription("Character name").setMaxLength(32).setRequired(true))
          .addIntegerOption((o) =>
            o
              .setName("amount")
              .setDescription("Current Odyle Energy")
              .setMinValue(0)
              .setMaxValue(MAX_CAP)
              .setRequired(true),
          ),
      ),
    )
    .addSubcommand((sub) =>
      sub
        .setName("unregister")
        .setDescription("Stop tracking a character.")
        .addStringOption((o) =>
          o.setName(NAME).setDescription("Character name").setMaxLength(32).setAutocomplete(true).setRequired(true),
        ),
    )
    .addSubcommand((sub) =>
      nameOption(membershipOption(sub.setName("membership").setDescription("Set whether a character has membership."))),
    )
    .addSubcommand((sub) =>
      nameOption(
        amountOption(sub.setName("set").setDescription("Set your current Odyle Energy."), "Current Odyle Energy"),
      ),
    )
    .addSubcommand((sub) =>
      nameOption(amountOption(sub.setName("use").setDescription("Spend Odyle Energy."), "Amount spent")),
    )
    .addSubcommand((sub) =>
      nameOption(
        sub.setName("cap").setDescription("See a character's energy and when it caps."),
        "Character name (any user's)",
      ),
    )
    .addSubcommand((sub) =>
      sub
        .setName("get-characters")
        .setDescription("List registered characters, their energy and cap times.")
        .addBooleanOption((o) => o.setName("all").setDescription("Show every user's characters (default: true)")),
    )
    .addSubcommand((sub) =>
      nameOption(
        sub
          .setName("remind-enable")
          .setDescription("DM me when a character is about to cap.")
          .addIntegerOption((o) =>
            o
              .setName("when")
              .setDescription("How long before capping to remind you")
              .addChoices(
                { name: "At cap", value: 0 },
                { name: "24 hours", value: 24 },
                { name: "12 hours", value: 12 },
                { name: "8 hours", value: 8 },
                { name: "4 hours", value: 4 },
              )
              .setRequired(true),
          ),
      ),
    )
    .addSubcommand((sub) =>
      nameOption(sub.setName("remind-disable").setDescription("Remove ALL reminders for a character.")),
    ),

  async execute(interaction) {
    await interaction.deferReply({ flags: MessageFlags.Ephemeral });
    const reply = (content: string) => interaction.editReply({ content });
    const sub = interaction.options.getSubcommand();

    try {
      if (sub === "register") {
        const name = interaction.options.getString(NAME, true);
        const amount = interaction.options.getInteger("amount", true);
        const member = getMembership(interaction);
        const cap = capOf(member);
        if (amount > cap) {
          throw new UserError(`Odyle Energy can't exceed your cap of ${cap}.`);
        }
        if (!addCharacter(name, interaction.user.id, amount, member)) {
          throw new UserError(`A character named \`${name}\` is already registered.`);
        }
        await reply(`Registered.\n${summary(fresh(name))}`);
      } else if (sub === "unregister") {
        const c = resolveCharacter(interaction);
        removeCharacter(c.name);
        await reply(`Unregistered **${c.name}**.`);
      } else if (sub === "membership") {
        const c = resolveCharacter(interaction);
        const member = getMembership(interaction);
        updateCharacter(c, currentEnergy(c), member);
        await reply(`Membership ${member ? "enabled" : "disabled"}.\n${summary(fresh(c.name))}`);
      } else if (sub === "set") {
        const c = resolveCharacter(interaction);
        const amount = interaction.options.getInteger("amount", true);
        if (amount > capOf(c.member)) {
          throw new UserError(`${c.name}'s cap is ${capOf(c.member)}.`);
        }
        updateCharacter(c, amount);
        await reply(summary(fresh(c.name)));
      } else if (sub === "use") {
        const c = resolveCharacter(interaction);
        const amount = interaction.options.getInteger("amount", true);
        const energy = currentEnergy(c);
        if (amount > energy) {
          throw new UserError(`${c.name} only has ${energy} Odyle Energy.`);
        }
        updateCharacter(c, energy - amount);
        await reply(summary(fresh(c.name)));
      } else if (sub === "cap") {
        await reply(summary(resolveCharacter(interaction, true)));
      } else if (sub === "get-characters") {
        const all = interaction.options.getBoolean("all") ?? true;
        const list = all ? getAllCharacters() : getUserCharacters(interaction.user.id);
        if (list.length === 0) {
          throw new UserError(
            all ? "No characters are registered." : "You have no registered characters. Use `/odyle register` first.",
          );
        }
        let text = list.map(summary).join("\n");
        if (all) {
          const byOwner = Map.groupBy(list, (c) => c.owner_id);
          text = [...byOwner].map(([owner, chars]) => `<@${owner}>\n${chars.map(summary).join("\n")}`).join("\n\n");
        }
        const [first, ...rest] = chunkText(text, 2000);
        await reply(first);
        for (const chunk of rest) {
          await interaction.followUp({ content: chunk, flags: MessageFlags.Ephemeral });
        }
      } else if (sub === "remind-enable") {
        const c = resolveCharacter(interaction);
        const hours = interaction.options.getInteger("when", true);
        if (!addReminder(c.name, hours)) {
          throw new UserError(`**${c.name}** already has a ${hours ? `${hours} hour` : "cap"} reminder.`);
        }
        await reply(`You'll be DMed ${hours ? `${hours} hours before` : "when"} **${c.name}** caps.`);
      } else if (sub === "remind-disable") {
        const c = resolveCharacter(interaction);
        const removed = removeReminders(c.name);
        await reply(removed ? `Removed ${removed} reminder(s) for **${c.name}**.` : `**${c.name}** had no reminders.`);
      }
    } catch (error) {
      if (error instanceof UserError) {
        await reply(error.message);
        return;
      }
      throw error;
    }
  },

  async autocomplete(interaction) {
    const typed = interaction.options.getFocused().toLowerCase();
    // `cap` works on anyone's character; everything else only on your own.
    const pool =
      interaction.options.getSubcommand() === "cap" ? getAllCharacters() : getUserCharacters(interaction.user.id);
    await interaction.respond(
      pool
        .filter((c) => c.name.toLowerCase().includes(typed))
        .slice(0, 25)
        .map((c) => ({ name: c.name, value: c.name })),
    );
  },

  async error(interaction: ChatInputCommandInteraction, error: unknown) {
    logger.error(`Error executing ${interaction.commandName}`);
    logger.error(error);
  },
} satisfies SlashCommand;
