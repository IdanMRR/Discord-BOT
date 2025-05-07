import { CommandInteraction, ButtonInteraction, StringSelectMenuInteraction, ModalSubmitInteraction, InteractionReplyOptions, MessageComponentInteraction, InteractionUpdateOptions, MessageFlags as DiscordMessageFlags } from 'discord.js';

// Re-export MessageFlags for use in other files
export const MessageFlags = DiscordMessageFlags;

/**
 * Helper function to convert options with ephemeral: true to use flags instead
 * This helps avoid the deprecation warning: "Supplying 'ephemeral' for interaction response options is deprecated. Utilize flags instead."
 */
export function convertEphemeralToFlags(options: any): any {
  if (!options) return options;
  
  const newOptions = { ...options };
  
  if (newOptions.ephemeral === true) {
    // Add the EPHEMERAL flag
    newOptions.flags = MessageFlags.Ephemeral;
    // Remove the ephemeral property
    delete newOptions.ephemeral;
  }
  
  return newOptions;
}

/**
 * Reply to an interaction with an ephemeral message (only visible to the user who triggered the interaction)
 * This uses the proper flags approach instead of the deprecated ephemeral property
 */
export async function replyEphemeral(
  interaction: CommandInteraction | ButtonInteraction | StringSelectMenuInteraction | ModalSubmitInteraction,
  options: Omit<InteractionReplyOptions, 'ephemeral' | 'flags'>
) {
  return interaction.reply({
    ...options,
    flags: MessageFlags.Ephemeral
  });
}

/**
 * Update an interaction response with an ephemeral message
 */
export async function updateEphemeral(
  interaction: MessageComponentInteraction,
  options: Omit<InteractionUpdateOptions, 'flags'>
) {
  // Discord.js doesn't actually support ephemeral updates
  // This is kept for API consistency
  return interaction.update({
    ...options
  });
}

/**
 * Defer an interaction reply as ephemeral
 */
export async function deferEphemeral(
  interaction: CommandInteraction | ButtonInteraction | StringSelectMenuInteraction | ModalSubmitInteraction
) {
  return interaction.deferReply({
    flags: MessageFlags.Ephemeral
  });
}

/**
 * Follow up to an interaction with an ephemeral message
 */
export async function followUpEphemeral(
  interaction: CommandInteraction | ButtonInteraction | StringSelectMenuInteraction | ModalSubmitInteraction,
  options: Omit<InteractionReplyOptions, 'ephemeral' | 'flags'>
) {
  return interaction.followUp({
    ...options,
    flags: MessageFlags.Ephemeral
  });
}
