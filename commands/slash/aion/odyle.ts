import { MessageFlags, SlashCommandBuilder } from "discord.js";
import config from "../../../config.ts";
import {
  addCharacter,
  addReminder,
  BONUS_CAP,
  capOf,
  currentEnergy,
  getAllCharacters,
  getUserCharacters,
  LARGE_REFILL_AMOUNT,
  nowSec,
  removeCharacter,
  removeReminders,
  SMALL_REFILL_AMOUNT,
  setSeasonEnd,
  updateCharacter,
} from "../../../utils/aion/odyle-manager.ts";
import {
  amountOption,
  details,
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
import { DISCORD_LIMITS } from "../../../utils/constants.ts";
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
        amountOption(
          sub.setName("set").setDescription("Set your current Odyle Energy, bonus gauge and refills."),
          "Current Odyle Energy",
        ),
      )
        .addIntegerOption((o) =>
          o.setName("bonus").setDescription("Bonus Odyle Energy gauge").setMinValue(0).setMaxValue(BONUS_CAP),
        )
        .addIntegerOption((o) =>
          o
            .setName("large-refills")
            .setDescription(`Large Odyle Energy refills (+${LARGE_REFILL_AMOUNT}) in your inventory`)
            .setMinValue(0),
        )
        .addIntegerOption((o) =>
          o
            .setName("small-refills")
            .setDescription(`Small Odyle Energy refills (+${SMALL_REFILL_AMOUNT}) in your inventory`)
            .setMinValue(0),
        ),
    )
    .addSubcommand((sub) =>
      nameOption(amountOption(sub.setName("use").setDescription("Spend Odyle Energy."), "Amount spent")),
    )
    .addSubcommand((sub) =>
      nameOption(
        sub.setName("cap").setDescription("See a character's energy, when it overcaps, bonus gauge and refills."),
        "Character name (any user's)",
      ),
    )
    .addSubcommand((sub) =>
      sub
        .setName("get-characters")
        .setDescription("List registered characters, their energy and overcap times.")
        .addBooleanOption((o) => o.setName("all").setDescription("Show every user's characters (default: true)")),
    )
    .addSubcommand((sub) =>
      nameOption(
        sub
          .setName("remind-enable")
          .setDescription("DM me when a character is about to overcap.")
          .addIntegerOption((o) =>
            o
              .setName("when")
              .setDescription("How long before overcapping to remind you")
              .addChoices(
                { name: "At overcap", value: 0 },
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
    )
    .addSubcommand((sub) =>
      sub
        .setName("update-season")
        .setDescription("Set when the current season ends (admin only).")
        .addIntegerOption((o) =>
          o
            .setName("time")
            .setDescription("Season end as a Unix Timestamp (Seconds). https://hammertime.cyou/")
            .setRequired(true),
        ),
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
        updateCharacter(c, currentEnergy(c), { member });
        await reply(`Membership ${member ? "enabled" : "disabled"}.\n${summary(fresh(c.name))}`);
      } else if (sub === "set") {
        const c = resolveCharacter(interaction);
        const amount = interaction.options.getInteger("amount", true);
        if (amount > capOf(c.member)) {
          throw new UserError(`${c.name}'s cap is ${capOf(c.member)}.`);
        }
        updateCharacter(c, amount, {
          bonus: interaction.options.getInteger("bonus") ?? c.bonus,
          large_refills: interaction.options.getInteger("large-refills") ?? c.large_refills,
          small_refills: interaction.options.getInteger("small-refills") ?? c.small_refills,
        });
        await reply(details(fresh(c.name)));
      } else if (sub === "use") {
        const c = resolveCharacter(interaction);
        const amount = interaction.options.getInteger("amount", true);
        const energy = currentEnergy(c);
        if (amount > energy + c.bonus) {
          throw new UserError(`${c.name} only has ${energy} Odyle Energy and ${c.bonus} bonus.`);
        }
        const regular = Math.min(amount, energy); // regular energy is always spent before bonus
        updateCharacter(c, energy - regular, { bonus: c.bonus - (amount - regular) });
        await reply(details(fresh(c.name)));
      } else if (sub === "cap") {
        await reply(details(resolveCharacter(interaction, true)));
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
        const [first, ...rest] = chunkText(text, DISCORD_LIMITS.MESSAGE_LENGTH);
        await reply(first);
        for (const chunk of rest) {
          await interaction.followUp({ content: chunk, flags: MessageFlags.Ephemeral });
        }
      } else if (sub === "remind-enable") {
        const c = resolveCharacter(interaction);
        const hours = interaction.options.getInteger("when", true);
        if (!addReminder(c.name, hours)) {
          throw new UserError(`**${c.name}** already has a ${hours ? `${hours} hour` : "overcap"} reminder.`);
        }
        await reply(`You'll be DMed ${hours ? `${hours} hours before` : "when"} **${c.name}** overcaps.`);
      } else if (sub === "remind-disable") {
        const c = resolveCharacter(interaction);
        const removed = removeReminders(c.name);
        await reply(removed ? `Removed ${removed} reminder(s) for **${c.name}**.` : `**${c.name}** had no reminders.`);
      } else if (sub === "update-season") {
        if (!config.users.admins.includes(interaction.user.id)) {
          throw new UserError("You do not have permission to run this command.");
        }
        const time = interaction.options.getInteger("time", true);
        if (time <= nowSec() || `${time}`.length !== 10) {
          throw new UserError(`\`${time}\` is not a future Unix timestamp in seconds. Try <https://hammertime.cyou/>.`);
        }
        setSeasonEnd(time);
        await reply(`The season now ends <t:${time}:F> (<t:${time}:R>).`);
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
        .slice(0, DISCORD_LIMITS.AUTOCOMPLETE_CHOICES)
        .map((c) => ({ name: c.name, value: c.name })),
    );
  },
} satisfies SlashCommand;
