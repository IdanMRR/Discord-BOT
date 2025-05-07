import { ButtonInteraction, ModalSubmitInteraction, GuildMember, TextChannel, EmbedBuilder, ButtonBuilder, ButtonStyle, ActionRowBuilder, ModalBuilder, TextInputBuilder, TextInputStyle, StringSelectMenuBuilder, StringSelectMenuOptionBuilder, StringSelectMenuInteraction, MessageFlags, AttachmentBuilder } from 'discord.js';
import { replyEphemeral, convertEphemeralToFlags } from '../../utils/interaction-utils';
import { 
  VerificationType, 
  getVerificationSettings, 
  VerificationSettings,
  VerificationQuestion
} from './verification-config';
import { Colors } from '../../utils/embeds';
import { logInfo, logError, logWarning } from '../../utils/logger';
import { v4 as uuidv4 } from 'uuid';
import { createCanvas } from 'canvas';

// Store verification attempts with timeouts
const verificationAttempts = new Map<string, {
  userId: string,
  guildId: string,
  questionId?: string,
  attempts: number,
  timeout: NodeJS.Timeout,
  captchaImage?: string // URL to the CAPTCHA image
}>();

/**
 * Generate a CAPTCHA image
 * 
 * @param text The text to display in the CAPTCHA
 * @returns Buffer containing the image data
 */
async function generateCaptchaImage(text: string): Promise<Buffer> {
  // Create a canvas for the CAPTCHA
  const canvas = createCanvas(300, 100);
  const ctx = canvas.getContext('2d');
  
  // Fill background
  ctx.fillStyle = '#23272A';
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  
  // Draw the text in a captcha style - more readable
  ctx.font = 'bold 40px sans-serif';
  ctx.fillStyle = '#3498db'; // Discord blue color
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  
  // Add slight distortion to letters (more readable but still secure)
  for (let i = 0; i < text.length; i++) {
    const angle = Math.random() * 0.2 - 0.1; // Less rotation for better readability
    const x = 80 + i * 30; // More consistent spacing
    const y = 50 + Math.random() * 6 - 3; // Less vertical variation
    
    ctx.save();
    ctx.translate(x, y);
    ctx.rotate(angle);
    ctx.fillText(text[i], 0, 0);
    ctx.restore();
  }
  
  // Add fewer random lines for better readability
  ctx.strokeStyle = '#3498db';
  ctx.lineWidth = 1.5;
  
  // Add background pattern instead of random lines
  for (let i = 0; i < 4; i++) {
    ctx.beginPath();
    // Make the lines more horizontal for better readability
    const y1 = 20 + i * 20;
    const y2 = y1 + Math.random() * 20 - 10;
    ctx.moveTo(0, y1);
    ctx.bezierCurveTo(100, y1 + 15, 200, y2 - 15, 300, y2);
    ctx.stroke();
  }
  
  // Return the image as a buffer
  return canvas.toBuffer();
}

/**
 * Handle a verification button click
 * 
 * @param interaction The button interaction
 * @returns Promise resolving to true if successful
 */
/**
 * Handle CAPTCHA answer button click
 * 
 * @param interaction The button interaction
 * @returns Promise resolving to true if successful
 */
export async function handleCaptchaAnswerClick(interaction: ButtonInteraction): Promise<boolean> {
  try {
    const { guildId, user } = interaction;
    
    if (!guildId) {
      try {
        await interaction.reply(convertEphemeralToFlags({
          content: 'This command can only be used in a server.',
          flags: MessageFlags.Ephemeral
        }));
      } catch (replyError) {
        logError('Verification', `Error replying to interaction: ${replyError}`);
      }
      return false;
    }
    
    // Get the verification attempt
    const attemptKey = `${guildId}-${user.id}`;
    const attempt = verificationAttempts.get(attemptKey);
    
    if (!attempt) {
      try {
        await interaction.reply(convertEphemeralToFlags({
          content: 'Your verification attempt has expired. Please try again.',
          flags: MessageFlags.Ephemeral
        }));
      } catch (replyError) {
        logError('Verification', `Error replying to interaction: ${replyError}`);
      }
      return false;
    }
    
    // Create a modal for the CAPTCHA answer with proper ID to match handler
    const modal = new ModalBuilder()
      .setCustomId(`captcha_verification_${interaction.guildId}`)
      .setTitle('CAPTCHA Verification');
    
    // Add a text input for the CAPTCHA
    const captchaInput = new TextInputBuilder()
      .setCustomId('captcha_input')
      .setLabel(`Enter the code shown in the image`)
      .setPlaceholder('Enter the CAPTCHA code')
      .setStyle(TextInputStyle.Short)
      .setMinLength(6)
      .setMaxLength(6)
      .setRequired(true);
    
    const actionRow = new ActionRowBuilder<TextInputBuilder>()
      .addComponents(captchaInput);
    
    modal.addComponents(actionRow);
    
    // Show the modal
    try {
      await interaction.showModal(modal);
      logInfo('Verification', `Showed CAPTCHA answer modal to user ${interaction.user.tag}`);
      return true;
    } catch (modalError) {
      logError('Verification', `Error showing modal: ${modalError}`);
      return false;
    }
  } catch (error) {
    logError('Verification', `Error handling CAPTCHA answer button: ${error}`);
    return false;
  }
}

/**
 * Handle verification button click
 * 
 * @param interaction The button interaction
 * @returns Promise resolving to true if successful
 */
