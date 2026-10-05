import {
  ActionRowBuilder,
  ButtonBuilder,
  type ButtonInteraction,
  ButtonStyle,
  type Client,
  type InteractionReplyOptions,
  LabelBuilder,
  MessageFlags,
  ModalBuilder,
  type ModalSubmitInteraction,
  type RepliableInteraction,
  type SendableChannels,
  StringSelectMenuBuilder,
  type StringSelectMenuInteraction,
  TextInputStyle,
  type User,
} from "discord.js";
import SantaManager from "./santa-manager.ts";
import logger from "../logger.ts";

// Namespace prefix for customIds built/parsed by this module, matching the `/ss` command name.
const COMMAND_NAME = "ss";

// Maps the `target` choice on `/ss msg` to the message-routing direction enum.
const TARGET_TO_DIRECTION: Record<string, string> = {
  SANTA: "RECEIVER_TO_SANTA",
  RECEIVER: "SANTA_TO_RECEIVER",
  CHANNEL: "SANTA_TO_PUBLIC",
  USER: "SANTA_TO_USER",
};

// Maps a direction to the direction a reply to it should use.
const REPLY_DIRECTION: Record<string, string> = {
  RECEIVER_TO_SANTA: "SANTA_TO_RECEIVER",
  SANTA_TO_RECEIVER: "RECEIVER_TO_SANTA",
  SANTA_TO_USER: "USER_TO_SANTA",
  USER_TO_SANTA: "SANTA_TO_USER",
};

// Directions where the sender is roleplaying as Santa, so the rp-mode transform applies.
const { DIRECTIONS_WITH_RP_MODE } = SantaManager;

// Directions with no pairing to look up, so the target Discord ID must be carried in the customId instead.
const DIRECTIONS_WITH_EXPLICIT_TARGET = new Set(["SANTA_TO_USER", "USER_TO_SANTA"]);

// Friendly labels for the confirmation DM/error text sent back to the sender.
const DIRECTION_LABEL: Record<string, string> = {
  RECEIVER_TO_SANTA: "santa",
  SANTA_TO_RECEIVER: "receiver",
  SANTA_TO_PUBLIC: "channel",
  SANTA_TO_USER: "user",
  USER_TO_SANTA: "user",
};

const COMPOSE_MODAL_TITLE: Record<string, string> = {
  RECEIVER_TO_SANTA: "Message Your Santa",
  SANTA_TO_RECEIVER: "Message Your Receiver",
  SANTA_TO_PUBLIC: "Message the Secret Santa Channel",
  SANTA_TO_USER: "Message a User Anonymously",
};

const REPLY_MODAL_TITLE: Record<string, string> = {
  RECEIVER_TO_SANTA: "Reply to Your Santa",
  SANTA_TO_RECEIVER: "Reply to Your Receiver",
  SANTA_TO_USER: "Reply Anonymously",
  USER_TO_SANTA: "Reply to this Santa",
};

// Gift tracking milestone values -> friendly labels, used for the `/ss gift` choices and `/ss-admin giftlist`.
const GIFT_STATUS_LABEL: Record<string, string> = {
  NOT_SENT: "❌ Not Sent",
  SENT: "📦 Sent",
  DELIVERED: "🎁 Delivered",
};

const RP_MODE_CHOICES = [
  { name: "Default", value: "URIANGER" },
  { name: "Simple", value: "SIMPLE" },
  { name: "Disabled", value: "DISABLED" },
];

/**
 * Gets the Discord User or TextChannel a message for the given direction should be sent to.
 * @param {Client} client The Discord client.
 * @param {String} direction The message-routing direction enum value.
 * @param {String} senderId The Discord ID of the user sending the message.
 * @param {String} explicitTargetId The Discord ID of the target user (override)
 * @returns The resolved User or TextChannel to send the message to.
 */
