import { ButtonInteraction, ModalSubmitInteraction, GuildMember, TextChannel, EmbedBuilder, ButtonBuilder, ButtonStyle, ActionRowBuilder, ModalBuilder, TextInputBuilder, TextInputStyle, StringSelectMenuBuilder, StringSelectMenuOptionBuilder, StringSelectMenuInteraction, MessageFlags, AttachmentBuilder } from 'discord.js';
import { replyEphemeral, convertEphemeralToFlags } from '../../utils/interaction-utils';
import { 
  VerificationType, 
  getVerificationSettings, 
  VerificationSettings,
  VerificationQuestion
} from './verification-config';
import { Colors } from '../../utils/embeds';
import { logInfo, logError } from '../../utils/logger';
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
      await interaction.reply(convertEphemeralToFlags({
        content: 'This command can only be used in a server.',
        flags: MessageFlags.Ephemeral
      }));
      return false;
    }
    
    // Get the verification attempt
    const attemptKey = `${guildId}-${user.id}`;
    const attempt = verificationAttempts.get(attemptKey);
    
    if (!attempt) {
      await interaction.reply(convertEphemeralToFlags({
        content: 'Your verification attempt has expired. Please try again.',
        flags: MessageFlags.Ephemeral
      }));
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
    await interaction.showModal(modal);
    
    logInfo('Verification', `Showed CAPTCHA answer modal to user ${interaction.user.tag}`);
    
    return true;
  } catch (error) {
    logError('Verification', `Error handling CAPTCHA answer button: ${error}`);
    
    // Only try to reply if the interaction hasn't been acknowledged yet
    if (!interaction.replied && !interaction.deferred) {
      try {
        await interaction.reply(convertEphemeralToFlags({
          content: 'There was an error processing your answer. Please try again.',
          flags: MessageFlags.Ephemeral
        }));
      } catch (replyError) {
        logError('Verification', `Failed to send error reply: ${replyError}`);
      }
    }
    
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
    
    // Simple button verification - just assign the role
    const roleAssigned = await assignVerificationRole(interaction, settings);
    
    if (!roleAssigned) {
      await interaction.editReply({
        content: 'Failed to assign verification role. Please contact a server administrator.'
      });
      return false;
    }
    
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
    // Generate a simple CAPTCHA (6 random alphanumeric characters)
    const captchaChars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
    let captchaText = '';
    for (let i = 0; i < 6; i++) {
      captchaText += captchaChars.charAt(Math.floor(Math.random() * captchaChars.length));
    }
    
    // Generate the CAPTCHA image
    const captchaImageBuffer = await generateCaptchaImage(captchaText);
    const captchaAttachment = new AttachmentBuilder(captchaImageBuffer, { name: 'captcha.png' });
    
    // Create verification embed with CAPTCHA image
    const verifyEmbed = new EmbedBuilder()
      .setColor(Colors.PRIMARY)
      .setTitle('reCAPTCHA Verification')
      .setDescription('Click the button to verify ➡️')
      .setImage('attachment://captcha.png')
      .setFooter({ text: `• Made By Soggra` });
    
    // Create the answer button
    const answerButton = new ButtonBuilder()
      .setCustomId(`captcha_answer_${interaction.guildId}`)
      .setLabel('Answer')
      .setStyle(ButtonStyle.Primary)
      .setEmoji('📝');
    
    const row = new ActionRowBuilder<ButtonBuilder>()
      .addComponents(answerButton);
    
    // Store the CAPTCHA text for verification
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
      questionId: captchaText,
      attempts: 0,
      timeout: setTimeout(() => {
        // Delete the attempt and notify user if possible
        verificationAttempts.delete(attemptKey);
        logInfo('Verification', `Verification attempt expired for user ${interaction.user.tag} in guild ${interaction.guildId}`);
      }, FIVE_MINUTES)
    });
    
    // Send the message with the CAPTCHA
    await interaction.reply(convertEphemeralToFlags({ embeds: [verifyEmbed],
      components: [row],
      files: [captchaAttachment],
      flags: MessageFlags.Ephemeral
     }));
    
    logInfo('Verification', `Successfully showed CAPTCHA to user ${interaction.user.tag} (expires in 5 minutes)`);
    return true;
  } catch (error) {
    logError('Verification', `Error handling CAPTCHA verification: ${error}`);
    
    // Only try to reply if the interaction hasn't been acknowledged yet
    if (!interaction.replied && !interaction.deferred) {
      try {
        await interaction.reply(convertEphemeralToFlags({
          content: 'There was an error with the verification system. Please try again in a few moments.',
          flags: MessageFlags.Ephemeral
        }));
      } catch (replyError) {
        logError('Verification', `Failed to send error reply: ${replyError}`);
      }
    }
    
    return false;
  }
}

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