export async function handleVerificationButtonClick(interaction: ButtonInteraction): Promise<boolean> {
  try {
    const { guildId, user } = interaction;
    
    if (!guildId) {
      await interaction.reply(convertEphemeralToFlags({
        content: 'This command can only be used in a server.',
        flags: MessageFlags.Ephemeral
      }));
      return false;
    }
    
    // Get verification settings
    const settings = await getVerificationSettings(guildId);
    
    if (!settings || !settings.enabled) {
      await interaction.reply(convertEphemeralToFlags({
        content: 'Verification is not enabled on this server.',
        flags: MessageFlags.Ephemeral
      }));
      return false;
    }
    
    // Check if user is already verified (has the verification role)
    const member = interaction.member as GuildMember;
    if (settings.role_id && member.roles.cache.has(settings.role_id)) {
      await interaction.reply(convertEphemeralToFlags({
        content: 'You are already verified on this server.',
        flags: MessageFlags.Ephemeral
      }));
      return false;
    }
    
    // Check if user has a verification attempt in progress
    const attemptKey = `${guildId}-${user.id}`;
    if (verificationAttempts.has(attemptKey)) {
      await interaction.reply(convertEphemeralToFlags({
        content: 'You already have a verification attempt in progress. Please complete it or wait for it to expire.',
        flags: MessageFlags.Ephemeral
      }));
      return false;
    }
    
    // Handle different verification types
    let result = false;
    
    switch (settings.type) {
      case VerificationType.BUTTON:
        result = await handleButtonVerification(interaction, settings);
        break;
      
      case VerificationType.CAPTCHA:
        result = await handleCaptchaVerification(interaction, settings);
        break;
      
      case VerificationType.CUSTOM_QUESTION:
        result = await handleCustomQuestionVerification(interaction, settings);
        break;
      
      case VerificationType.AGE_VERIFICATION:
        result = await handleAgeVerification(interaction, settings);
        break;
      
      default:
        await interaction.reply(convertEphemeralToFlags({
          content: 'Unknown verification type. Please contact a server administrator.',
          flags: MessageFlags.Ephemeral
        }));
        return false;
    }
    
    return result;
  } catch (error) {
    logError('Verification', `Error handling verification button click: ${error}`);
    
    try {
      // Only reply if the interaction hasn't been acknowledged yet
      if (!interaction.replied && !interaction.deferred) {
        await interaction.reply({ 
          content: 'An error occurred during verification. Please try again later or contact a server administrator.',
          flags: MessageFlags.Ephemeral
         });
      }
    } catch (replyError) {
      // If we can't reply, just log it
      console.error('Failed to send error message:', replyError);
    }
    
    return false;
  }
}

/**
 * Handle simple button verification
 * 
 * @param interaction The button interaction
 * @param settings The verification settings
 * @returns Promise resolving to true if successful
 */
async function handleButtonVerification(
  interaction: ButtonInteraction,
  settings: VerificationSettings
): Promise<boolean> {
  try {
    // Defer the reply to give us time to process
    await interaction.deferReply(convertEphemeralToFlags({ ephemeral: true }));
    
    logInfo('Verification', `User ${interaction.user.tag} clicked button verification, processing...`);
    
    // Get server settings to check member logs channel
    const { settingsManager } = await import('../../utils/settings');
    const serverSettings = await settingsManager.getSettings(interaction.guildId!);
    logInfo('Verification', `Server settings for guild ${interaction.guildId}: member_log_channel_id=${serverSettings.member_log_channel_id}, mod_log_channel_id=${serverSettings.mod_log_channel_id}`);
    
    // Simple button verification - just assign the role
    const roleAssigned = await assignVerificationRole(interaction, settings);
    
    if (!roleAssigned) {
      logError('Verification', `Failed to assign verification role to user ${interaction.user.tag}`);
      await interaction.editReply({
        content: 'Failed to assign verification role. Please contact a server administrator.'
      });
      return false;
    }
    
    // Directly send to member logs channel as a backup for button verification
    try {
      if (serverSettings && serverSettings.member_log_channel_id) {
        const memberLogChannel = await interaction.guild?.channels.fetch(serverSettings.member_log_channel_id) as TextChannel;
        if (memberLogChannel && memberLogChannel.isTextBased()) {
          logInfo('Verification', `Sending button verification success log directly to member logs channel ${memberLogChannel.id}`);
          
          // Create account age string
          const accountCreated = interaction.user.createdAt;
          const accountAge = Math.floor((Date.now() - accountCreated.getTime()) / (1000 * 60 * 60 * 24));
          
          const successEmbed = new EmbedBuilder()
            .setColor(Colors.SUCCESS)
            .setTitle('✅ Button Verification Successful')
            .setDescription(`User: <@${interaction.user.id}> (${interaction.user.tag})`)
            .addFields([
              { name: 'User ID', value: interaction.user.id, inline: true },
              { name: 'Verification Type', value: settings.type, inline: true },
              { name: 'Account Age', value: `${accountAge} days`, inline: true }
            ])
            .setTimestamp();
          
          await memberLogChannel.send({ embeds: [successEmbed] });
        }
      }
    } catch (memberLogError) {
      logError('Verification', `Error sending to member logs channel: ${memberLogError}`);
    }
    
    logInfo('Verification', `Button verification successful for user ${interaction.user.tag}`);
    await interaction.editReply({
      content: 'You have been verified! Welcome to the server.'
    });
    
    return true;
  } catch (error) {
    logError('Verification', `Error handling button verification: ${error}`);
    
    try {
      if (interaction.deferred) {
        await interaction.editReply({
          content: 'An error occurred during verification. Please try again later or contact a server administrator.'
        });
      } else {
        await replyEphemeral(interaction, {
          content: 'An error occurred during verification. Please try again later or contact a server administrator.'
        });
      }
    } catch (replyError) {
      logError('Verification', `Failed to send error message: ${replyError}`);
    }
    
    return false;
  }
}