async function resolveDestination(client: Client, direction: string, senderId: string, explicitTargetId?: string): Promise<User | SendableChannels> {
  let destination: User | SendableChannels | null | undefined;
  if (DIRECTIONS_WITH_EXPLICIT_TARGET.has(direction)) {
    destination = await client.users.fetch(explicitTargetId!);
  } else if (direction === "RECEIVER_TO_SANTA") {
    destination = await client.users.fetch(SantaManager.getSanta(senderId)!);
  } else if (direction === "SANTA_TO_RECEIVER") {
    destination = await client.users.fetch(SantaManager.getReceiver(senderId)!);
  } else if (direction === "SANTA_TO_PUBLIC") {
    const channel = await client.channels.fetch(SantaManager.getChannelId());
    destination = channel?.isSendable() ? channel : null;
  }
  if (!destination) {
    throw new Error(`Unable to resolve a destination for direction ${direction}.`);
  }
  return destination;
}

/**
 * Builds the "Reply" button row for a sent message, or null if there should be no reply
 * @param {String} direction The direction of the message that was just sent.
 * @param {String} senderId The Discord ID of the user who sent the message.
 * @returns {?ActionRowBuilder} The ActionRowBuilder containing the reply button, or null
 *  if not repliable.
 */
function buildReplyRow(direction: string, senderId: string) {
  const replyDirection = REPLY_DIRECTION[direction];
  if (!replyDirection) {
    return null;
  }
  const customId = `${COMMAND_NAME}:reply:${replyDirection}:${senderId}`;
  const button = new ButtonBuilder()
    .setCustomId(customId)
    .setLabel("Reply")
    .setEmoji("✉️")
    .setStyle(ButtonStyle.Primary);
  return new ActionRowBuilder<ButtonBuilder>().addComponents(button);
}

/**
 * Builds a Label component wrapping a single text input.
 * @param {String} label The label text shown above the input.
 * @param {String} customId The customId of the text input, read back via
 *  `interaction.fields.getTextInputValue(customId)` on submit.
 * @param {Object} [opts] Optional overrides.
 * @param {TextInputStyle} [opts.style] The input style, defaults to Short.
 * @param {Boolean} [opts.required] Whether the field is required, defaults to true.
 * @param {Number} [opts.maxLength] The max character length, if any.
 * @param {String} [opts.value] The prefilled value, if any.
 * @returns The built LabelBuilder.
 */
function buildTextLabel(
  label: string,
  customId: string,
  { style = TextInputStyle.Short, required = true, maxLength, value }: {
    style?: TextInputStyle;
    required?: boolean;
    maxLength?: number;
    value?: string | null;
  } = {},
) {
  return new LabelBuilder()
    .setLabel(label)
    .setTextInputComponent((input) => {
      input.setCustomId(customId).setStyle(style).setRequired(required);
      if (maxLength) {
        input.setMaxLength(maxLength);
      }
      if (value) {
        input.setValue(value);
      }
      return input;
    });
}

/**
 * Builds the Label component wrapping the message text input.
 * @returns The built LabelBuilder.
 */
function buildMessageLabel() {
  return buildTextLabel("Your message", "message", { style: TextInputStyle.Paragraph, maxLength: 2000 });
}

/**
 * Builds the "who do you want to message?" select menu shown after `/ss msg`.
 * @param {Client} client The Discord client.
 * @param {String} senderId The Discord ID of the user composing the message.
 * @returns {Promise<ActionRowBuilder>} The ActionRowBuilder containing the target select menu.
 */
async function buildTargetSelectRow(client: Client, senderId: string) {
  const receiver = await client.users.fetch(SantaManager.getReceiver(senderId)!);
  const select = new StringSelectMenuBuilder()
    .setCustomId(`${COMMAND_NAME}:msgtarget`)
    .setPlaceholder("Who do you want to message?")
    .addOptions(
      { label: "Santa", description: "Message your Secret Santa.", value: "SANTA", emoji: { name: "🎅" } },
      { label: "Receiver", description: "Message your receiver anonymously.", value: "RECEIVER", emoji: { name: "🎁" } },
      { label: "Channel", description: "Post to the Secret Santa channel anonymously.", value: "CHANNEL", emoji: { name: "📢" } },
      {
        label: "User",
        description: `Message any other Santa. You will appear as "${receiver.displayName}'s Santa"`,
        value: "USER",
        emoji: { name: "✉️" },
      },
    );
  return new ActionRowBuilder<StringSelectMenuBuilder>().addComponents(select);
}

/**
 * Builds the rp-mode select Label used by the Receiver/Channel/User compose modals.
 * @param {String} defaultRpMode The rp style to preselect in the dropdown.
 * @returns The built LabelBuilder.
 */
