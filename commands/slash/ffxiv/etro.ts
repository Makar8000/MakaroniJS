import { MessageFlags, SlashCommandBuilder } from "discord.js";
import etro from "../../../utils/ffxiv/etro.ts";
import type { SlashCommand } from "../../../utils/types.ts";

export default {
  data: new SlashCommandBuilder()
    .setName("etro")
    .setDescription("Parse currency required to obtain an etro set.")
    .addStringOption((option) =>
      option.setName("etro-link").setDescription("The link to the etro set.").setRequired(true),
    ),
  async execute(interaction) {
    await interaction.deferReply();
    const etroUrl = interaction.options.getString("etro-link");
    const etroSet = await etro.getFromUrl(etroUrl);

    if (etroSet) {
      await interaction.followUp({
        embeds: [etro.getAsEmbed(etroSet)],
      });
    } else {
      await interaction.followUp({
        content: "Network error or invalid etro url provided.",
        flags: MessageFlags.Ephemeral,
      });
    }
  },
} satisfies SlashCommand;