/**
 * Handle CAPTCHA verification
 * 
 * @param interaction The button interaction
 * @param settings The verification settings
 * @returns Promise resolving to true if successful
 */
async function handleCaptchaVerification(
  interaction: ButtonInteraction,
  settings: VerificationSettings
): Promise<boolean> {
  try {
    // First, defer the reply to give us time to generate the CAPTCHA
    await interaction.deferReply({ flags: MessageFlags.Ephemeral }).catch(error => {
      logError('Verification', `Error deferring reply: ${error}`);
    });
    
    // Generate a simple CAPTCHA (6 random alphanumeric characters)
    const captchaChars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
    let captchaText = '';
    for (let i = 0; i < 6; i++) {
      captchaText += captchaChars.charAt(Math.floor(Math.random() * captchaChars.length));
    }
    
    // Generate the CAPTCHA image
    let captchaBuffer: Buffer;
    try {
      captchaBuffer = await generateCaptchaImage(captchaText);
    } catch (captchaError) {
      logError('Verification', `Error generating CAPTCHA image: ${captchaError}`);
      await interaction.editReply({
        content: 'There was an error with the verification system. Please try again in a few moments.'
      }).catch(replyError => {
        logError('Verification', `Error editing reply after CAPTCHA generation error: ${replyError}`);
      });
      return false;
    }
    
    // Create an attachment from the buffer
    const captchaAttachment = new AttachmentBuilder(captchaBuffer)
      .setName('captcha.png');
    
    // Store the CAPTCHA text for verification
    const attemptKey = `${interaction.guildId}-${interaction.user.id}`;
    verificationAttempts.set(attemptKey, {
      userId: interaction.user.id,
      guildId: interaction.guildId!,
      questionId: captchaText,
      attempts: 0,
      timeout: setTimeout(() => {
        verificationAttempts.delete(attemptKey);
      }, (settings.timeout_minutes || 10) * 60 * 1000)
    });
    
    // Create a row of buttons for the CAPTCHA verification
    const row = new ActionRowBuilder<ButtonBuilder>()
      .addComponents(
        new ButtonBuilder()
          .setCustomId('captcha_answer_' + interaction.user.id)
          .setLabel('Enter CAPTCHA code')
          .setStyle(ButtonStyle.Primary)
      );
    
    // Send the CAPTCHA image with the button
    try {
      await interaction.editReply({
        content: 'Please solve the CAPTCHA by entering the code shown in the image below:',
        files: [captchaAttachment],
        components: [row]
      });
    } catch (editError) {
      logError('Verification', `Error editing reply to send CAPTCHA image: ${editError}`);
      // Clean up the verification attempt
      const attempt = verificationAttempts.get(attemptKey);
      if (attempt?.timeout) clearTimeout(attempt.timeout);
      verificationAttempts.delete(attemptKey);
      return false;
    }
    
    logInfo('Verification', `Successfully sent CAPTCHA image to user ${interaction.user.tag}`);
    return true;
  } catch (error) {
    logError('Verification', `Error handling CAPTCHA verification: ${error}`);
    
    // Clean up the verification attempt
    const attemptKey = `${interaction.guildId}-${interaction.user.id}`;
    if (verificationAttempts.has(attemptKey)) {
      const attempt = verificationAttempts.get(attemptKey);
      if (attempt?.timeout) clearTimeout(attempt.timeout);
      verificationAttempts.delete(attemptKey);
    }
    
    // Try to update the reply with an error message
    try {
      if (interaction.deferred) {
        await interaction.editReply({
          content: 'There was an error with the verification system. Please try again in a few moments.',
          files: [],
          components: []
        }).catch(() => {
          // Ignore error if we can't edit reply
        });
      }
    } catch (replyError) {
      // Just log the error, but don't throw
      logError('Verification', `Error sending error message: ${replyError}`);
    }
    
    return false;
  }
}

/**
 * Handle CAPTCHA verification modal submission
 * 
 * @param interaction The modal submission interaction
 * @returns Promise resolving to true if successful
 */
/**
 * Handle custom question verification
 * 
 * @param interaction The button interaction
 * @param settings The verification settings
 * @returns Promise resolving to true if successful
 */