function buildRpModeLabel(defaultRpMode: string) {
  return new LabelBuilder()
    .setLabel("Roleplay style")
    .setStringSelectMenuComponent((select) =>
      select
        .setCustomId("rp-mode")
        .setRequired(false)
        .setMinValues(0)
        .addOptions(RP_MODE_CHOICES.map((choice) => ({
          label: choice.name,
          value: choice.value,
          default: choice.value === defaultRpMode,
        })))
    );
}

/**
 * Builds the Label used to pick a target user, listing only registered participants other than
 * the sender and the sender's receiver.
 * @param {Client} client The Discord client.
 * @param {String} senderId The Discord ID of the user composing the message, excluded from the list.
 * @returns {Promise<LabelBuilder>} The built LabelBuilder.
 */
async function buildUserLabel(client: Client, senderId: string) {
  const santas = SantaManager.getAll();
  // String Select supports a max of 25 options.
  const receiverId = SantaManager.getReceiver(senderId);
  const eligible = santas.filter((santa) => santa.discordId !== senderId && santa.discordId !== receiverId).slice(0, 25);
  if (!eligible.length) {
    return null;
  }

  const options = await Promise.all(eligible.map(async (santa) => {
    const user = await client.users.fetch(santa.discordId).catch(() => null);
    return { label: user?.displayName ?? "Unknown user", value: santa.discordId };
  }));

  return new LabelBuilder()
    .setLabel("Which user?")
    .setStringSelectMenuComponent((select) =>
      select
        .setCustomId("user")
        .setRequired(true)
        .addOptions(options)
    );
}

/**
 * Builds the compose Modal for the target chosen from `/ss msg`'s select menu.
 * @param {Client} client The Discord client.
 * @param {String} target The user-facing target choice ('SANTA', 'RECEIVER', 'CHANNEL', or 'USER').
 * @param {String} senderId The Discord ID of the user composing the message.
 * @returns {Promise<?ModalBuilder>} The built ModalBuilder, or null if target is 'USER' and there
 *  are no other registered participants to message.
 */
async function buildComposeModal(client: Client, target: string, senderId: string) {
  const direction = TARGET_TO_DIRECTION[target];
  const modal = new ModalBuilder()
    .setCustomId(`${COMMAND_NAME}:msgmodal:${direction}`)
    .setTitle(COMPOSE_MODAL_TITLE[direction]);

  if (target === "SANTA") {
    // Messaging your own Santa never applies an rp-mode.
    return modal.addLabelComponents(buildMessageLabel());
  }

  // Only show the rp-mode selector when the feature flag allows picking it; otherwise the
  // configured default rp-mode is applied silently (see parseModalSubmission).
  const rpModeLabel = SantaManager.isRpModeSelectionAllowed() ? buildRpModeLabel(SantaManager.getDefaultRpMode()) : null;

  if (target === "USER") {
    const userLabel = await buildUserLabel(client, senderId);
    if (!userLabel) {
      return null;
    }
    return modal.addLabelComponents(...[userLabel, rpModeLabel, buildMessageLabel()].filter((l): l is LabelBuilder => !!l));
  }

  // RECEIVER or CHANNEL.
  return modal.addLabelComponents(...[rpModeLabel, buildMessageLabel()].filter((l): l is LabelBuilder => !!l));
}

/**
 * Builds the Modal shown for `/ss register`, prefilled with the user's existing registration
 * details if they have one.
 * @param {?{name: String, address: String, notes: String}} existing The user's existing
 *  registration, or null/undefined if they aren't registered yet.
 * @returns The built ModalBuilder.
 */
function buildRegisterModal(existing?: { name: string; address: string; notes?: string | null } | null) {
  return new ModalBuilder()
    .setCustomId(`${COMMAND_NAME}:registermodal`)
    .setTitle(existing ? "Update Secret Santa Registration" : "Register for Secret Santa")
    .addLabelComponents(
      buildTextLabel("Name (shown on your package(s))", "name", { maxLength: 100, value: existing?.name }),
      buildTextLabel("Address (where your Santa should ship to)", "address", {
        style: TextInputStyle.Paragraph,
        maxLength: 300,
        value: existing?.address,
      }),
      buildTextLabel("Notes for your Santa (what not to buy, etc.)", "notes", {
        style: TextInputStyle.Paragraph,
        required: false,
        maxLength: 500,
        value: existing?.notes,
      }),
    );
}