/**
 * Assign the verification role to a user
 * 
 * @param interaction The interaction that triggered verification
 * @param settings The verification settings
 * @returns Promise resolving to true if successful
 */
/**
 * Handle CAPTCHA verification modal submission
 * 
 * @param interaction The modal submission interaction
 * @returns Promise resolving to true if successful
 */
export async function handleCaptchaModalSubmit(interaction: ModalSubmitInteraction): Promise<boolean> {
  try {
    // Defer the reply to ensure we can respond properly
    await interaction.deferReply(convertEphemeralToFlags({ ephemeral: true }));

    const { guildId, user } = interaction;
    
    if (!guildId) {
      const errorEmbed = new EmbedBuilder()
        .setColor(Colors.ERROR)
        .setTitle('❌ Verification Error')
        .setDescription('This command can only be used in a server.')
        .setFooter({ text: `• Made By Soggra` });
        
      await interaction.editReply({ embeds: [errorEmbed] });
      return false;
    }
    
    // Get verification settings
    const settings = await getVerificationSettings(guildId);
    
    if (!settings || !settings.enabled) {
      const errorEmbed = new EmbedBuilder()
        .setColor(Colors.ERROR)
        .setTitle('❌ Verification Error')
        .setDescription('Verification is not enabled on this server.')
        .setFooter({ text: `• Made By Soggra` });
        
      await interaction.editReply({ embeds: [errorEmbed] });
      return false;
    }
    
    // Get the verification attempt
    const attemptKey = `${guildId}-${user.id}`;
    const attempt = verificationAttempts.get(attemptKey);
    
    if (!attempt) {
      const errorEmbed = new EmbedBuilder()
        .setColor(Colors.ERROR)
        .setTitle('❌ Verification Expired')
        .setDescription('Your verification attempt has expired. Please try again.')
        .setFooter({ text: `• Made By Soggra` });
        
      await interaction.editReply({ embeds: [errorEmbed] });
      return false;
    }
    
    logInfo('Verification', `Processing CAPTCHA modal submission from user ${interaction.user.tag}`);
    
    // Get the input from the modal
    const captchaInput = interaction.fields.getTextInputValue('captcha_input');
    
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
        await logVerificationAttempt(interaction, settings, false, 'Too many failed CAPTCHA attempts');
        
        const failedEmbed = new EmbedBuilder()
          .setColor(Colors.ERROR)
          .setTitle('❌ Verification Failed')
          .setDescription('Too many failed attempts. Please try again later.')
          .setFooter({ text: `• Made By Soggra` });
          
        await interaction.editReply({ embeds: [failedEmbed] });
        
        return false;
      }
      
      const incorrectEmbed = new EmbedBuilder()
        .setColor(Colors.WARNING)
        .setTitle('⚠️ Incorrect CAPTCHA')
        .setDescription(`The code you entered does not match the one shown.`)
        .addFields({ name: 'Attempts Remaining', value: `${3 - attempt.attempts}`, inline: true })
        .setFooter({ text: `• Made By Soggra` });
        
      await interaction.editReply({ embeds: [incorrectEmbed] });
      
      return false;
    }
    
    // Clear the timeout
    if (attempt.timeout) clearTimeout(attempt.timeout);
    
    // Remove the attempt
    verificationAttempts.delete(attemptKey);
    
    // Assign the verification role
    const roleAssigned = await assignVerificationRole(interaction, settings);
    
    if (roleAssigned) {
      const successEmbed = new EmbedBuilder()
        .setColor(Colors.SUCCESS)
        .setTitle('✅ Verification Successful')
        .setDescription('You have been verified! Welcome to the server.')
        .setFooter({ text: `• Made By Soggra` })
        .setTimestamp();
        
      if (settings.role_id) {
        const role = interaction.guild?.roles.cache.get(settings.role_id);
        if (role) {
          successEmbed.addFields({ name: 'Role Assigned', value: role.name, inline: true });
        }
      }
        
      await interaction.editReply({ embeds: [successEmbed] });
    } else {
      const errorEmbed = new EmbedBuilder()
        .setColor(Colors.WARNING)
        .setTitle('⚠️ Partially Verified')
        .setDescription('Your verification was successful, but there was an issue assigning the verification role. Please contact a server administrator.')
        .setFooter({ text: `• Made By Soggra` })
        .setTimestamp();
        
      await interaction.editReply({ embeds: [errorEmbed] });
    }
    
    return true;
  } catch (error) {
    logError('Verification', `Error handling CAPTCHA modal submit: ${error}`);
    // Ensure reply if not already handled
    if (!interaction.replied && !interaction.deferred) {
        try {
            await interaction.reply(convertEphemeralToFlags({ content: 'An error occurred processing your CAPTCHA. Please try again.', flags: MessageFlags.Ephemeral }));
        } catch (replyError) {
            logError('Verification', `Failed to send CAPTCHA error reply: ${replyError}`);
        }
    } else if (interaction.replied && !interaction.deferred) { // Check if already replied but not deferred (e.g. from a quick fail path)
        // If already replied, we might need to followUp if the initial reply wasn't ephemeral or suitable
        // For now, assume initial reply was sufficient or log if further action needed.
    } else if (interaction.deferred) { // Standard case: was deferred
        try {
            await interaction.editReply({ content: 'An error occurred processing your CAPTCHA. Please try again.' });
        } catch (editError) {
            logError('Verification', `Failed to edit CAPTCHA deferred reply: ${editError}`);
        }
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
      // Log the successful verification and role assignment is handled here
      await logVerificationAttempt(interaction, settings, true);
      
      // Send welcome message if configured
      if (settings.welcome_message && settings.welcome_channel_id) {
        try {
          const welcomeChannel = await interaction.guild?.channels.fetch(settings.welcome_channel_id) as TextChannel;
          
          if (welcomeChannel && welcomeChannel.isTextBased()) {
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
          }
        } catch (error) {
          logError('Verification', `Error sending welcome message: ${error}`);
        }
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
    if (!settings.log_channel_id) {
      return false;
    }
    
    const logChannel = await interaction.guild?.channels.fetch(settings.log_channel_id) as TextChannel;
    
    if (!logChannel || !logChannel.isTextBased()) {
      return false;
    }
    
    // Create account age string
    const accountCreated = interaction.user.createdAt;
    const accountAge = Math.floor((Date.now() - accountCreated.getTime()) / (1000 * 60 * 60 * 24));
    
    const embed = new EmbedBuilder()
      .setColor(success ? Colors.SUCCESS : Colors.ERROR)
      .setTitle(`${success ? '✅' : '❌'} Verification ${success ? 'Successful' : 'Failed'}`)
      .setDescription(`User: <@${interaction.user.id}> (${interaction.user.tag})`)
      .addFields([
        { name: 'User ID', value: interaction.user.id, inline: true },
        { name: 'Verification Type', value: settings.type, inline: true },
        { name: 'Account Age', value: `${accountAge} days`, inline: true }
      ])
      .setTimestamp();
    
    if (!success && reason) {
      embed.addFields([{ name: 'Failure Reason', value: reason }]);
    }
    
    await logChannel.send({ embeds: [embed] });
    
    return true;
  } catch (error) {
    logError('Verification', `Error logging verification attempt: ${error}`);
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
    // Get the client directly from the main index file
    const client = require('../../index').client;
    
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