async function handleCustomQuestionVerification(
  interaction: ButtonInteraction,
  settings: VerificationSettings
): Promise<boolean> {
  try {
    // Check if there are any custom questions
    if (!settings.custom_questions || settings.custom_questions.length === 0) {
      await replyEphemeral(interaction, {
        content: 'No custom questions have been set up for verification. Please contact a server administrator.'
      });
      return false;
    }
    
    // Select a random question
    const randomIndex = Math.floor(Math.random() * settings.custom_questions.length);
    const question = settings.custom_questions[randomIndex];
    
    // Create a modal for the question
    const modal = new ModalBuilder()
      .setCustomId(`question_verification_${interaction.guildId}`)
      .setTitle('Verification Question');
    
    // Add a text input for the answer
    const answerInput = new TextInputBuilder()
      .setCustomId('question_answer')
      .setLabel(question.question)
      .setPlaceholder('Your answer')
      .setStyle(TextInputStyle.Short)
      .setRequired(true);
    
    const actionRow = new ActionRowBuilder<TextInputBuilder>()
      .addComponents(answerInput);
    
    modal.addComponents(actionRow);
    
    // Store the attempt for verification
    const attemptKey = `${interaction.guildId}-${interaction.user.id}`;
    
    // Clear any existing timeout for this user
    const existingAttempt = verificationAttempts.get(attemptKey);
    if (existingAttempt?.timeout) {
      clearTimeout(existingAttempt.timeout);
    }
    
    // Set a fixed 5-minute timeout for verification
    const FIVE_MINUTES = 5 * 60 * 1000; // 5 minutes in milliseconds
    
    verificationAttempts.set(attemptKey, {
      userId: interaction.user.id,
      guildId: interaction.guildId!,
      questionId: question.id,
      attempts: 0,
      timeout: setTimeout(() => {
        // Delete the attempt and notify user if possible
        verificationAttempts.delete(attemptKey);
        logInfo('Verification', `Question verification attempt expired for user ${interaction.user.tag} in guild ${interaction.guildId}`);
      }, FIVE_MINUTES)
    });
    
    // Show the modal
    await interaction.showModal(modal);
    
    return true;
  } catch (error) {
    logError('Verification', `Error handling custom question verification: ${error}`);
    // Ensure there's a fallback reply if showing modal fails, or if other errors occur.
    if (!interaction.replied && !interaction.deferred) {
        try {
            await interaction.reply(convertEphemeralToFlags({ content: 'An error occurred during verification. Please try again later.', flags: MessageFlags.Ephemeral }));
        } catch (replyError) {
            logError('Verification', `Failed to send error reply: ${replyError}`);
        }
    } else if (interaction.deferred) {
        try {
            await interaction.editReply({ content: 'An error occurred during verification. Please try again later.' });
        } catch (editError) {
            logError('Verification', `Failed to edit deferred reply: ${editError}`);
        }
    }
    return false;
  }
}

/**
 * Handle age verification
 * 
 * @param interaction The button interaction
 * @param settings The verification settings
 * @returns Promise resolving to true if successful
 */
async function handleAgeVerification(
  interaction: ButtonInteraction,
  settings: VerificationSettings
): Promise<boolean> {
  try {
    // Create a modal for age verification
    const modal = new ModalBuilder()
      .setCustomId(`age_verification_${interaction.guildId}`)
      .setTitle('Age Verification');
    
    // Add a text input for the birth year
    const yearInput = new TextInputBuilder()
      .setCustomId('birth_year')
      .setLabel(`What year were you born in?`)
      .setPlaceholder('YYYY')
      .setStyle(TextInputStyle.Short)
      .setMinLength(4)
      .setMaxLength(4)
      .setRequired(true);
    
    const actionRow = new ActionRowBuilder<TextInputBuilder>()
      .addComponents(yearInput);
    
    modal.addComponents(actionRow);
    
    // Store the verification attempt
    const attemptKey = `${interaction.guildId}-${interaction.user.id}`;
    
    // Clear any existing timeout for this user
    const existingAttempt = verificationAttempts.get(attemptKey);
    if (existingAttempt?.timeout) {
      clearTimeout(existingAttempt.timeout);
    }
    
    // Set a fixed 5-minute timeout for verification
    const FIVE_MINUTES = 5 * 60 * 1000; // 5 minutes in milliseconds
    
    verificationAttempts.set(attemptKey, {
      userId: interaction.user.id,
      guildId: interaction.guildId!,
      attempts: 0,
      timeout: setTimeout(() => {
        // Delete the attempt and notify user if possible
        verificationAttempts.delete(attemptKey);
        logInfo('Verification', `Age verification attempt expired for user ${interaction.user.tag} in guild ${interaction.guildId}`);
      }, FIVE_MINUTES)
    });
    
    // Show the modal
    await interaction.showModal(modal);

    return true;
  } catch (error) {
    logError('Verification', `Error handling age verification: ${error}`);
    if (!interaction.replied && !interaction.deferred) {
        try {
            await interaction.reply(convertEphemeralToFlags({ content: 'An error occurred during age verification. Please try again later.', flags: MessageFlags.Ephemeral }));
        } catch (replyError) {
            logError('Verification', `Failed to send error reply for age verification: ${replyError}`);
        }
    } else if (interaction.deferred) {
        try {
            await interaction.editReply({ content: 'An error occurred during age verification. Please try again later.' });
        } catch (editError) {
            logError('Verification', `Failed to edit deferred reply for age verification: ${editError}`);
        }
    }
    return false;
  }
}