/**
 * Builds the modal used to compose a reply, shown from the "Reply" button.
 * @param {String} direction The message-routing direction enum value this modal will send.
 * @param {String} targetId The Discord ID this reply will be sent to, used only when direction
 *  is in DIRECTIONS_WITH_EXPLICIT_TARGET.
 * @returns The built ModalBuilder.
 */
function buildReplyModal(direction: string, targetId: string) {
  const modal = new ModalBuilder()
    .setCustomId(`${COMMAND_NAME}:replymodal:${direction}:${targetId}`)
    .setTitle(REPLY_MODAL_TITLE[direction]);
  if (DIRECTIONS_WITH_RP_MODE.has(direction) && SantaManager.isRpModeSelectionAllowed()) {
    modal.addLabelComponents(buildRpModeLabel(SantaManager.getDefaultRpMode()));
  }
  return modal.addLabelComponents(buildMessageLabel());
}

/**
 * Parses the target chosen from the `/ss msg` target select menu.
 * @param {StringSelectMenuInteraction} interaction The select menu interaction to parse.
 * @returns {String} The user-facing target choice ('SANTA', 'RECEIVER', 'CHANNEL', or 'USER').
 */
function parseTargetSelection(interaction: StringSelectMenuInteraction) {
  return interaction.values[0];
}

/**
 * Parses a submitted `/ss register` modal into the fields needed to (un)register the sender.
 * @param {ModalSubmitInteraction} interaction The modal submit interaction to parse.
 * @returns {{name: String, address: String, notes: ?String}} The parsed registration fields.
 */
function parseRegistrationSubmission(interaction: ModalSubmitInteraction) {
  return {
    name: interaction.fields.getTextInputValue("name"),
    address: interaction.fields.getTextInputValue("address"),
    notes: interaction.fields.getTextInputValue("notes") || null,
  };
}

/**
 * Parses a submitted compose or reply modal into the fields needed to send the message.
 * @param {ModalSubmitInteraction} interaction The modal submit interaction to parse.
 * @returns {{direction: String, targetId: ?String, rpMode: String, msg: String, error: ?String}>}
 *  The parsed submission, or an `error` message if the submission was invalid.
 */
function parseModalSubmission(interaction: ModalSubmitInteraction): {
  direction: string;
  targetId: string | undefined;
  rpMode: string;
  msg: string;
  error: string | null;
} {
  const [, action, direction, replyTargetId] = interaction.customId.split(":");
  const msg = interaction.fields.getTextInputValue("message");

  // Directions without an rp-mode (e.g. RECEIVER_TO_SANTA) are disabled rather than defaulted.
  let rpMode = "DISABLED";
  if (DIRECTIONS_WITH_RP_MODE.has(direction)) {
    const selectionAllowed = SantaManager.isRpModeSelectionAllowed();
    if (selectionAllowed) {
      // The modal has an rp-mode field; use whatever the user picked.
      rpMode = interaction.fields.getStringSelectValues("rp-mode")[0];
    }
    if (!selectionAllowed || !rpMode) {
      // Selection is disabled by config, or the user left it unselected.
      rpMode = SantaManager.getDefaultRpMode();
    }
  }

  if (action === "replymodal") {
    return { direction, targetId: replyTargetId, rpMode, msg, error: null };
  }

  let targetId: string | undefined;
  if (direction === "SANTA_TO_USER") {
    const selectedUserId = interaction.fields.getStringSelectValues("user")[0];
    if (!selectedUserId || selectedUserId === interaction.user.id || !SantaManager.isRegistered(selectedUserId)) {
      return {
        direction,
        targetId: undefined,
        rpMode,
        msg,
        error: "Please select a valid, registered user (not yourself) when messaging a User.",
      };
    }
    targetId = selectedUserId;
  }

  return { direction, targetId, rpMode, msg, error: null };
}