export async function handleCaptchaModalSubmit(interaction: ModalSubmitInteraction): Promise<boolean> {
  // Immediately defer the reply to give us time to process
  try {
    await interaction.deferReply({ flags: MessageFlags.Ephemeral });
  } catch (deferError) {
    logError('Verification', `Error deferring reply in CAPTCHA modal submission: ${deferError}`);
    // Continue anyway since we'll try to editReply later
  }
  
  try {
    const { guildId, user } = interaction;
    
    if (!guildId) {
      try {
        await interaction.editReply({ content: 'This command can only be used in a server.' });
      } catch (replyError) {
        logError('Verification', `Error editing reply: ${replyError}`);
      }
      return false;
    }
    
    // Get verification settings
    const settings = await getVerificationSettings(guildId);
    
    if (!settings || !settings.enabled) {
      try {
        await interaction.editReply({ content: 'Verification is not enabled on this server.' });
      } catch (replyError) {
        logError('Verification', `Error editing reply: ${replyError}`);
      }
      return false;
    }
    
    // Debug verify settings log channel
    logInfo('Verification', `Verification settings for guild ${guildId}: log_channel_id=${settings.log_channel_id}`);
    
    // Get server settings to check member logs channel
    const { settingsManager } = await import('../../utils/settings');
    const serverSettings = await settingsManager.getSettings(guildId);
    logInfo('Verification', `Server settings for guild ${guildId}: member_log_channel_id=${serverSettings.member_log_channel_id}, mod_log_channel_id=${serverSettings.mod_log_channel_id}`);
    
    // Get the verification attempt
    const attemptKey = `${guildId}-${user.id}`;
    const attempt = verificationAttempts.get(attemptKey);
    
    if (!attempt) {
      try {
        await interaction.editReply({ content: 'Your verification attempt has expired. Please try again.' });
      } catch (replyError) {
        logError('Verification', `Error editing reply: ${replyError}`);
      }
      return false;
    }
    
    // Get the input from the modal
    let captchaInput: string;
    try {
      captchaInput = interaction.fields.getTextInputValue('captcha_input');
      logInfo('Verification', `User ${user.tag} submitted CAPTCHA: ${captchaInput}, expected: ${attempt.questionId}`);
    } catch (inputError) {
      logError('Verification', `Error getting CAPTCHA input: ${inputError}`);
      try {
        await interaction.editReply({ content: 'An error occurred during verification. Please try again.' });
      } catch (replyError) {
        logError('Verification', `Error editing reply: ${replyError}`);
      }
      return false;
    }
    
    // Check if the input matches the CAPTCHA
    if (captchaInput.toUpperCase() !== attempt.questionId) {
      // Increment the attempt counter
      attempt.attempts++;
      
      // If too many failed attempts, fail the verification
      if (attempt.attempts >= 3) {
        // Clear the timeout
        if (attempt.timeout) clearTimeout(attempt.timeout);
        
        // Remove the attempt
        verificationAttempts.delete(attemptKey);
        
        // Log the failed verification
        logInfo('Verification', `User ${user.tag} failed verification after 3 attempts`);
        
        // Send to logs - guaranteed to send to member logs if available
        try {
          await logVerificationAttempt(interaction, settings, false, "Too many failed CAPTCHA attempts");
        } catch (logErrorObj) {
          logError('Verification', `Error logging verification attempt: ${logErrorObj}`);
        }
        
        // Directly send to member logs as well if it exists (redundant but ensures logs are sent)
        try {
          if (serverSettings && serverSettings.member_log_channel_id) {
            const memberLogChannel = await interaction.guild?.channels.fetch(serverSettings.member_log_channel_id) as TextChannel;
            if (memberLogChannel && memberLogChannel.isTextBased()) {
              logInfo('Verification', `Sending verification failure log directly to member logs channel ${memberLogChannel.id}`);
              const failureEmbed = new EmbedBuilder()
                .setColor(Colors.ERROR)
                .setTitle('❌ Verification Failed')
                .setDescription(`User: <@${interaction.user.id}> (${interaction.user.tag})`)
                .addFields([
                  { name: 'User ID', value: interaction.user.id, inline: true },
                  { name: 'Verification Type', value: settings.type, inline: true },
                  { name: 'Reason', value: 'Failed CAPTCHA verification after 3 attempts', inline: false }
                ])
                .setTimestamp();
              
              await memberLogChannel.send({ embeds: [failureEmbed] });
            }
          }
        } catch (memberLogError) {
          logError('Verification', `Error sending to member logs channel: ${memberLogError}`);
        }
        
        try {
          await interaction.editReply({ content: 'Too many failed attempts. Please try again later.' });
        } catch (replyError) {
          logError('Verification', `Error editing reply: ${replyError}`);
        }
        
        return false;
      }
      
      try {
        await interaction.editReply({ content: `Incorrect code. Please try again. You have ${3 - attempt.attempts} attempts remaining.` });
      } catch (replyError) {
        logError('Verification', `Error editing reply: ${replyError}`);
      }
      
      return false;
    }
    
    // Clear the timeout
    if (attempt.timeout) clearTimeout(attempt.timeout);
    
    // Remove the attempt
    verificationAttempts.delete(attemptKey);
    
    // Assign the verification role
    logInfo('Verification', `User ${user.tag} successfully verified, calling assignVerificationRole`);
    const roleAssigned = await assignVerificationRole(interaction, settings);
    
    if (!roleAssigned) {
      logError('Verification', `Failed to assign verification role to user ${user.tag}`);
      try {
        await interaction.editReply({ content: 'Failed to assign verification role. Please contact a server administrator.' });
      } catch (replyError) {
        logError('Verification', `Error editing reply: ${replyError}`);
      }
      return false;
    } else {
      logInfo('Verification', `Successfully assigned verification role to user ${user.tag}`);
      
      try {
        await interaction.editReply({ content: 'You have been verified! Welcome to the server.' });
      } catch (replyError) {
        logError('Verification', `Error editing reply: ${replyError}`);
      }
    }
    
    return true;
  } catch (error) {
    logError('Verification', `Error handling CAPTCHA modal submit: ${error}`);
    
    try {
      await interaction.editReply({ content: 'An error occurred during verification. Please try again later or contact a server administrator.' });
    } catch (replyError) {
      // If we can't reply, just log it
      console.error('Failed to send error message:', replyError);
    }
    
    return false;
  }
}
/**
 * Assign the verification role to a user
 * 
 * @param interaction The interaction that triggered verification
 * @param settings The verification settings
 * @returns Promise resolving to true if successful
 */
async function assignVerificationRole(
  interaction: ButtonInteraction | ModalSubmitInteraction,
  settings: VerificationSettings
): Promise<boolean> {
  try {
    // Add detailed logging to help diagnose the issue
    logInfo('Verification', `Starting verification role assignment for user ${interaction.user.tag} (${interaction.user.id}) in guild ${interaction.guildId}`);
    
    if (!settings.log_channel_id) {
      logWarning('Verification', `No log_channel_id configured in verification settings for guild ${interaction.guildId}`);
      
      // Try to get server settings to find member logs channel
      try {
        const { settingsManager } = await import('../../utils/settings');
        const serverSettings = await settingsManager.getSettings(interaction.guildId!);
        logInfo('Verification', `Server settings found: log_channel=${serverSettings.log_channel_id}, mod_log=${serverSettings.mod_log_channel_id}, member_log=${serverSettings.member_log_channel_id}`);
      } catch (settingsError) {
        logError('Verification', `Error fetching server settings: ${settingsError}`);
      }
    } else {
      logInfo('Verification', `Verification settings log_channel_id is set to: ${settings.log_channel_id}`);
    }
    
    if (!settings.role_id) {
      logError('Verification', `No verification role configured for guild ${interaction.guildId}`);
      return false;
    }
    
    // Make sure we have a valid member object
    if (!interaction.member) {
      logError('Verification', `Member object is undefined for user ${interaction.user.id} in guild ${interaction.guildId}`);
      return false;
    }
    
    const member = interaction.member as GuildMember;
    
    // Check if the role exists
    const role = await interaction.guild?.roles.fetch(settings.role_id).catch(error => {
      logError('Verification', `Error fetching role ${settings.role_id}: ${error}`);
      return null;
    });
    
    if (!role) {
      logError('Verification', `Role ${settings.role_id} not found in guild ${interaction.guildId}`);
      return false;
    }
    
    // Add the role to the member
    try {
      await member.roles.add(settings.role_id);
      logInfo('Verification', `Role ${settings.role_id} successfully added to user ${interaction.user.tag}`);
      
      // Log the successful verification and role assignment is handled here
      logInfo('Verification', `Calling logVerificationAttempt for successful verification of user ${interaction.user.tag}`);
      const logResult = await logVerificationAttempt(interaction, settings, true);
      logInfo('Verification', `logVerificationAttempt returned: ${logResult}`);
      
      // Send welcome message if configured
      if (settings.welcome_message && settings.welcome_channel_id) {
        try {
          const welcomeChannel = await interaction.guild?.channels.fetch(settings.welcome_channel_id) as TextChannel;
          
          if (welcomeChannel && welcomeChannel.isTextBased()) {
            logInfo('Verification', `Sending welcome message to channel ${welcomeChannel.name} (${welcomeChannel.id})`);
            const welcomeEmbed = new EmbedBuilder()
              .setColor(Colors.SUCCESS)
              .setTitle('🎉 New Member Verified')
              .setDescription(settings.welcome_message.replace('{user}', `<@${interaction.user.id}>`))
              .setFooter({ text: `• Made By Soggra` })
              .setTimestamp();
            
            await welcomeChannel.send({
              content: `Welcome <@${interaction.user.id}>!`,
              embeds: [welcomeEmbed]
            });
            logInfo('Verification', `Welcome message sent successfully`);
          } else {
            logWarning('Verification', `Welcome channel ${settings.welcome_channel_id} not found or is not a text channel`);
          }
        } catch (error) {
          logError('Verification', `Error sending welcome message: ${error}`);
        }
      } else {
        logInfo('Verification', `No welcome message configured. welcome_message: ${settings.welcome_message}, welcome_channel_id: ${settings.welcome_channel_id}`);
      }
      
      return true;
    } catch (roleError) {
      logError('Verification', `Error adding role to member: ${roleError}`);
      return false;
    }
  } catch (error) {
    logError('Verification', `Error assigning verification role: ${error}`);
    return false;
  }
}

/**
 * Log a verification attempt
 * 
 * @param interaction The interaction that triggered verification
 * @param settings The verification settings
 * @param success Whether the verification was successful
 * @param reason The reason for failure (if applicable)
 * @returns Promise resolving to true if successful
 */