/**
 * Sends a Secret Santa message for the given direction/target and confirms success back to the
 * sender. Assumes the interaction has already been deferred (ephemeral) by the caller.
 * @param {Interaction} interaction The interaction (button or modal submit) to reply to.
 * @param {String} direction The message-routing direction enum value.
 * @param {String} targetId The Discord ID of the target user, used only when direction is in
 *  DIRECTIONS_WITH_EXPLICIT_TARGET.
 * @param {String} rpMode The rp style to apply to the message.
 * @param {String} msg The raw message content to send.
 */
async function sendSantaMessage(
  interaction: ModalSubmitInteraction | ButtonInteraction,
  direction: string,
  targetId: string | undefined,
  rpMode: string,
  msg: string,
) {
  const client = interaction.client;
  const destination = await resolveDestination(client, direction, interaction.user.id, targetId);
  const modifiedText = await SantaManager.transformMessage(interaction.user.id, destination.id, direction, msg, rpMode);

  let embedUser: User | string | undefined;
  if (direction === "RECEIVER_TO_SANTA" || direction === "USER_TO_SANTA") {
    // The santa already knows who the sender is in both cases, so it's safe to show their name.
    embedUser = interaction.user;
  } else if (direction === "SANTA_TO_USER") {
    const receiver = await client.users.fetch(SantaManager.getReceiver(interaction.user.id)!);
    embedUser = receiver.displayName;
  }

  const embed = SantaManager.getEmbedForMessage(modifiedText, embedUser);
  if (direction === "SANTA_TO_PUBLIC") {
    embed.setTimestamp();
  }

  const replyRow = buildReplyRow(direction, interaction.user.id);
  await destination.send({
    embeds: [embed],
    components: replyRow ? [replyRow] : [],
  });
  // Only logged once delivered, so failed sends never pollute the LLM conversation history.
  SantaManager.logMessage(interaction.user.id, destination.id, msg, modifiedText);

  // Message is already sent; a failed DM copy to the sender (e.g. DMs disabled) is not an error.
  let contentOutput = `Sent the following message to ${DIRECTION_LABEL[direction]}:\n${modifiedText}`;
  const wasTransformed = modifiedText !== msg;
  if (wasTransformed) {
    contentOutput += `\n\nOriginal:\n${msg}`;
  }
  await interaction.followUp({
    content: "Success",
    flags: MessageFlags.Ephemeral,
  });
  try {
    await interaction.user.send({
      content: contentOutput,
    });
  } catch (err) {
    logger.error(`Failed to DM sender ${interaction.user.id} a copy of their sent message:`, err);
  }
}

/**
 * Handles errors thrown by a Santa command's execute/button/selectMenu/modalSubmit, notifying the user.
 * Shared by `/ss` and `/ss-admin` as their `error` handler.
 * @param {Interaction} interaction The interaction that was being handled when the error occurred.
 * @param {Error} error The error that was thrown.
 */
async function handleError(interaction: RepliableInteraction, error: unknown) {
  const source = "commandName" in interaction ? interaction.commandName : "customId" in interaction ? interaction.customId : "unknown";
  logger.error(`Error executing ${source}`);
  logger.error(error);
  const payload: InteractionReplyOptions = {
    content: "[ERROR] Something went wrong while processing your request. Please try again.",
    flags: MessageFlags.Ephemeral,
  };
  try {
    if (interaction.deferred || interaction.replied) {
      await interaction.followUp(payload);
    } else {
      await interaction.reply(payload);
    }
  } catch (notifyError) {
    logger.error("Failed to notify user of the above error:", notifyError);
  }
}

/**
 * Builds the warning appended to admin replies when some DMs couldn't be delivered.
 * @param {String[]} failed The Discord IDs of users who could not be DMed.
 * @returns {String} The warning line, or an empty string if nothing failed.
 */
function dmFailedWarning(failed: string[]) {
  return failed.length ? `\n[WARNING] Could not DM: ${failed.map((id: string) => `<@${id}>`).join(" ")}` : "";
}

export default {
  DIRECTION_LABEL,
  GIFT_STATUS_LABEL,
  handleError,
  dmFailedWarning,
  buildTargetSelectRow,
  buildComposeModal,
  buildReplyModal,
  buildRegisterModal,
  parseTargetSelection,
  parseModalSubmission,
  parseRegistrationSubmission,
  sendSantaMessage,
};