async function logVerificationAttempt(
  interaction: ButtonInteraction | ModalSubmitInteraction,
  settings: VerificationSettings,
  success: boolean,
  reason?: string
): Promise<boolean> {
  try {
    // Import settings manager
    const { settingsManager } = await import('../../utils/settings');
    const serverSettings = await settingsManager.getSettings(interaction.guildId!);
    
    // Log to console for debugging
    logInfo('Verification', `Attempting to log verification attempt for user ${interaction.user.tag} (${interaction.user.id}) in guild ${interaction.guildId} - Success: ${success}`);
    
    // ALWAYS send to member logs if available
    let memberLogSent = false;
    
    if (serverSettings && serverSettings.member_log_channel_id) {
      try {
        const memberLogChannel = await interaction.guild?.channels.fetch(serverSettings.member_log_channel_id) as TextChannel;
        
        if (memberLogChannel && memberLogChannel.isTextBased()) {
          // Create account age string
          const accountCreated = interaction.user.createdAt;
          const accountAge = Math.floor((Date.now() - accountCreated.getTime()) / (1000 * 60 * 60 * 24));
          
          // Get more detailed user info
          const member = interaction.member as GuildMember;
          const joinedAt = member?.joinedAt;
          const joinedAgo = joinedAt ? Math.floor((Date.now() - joinedAt.getTime()) / (1000 * 60 * 60 * 24)) : 'Unknown';
          
          // Create a more detailed embed with improved formatting
          const embed = new EmbedBuilder()
            .setColor(success ? Colors.SUCCESS : Colors.ERROR)
            .setTitle(`${success ? '✅' : '❌'} Verification ${success ? 'Successful' : 'Failed'}`)
            .setDescription(`**User:** <@${interaction.user.id}> (${interaction.user.tag})`)
            .addFields([
              { name: 'User ID', value: interaction.user.id, inline: true },
              { name: 'Verification Type', value: settings.type, inline: true },
              { name: 'Account Age', value: `${accountAge} days`, inline: true },
              { name: 'Created On', value: `<t:${Math.floor(accountCreated.getTime() / 1000)}:F>`, inline: false },
              { name: 'Joined Server', value: joinedAt ? `<t:${Math.floor(joinedAt.getTime() / 1000)}:R>` : 'Unknown', inline: true },
              { name: 'Member For', value: `${joinedAgo} days`, inline: true }
            ])
            .setThumbnail(interaction.user.displayAvatarURL({ extension: 'png', size: 128 }))
            .setTimestamp()
            .setFooter({ text: `Verification • ${interaction.guild?.name || 'Unknown Server'}` });
          
          if (!success && reason) {
            embed.addFields([{ name: 'Failure Reason', value: reason }]);
          }
          
          // Send to member logs
          await memberLogChannel.send({ embeds: [embed] });
          logInfo('Verification', `Successfully sent verification log to member logs channel`);
          
          // If verification settings don't have a log channel, update them
          if (!settings.log_channel_id) {
            settings.log_channel_id = serverSettings.member_log_channel_id;
            // Import and use saveVerificationSettings function
            const { saveVerificationSettings } = await import('./verification-config');
            await saveVerificationSettings(interaction.guildId!, settings);
            logInfo('Verification', `Updated verification settings to use member log channel`);
          }
          
          memberLogSent = true;
        }
      } catch (memberLogError) {
        logError('Verification', `Error sending to member logs channel: ${memberLogError}`);
      }
    }
    
    // As a fallback, try to send to mod logs
    if (!memberLogSent && serverSettings && serverSettings.mod_log_channel_id) {
      try {
        const modLogChannel = await interaction.guild?.channels.fetch(serverSettings.mod_log_channel_id) as TextChannel;
        
        if (modLogChannel && modLogChannel.isTextBased()) {
          // Create account age string
          const accountCreated = interaction.user.createdAt;
          const accountAge = Math.floor((Date.now() - accountCreated.getTime()) / (1000 * 60 * 60 * 24));
          
          // Get more detailed user info
          const member = interaction.member as GuildMember;
          const joinedAt = member?.joinedAt;
          const joinedAgo = joinedAt ? Math.floor((Date.now() - joinedAt.getTime()) / (1000 * 60 * 60 * 24)) : 'Unknown';
          
          // Create a more detailed embed with improved formatting
          const embed = new EmbedBuilder()
            .setColor(success ? Colors.SUCCESS : Colors.ERROR)
            .setTitle(`${success ? '✅' : '❌'} Verification ${success ? 'Successful' : 'Failed'}`)
            .setDescription(`**User:** <@${interaction.user.id}> (${interaction.user.tag})`)
            .addFields([
              { name: 'User ID', value: interaction.user.id, inline: true },
              { name: 'Verification Type', value: settings.type, inline: true },
              { name: 'Account Age', value: `${accountAge} days`, inline: true },
              { name: 'Created On', value: `<t:${Math.floor(accountCreated.getTime() / 1000)}:F>`, inline: false },
              { name: 'Joined Server', value: joinedAt ? `<t:${Math.floor(joinedAt.getTime() / 1000)}:R>` : 'Unknown', inline: true },
              { name: 'Member For', value: `${joinedAgo} days`, inline: true }
            ])
            .setThumbnail(interaction.user.displayAvatarURL({ extension: 'png', size: 128 }))
            .setTimestamp()
            .setFooter({ text: `Verification • ${interaction.guild?.name || 'Unknown Server'}` });
          
          if (!success && reason) {
            embed.addFields([{ name: 'Failure Reason', value: reason }]);
          }
          
          // Send to mod logs
          await modLogChannel.send({ embeds: [embed] });
          logInfo('Verification', `Successfully sent verification log to mod logs channel`);
          
          // If verification settings don't have a log channel, update them
          if (!settings.log_channel_id) {
            settings.log_channel_id = serverSettings.mod_log_channel_id;
            // Import and use saveVerificationSettings function
            const { saveVerificationSettings } = await import('./verification-config');
            await saveVerificationSettings(interaction.guildId!, settings);
            logInfo('Verification', `Updated verification settings to use mod log channel`);
          }
          
          return true;
        }
      } catch (modLogError) {
        logError('Verification', `Error sending to mod logs channel: ${modLogError}`);
      }
    }
    
    // If we successfully sent to member logs, return true
    if (memberLogSent) {
      return true;
    }
    
    // Try the verification-specific log channel as last resort
    if (settings.log_channel_id) {
      try {
        const logChannel = await interaction.guild?.channels.fetch(settings.log_channel_id) as TextChannel;
        
        if (logChannel && logChannel.isTextBased()) {
          // Create account age string
          const accountCreated = interaction.user.createdAt;
          const accountAge = Math.floor((Date.now() - accountCreated.getTime()) / (1000 * 60 * 60 * 24));
          
          // Get more detailed user info
          const member = interaction.member as GuildMember;
          const joinedAt = member?.joinedAt;
          const joinedAgo = joinedAt ? Math.floor((Date.now() - joinedAt.getTime()) / (1000 * 60 * 60 * 24)) : 'Unknown';
          
          // Create a more detailed embed with improved formatting
          const embed = new EmbedBuilder()
            .setColor(success ? Colors.SUCCESS : Colors.ERROR)
            .setTitle(`${success ? '✅' : '❌'} Verification ${success ? 'Successful' : 'Failed'}`)
            .setDescription(`**User:** <@${interaction.user.id}> (${interaction.user.tag})`)
            .addFields([
              { name: 'User ID', value: interaction.user.id, inline: true },
              { name: 'Verification Type', value: settings.type, inline: true },
              { name: 'Account Age', value: `${accountAge} days`, inline: true },
              { name: 'Created On', value: `<t:${Math.floor(accountCreated.getTime() / 1000)}:F>`, inline: false },
              { name: 'Joined Server', value: joinedAt ? `<t:${Math.floor(joinedAt.getTime() / 1000)}:R>` : 'Unknown', inline: true },
              { name: 'Member For', value: `${joinedAgo} days`, inline: true }
            ])
            .setThumbnail(interaction.user.displayAvatarURL({ extension: 'png', size: 128 }))
            .setTimestamp()
            .setFooter({ text: `Verification • ${interaction.guild?.name || 'Unknown Server'}` });
          
          if (!success && reason) {
            embed.addFields([{ name: 'Failure Reason', value: reason }]);
          }
          
          // Send to verification log channel
          await logChannel.send({ embeds: [embed] });
          logInfo('Verification', `Successfully sent verification log to verification log channel`);
          return true;
        }
      } catch (logChannelError) {
        logError('Verification', `Error sending to verification log channel: ${logChannelError}`);
      }
    }
    
    // If we get here, we failed to send logs anywhere
    logWarning('Verification', `Failed to send verification logs to any channel for user ${interaction.user.tag}`);
    return false;
  } catch (error) {
    logError('Verification', `Error in logVerificationAttempt: ${error}`);
    return false;
  }
}

/**
 * Create a verification message in a channel
 * 
 * @param channelId The channel ID to send the message to
 * @param guildId The guild ID
 * @param settings The verification settings
 * @returns Promise resolving to the message ID if successful
 */
export async function createVerificationMessage(
  channelId: string,
  guildId: string,
  settings: VerificationSettings
): Promise<string | null> {
  try {
    // Get the client from cache or parameters
    const { getClient } = await import('../../utils/client-utils');
    const client = getClient();
    
    if (!client) {
      logError('Verification', 'Discord client is not initialized');
      return null;
    }
    
    const guild = await client.guilds.fetch(guildId);
    const channel = await guild.channels.fetch(channelId) as TextChannel;
    
    if (!channel || !channel.isTextBased()) {
      logError('Verification', `Invalid verification channel: ${channelId}`);
      return null;
    }
    
    // Create verification button
    const verifyButton = new ButtonBuilder()
      .setCustomId('verify_button')
      .setLabel('Verify')
      .setStyle(ButtonStyle.Primary)
      .setEmoji('✅');
    
    const row = new ActionRowBuilder<ButtonBuilder>()
      .addComponents(verifyButton);
    
    // Create verification embed
    const embed = new EmbedBuilder()
      .setColor(Colors.PRIMARY)
      .setTitle('Server Verification')
      .setDescription('Please click the button below to verify your account and gain access to the server.')
      .addFields([
        { 
          name: 'Why Verify?', 
          value: 'Verification helps us maintain a safe and secure community by ensuring that all members are real people.' 
        }
      ]);
    
    // Add verification type specific information
    switch (settings.type) {
      case VerificationType.BUTTON:
        embed.addFields([
          { 
            name: 'Verification Process', 
            value: 'Simply click the button below to verify your account. No additional steps required.' 
          }
        ]);
        break;
      
      case VerificationType.CAPTCHA:
        embed.addFields([
          { 
            name: 'Verification Process', 
            value: 'Click the button below and enter the CAPTCHA code that appears to verify your account.' 
          }
        ]);
        break;
      
      case VerificationType.CUSTOM_QUESTION:
        embed.addFields([
          { 
            name: 'Verification Process', 
            value: 'Click the button below and answer a simple question about our server to verify your account.' 
          }
        ]);
        break;
      
      case VerificationType.AGE_VERIFICATION:
        embed.addFields([
          { 
            name: 'Verification Process', 
            value: `Click the button below and confirm that you are at least ${settings.min_age || 13} years old to verify your account.` 
          }
        ]);
        break;
    }
    
    // Add account age requirement if enabled
    if (settings.require_account_age && settings.min_account_age_days) {
      embed.addFields([
        { 
          name: 'Account Age Requirement', 
          value: `Your Discord account must be at least ${settings.min_account_age_days} days old to join this server.` 
        }
      ]);
    }
    
    // Send the verification message
    const message = await channel.send({
      embeds: [embed],
      components: [row]
    });
    
    return message.id;
  } catch (error) {
    logError('Verification', `Error creating verification message: ${error}`);
    return null;
  }
}
