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
  captchaAnswer?: string,
  type: string
}>();

// Track processed verification interactions to prevent duplicates
const processedVerificationInteractions = new Set<string>();

/**
 * Clear verification attempt for a user
 */
function clearVerificationAttempt(guildId: string, userId: string): void {
  const attemptKey = `${guildId}-${userId}`;
  const attempt = verificationAttempts.get(attemptKey);
  if (attempt) {
    clearTimeout(attempt.timeout);
    verificationAttempts.delete(attemptKey);
    logInfo('Verification', `Cleared verification attempt for user ${userId}`);
  }
}

/**
 * Generate a much better CAPTCHA image with improved readability and security
 */
async function generateCaptchaImage(text: string): Promise<Buffer> {
  try {
    logInfo('Verification', `Starting CAPTCHA image generation for text: ${text}`);
    
    const canvas = createCanvas(500, 200);
    const ctx = canvas.getContext('2d');
    logInfo('Verification', `Canvas created successfully`);
    
    // Create complex gradient background with multiple colors
    const gradient = ctx.createLinearGradient(0, 0, 500, 200);
    gradient.addColorStop(0, '#1a1a2e');
    gradient.addColorStop(0.25, '#16213e');
    gradient.addColorStop(0.5, '#0f3460');
    gradient.addColorStop(0.75, '#16213e');
    gradient.addColorStop(1, '#1a1a2e');
    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, 500, 200);
    
    // Add geometric pattern background
    ctx.fillStyle = 'rgba(255, 255, 255, 0.03)';
    for (let i = 0; i < 30; i++) {
      const x = Math.random() * 500;
      const y = Math.random() * 200;
      const size = Math.random() * 8 + 2;
      ctx.fillRect(x, y, size, size);
    }
    
    // Add some curved lines as background noise
    for (let i = 0; i < 5; i++) {
      ctx.strokeStyle = `rgba(${Math.random() * 100 + 100}, ${Math.random() * 100 + 100}, ${Math.random() * 100 + 200}, 0.2)`;
      ctx.lineWidth = Math.random() * 3 + 1;
      ctx.beginPath();
      
      const startX = Math.random() * 500;
      const startY = Math.random() * 200;
      const cp1X = Math.random() * 500;
      const cp1Y = Math.random() * 200;
      const cp2X = Math.random() * 500;
      const cp2Y = Math.random() * 200;
      const endX = Math.random() * 500;
      const endY = Math.random() * 200;
      
      ctx.moveTo(startX, startY);
      ctx.bezierCurveTo(cp1X, cp1Y, cp2X, cp2Y, endX, endY);
      ctx.stroke();
    }
    
    logInfo('Verification', `Advanced background pattern added`);
    
    // Enhanced character drawing with more variation
    const colors = ['#ff6b6b', '#4ecdc4', '#45b7d1', '#96ceb4', '#feca57', '#ff9ff3', '#54a0ff', '#5f27cd'];
    const fonts = ['Arial', 'Georgia', 'Times New Roman', 'Verdana', 'Courier New'];
    
    for (let i = 0; i < text.length; i++) {
      const x = 80 + i * 60; // Better spacing for larger canvas
      const baseY = 100;
      const yVariation = Math.random() * 30 - 15; // More vertical variation
      const y = baseY + yVariation;
      const angle = (Math.random() * 0.6 - 0.3); // More rotation variation
      const fontSize = Math.random() * 20 + 55; // Varied font sizes
      const font = fonts[Math.floor(Math.random() * fonts.length)];
      
      ctx.save();
      ctx.translate(x, y);
      ctx.rotate(angle);
      
      // Add glow effect
      ctx.shadowColor = colors[i % colors.length];
      ctx.shadowBlur = 8;
      ctx.shadowOffsetX = 2;
      ctx.shadowOffsetY = 2;
      
      // Use varied fonts and colors
      ctx.font = `bold ${fontSize}px ${font}`;
      ctx.fillStyle = colors[i % colors.length];
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      
      // Add stroke outline for better visibility
      ctx.strokeStyle = 'rgba(255, 255, 255, 0.3)';
      ctx.lineWidth = 2;
      ctx.strokeText(text[i], 0, 0);
      ctx.fillText(text[i], 0, 0);
      
      ctx.restore();
    }
    
    logInfo('Verification', `Enhanced text drawn successfully`);
    
    // Add advanced distortion noise
    const imageData = ctx.getImageData(0, 0, 500, 200);
    const data = imageData.data;
    
    // Add pixel noise
    for (let i = 0; i < data.length; i += 4) {
      if (Math.random() > 0.95) {
        const brightness = Math.random() * 100;
        data[i] = Math.min(255, data[i] + brightness);     // Red
        data[i + 1] = Math.min(255, data[i + 1] + brightness); // Green
        data[i + 2] = Math.min(255, data[i + 2] + brightness); // Blue
      }
    }
    
    ctx.putImageData(imageData, 0, 0);
    
    // Add interference lines with better patterns
    ctx.shadowColor = 'transparent';
    for (let i = 0; i < 8; i++) {
      ctx.strokeStyle = `rgba(${Math.random() * 255}, ${Math.random() * 255}, ${Math.random() * 255}, 0.4)`;
      ctx.lineWidth = Math.random() * 3 + 1;
      ctx.beginPath();
      
      if (Math.random() > 0.5) {
        // Horizontal wavy lines
        const startY = Math.random() * 200;
        ctx.moveTo(0, startY);
        for (let x = 0; x <= 500; x += 10) {
          const waveY = startY + Math.sin(x * 0.02) * 20;
          ctx.lineTo(x, waveY);
        }
      } else {
        // Diagonal lines
        ctx.moveTo(Math.random() * 500, 0);
        ctx.lineTo(Math.random() * 500, 200);
      }
      ctx.stroke();
    }
    
    // Add dots pattern for extra security
    ctx.fillStyle = 'rgba(255, 255, 255, 0.6)';
    for (let i = 0; i < 50; i++) {
      const x = Math.random() * 500;
      const y = Math.random() * 200;
      const radius = Math.random() * 2 + 1;
      ctx.beginPath();
      ctx.arc(x, y, radius, 0, Math.PI * 2);
      ctx.fill();
    }
    
    // Add enhanced border with gradient
    const borderGradient = ctx.createLinearGradient(0, 0, 500, 0);
    borderGradient.addColorStop(0, '#4ecdc4');
    borderGradient.addColorStop(0.5, '#45b7d1');
    borderGradient.addColorStop(1, '#4ecdc4');
    ctx.strokeStyle = borderGradient;
    ctx.lineWidth = 4;
    ctx.strokeRect(2, 2, 496, 196);
    
    // Add corner decorations
    ctx.fillStyle = '#ff6b6b';
    const cornerSize = 15;
    // Top-left corner
    ctx.fillRect(2, 2, cornerSize, cornerSize);
    // Top-right corner
    ctx.fillRect(500 - cornerSize - 2, 2, cornerSize, cornerSize);
    // Bottom-left corner
    ctx.fillRect(2, 200 - cornerSize - 2, cornerSize, cornerSize);
    // Bottom-right corner
    ctx.fillRect(500 - cornerSize - 2, 200 - cornerSize - 2, cornerSize, cornerSize);
    
    logInfo('Verification', `Advanced decorations and security features added`);
    
    logInfo('Verification', `Converting enhanced canvas to buffer`);
    const buffer = canvas.toBuffer();
    logInfo('Verification', `Enhanced CAPTCHA image generation completed, buffer size: ${buffer.length}`);
    
    return buffer;
  } catch (error) {
    logError('Verification', `Error generating CAPTCHA image: ${error}`);
    logError('Verification', `Canvas error details: ${(error as Error).stack}`);
    throw error;
  }
}

/**
 * Main verification button handler - completely rewritten for clarity
 */
export async function handleVerificationButtonClick(interaction: ButtonInteraction): Promise<boolean> {
  const { guildId, user } = interaction;
  
  // Create unique interaction key to prevent duplicates
  const interactionKey = `verify-${interaction.id}`;
  
  // Check if this interaction was already processed
  if (processedVerificationInteractions.has(interactionKey)) {
    logWarning('Verification', `Duplicate verification interaction detected for ${user.tag}, skipping`);
    return true;
  }
  
  // Mark as processed immediately
  processedVerificationInteractions.add(interactionKey);
  
  // Clean up old processed interactions (keep only last 100)
  if (processedVerificationInteractions.size > 100) {
    const entries = Array.from(processedVerificationInteractions);
    entries.slice(0, 50).forEach(key => processedVerificationInteractions.delete(key));
  }
  
  // Log the attempt
  logInfo('Verification', `Verification button clicked by ${user.tag} (interaction: ${interaction.id})`);

  try {
    if (!guildId) {
      // Only reply if not already handled
      if (!interaction.replied && !interaction.deferred) {
        await interaction.reply({
          content: 'This command can only be used in a server.',
          flags: MessageFlags.Ephemeral
        });
      }
      return false;
    }
    
    // Clear any existing verification attempts for this user first
    clearVerificationAttempt(guildId, user.id);
    
    // Get verification settings
    const settings = await getVerificationSettings(guildId);
    if (!settings || !settings.enabled) {
      if (!interaction.replied && !interaction.deferred) {
        await interaction.reply({
          content: 'Verification is not enabled on this server.',
          flags: MessageFlags.Ephemeral
        });
      }
      return false;
    }
    
    // Check if user is already verified
    const member = interaction.member as GuildMember;
    if (settings.role_id && member.roles.cache.has(settings.role_id)) {
      if (!interaction.replied && !interaction.deferred) {
        await interaction.reply({
          content: 'You are already verified on this server.',
          flags: MessageFlags.Ephemeral
        });
      }
      return false;
    }
    
    // DEFER THE INTERACTION ONCE HERE FOR ALL VERIFICATION TYPES (if not already deferred)
    if (!interaction.replied && !interaction.deferred) {
      await interaction.deferReply({ flags: MessageFlags.Ephemeral });
      logInfo('Verification', `Deferred interaction for ${user.tag} - ${settings.type} verification`);
    } else {
      logInfo('Verification', `Interaction already deferred for ${user.tag} - ${settings.type} verification`);
    }
    
    // Handle verification based on type
    logInfo('Verification', `Processing ${settings.type} verification for ${user.tag}`);
    
    switch (settings.type) {
      case VerificationType.BUTTON:
        return await handleSimpleButtonVerification(interaction, settings);
      
      case VerificationType.CAPTCHA:
        return await handleCaptchaVerificationStart(interaction, settings);
      
      case VerificationType.CUSTOM_QUESTION:
        return await handleQuestionVerificationStart(interaction, settings);
      
      case VerificationType.AGE_VERIFICATION:
        return await handleAgeVerificationStart(interaction, settings);
      
      default:
        await interaction.editReply({
          content: 'Unknown verification type. Please contact a server administrator.'
        });
        return false;
    }
  } catch (error) {
    logError('Verification', `Error in verification button handler for ${user.tag}: ${error}`);
    
    // Clear any verification attempts on error
    if (guildId) {
      clearVerificationAttempt(guildId, user.id);
    }
    
    // Only reply if we haven't already
    if (!interaction.replied && !interaction.deferred) {
      try {
        await interaction.reply({ 
          content: 'An error occurred during verification. Please try again.',
          flags: MessageFlags.Ephemeral
        });
      } catch (replyError) {
        logError('Verification', `Failed to send error reply: ${replyError}`);
      }
    } else {
      try {
        await interaction.editReply({
          content: 'An error occurred during verification. Please try again.'
        });
      } catch (editError) {
        logError('Verification', `Failed to send error edit: ${editError}`);
      }
    }
    return false;
  }
}

/**
 * Simple button verification - instant role assignment
 */
async function handleSimpleButtonVerification(interaction: ButtonInteraction, settings: VerificationSettings): Promise<boolean> {
  try {
    // Interaction is already deferred in main handler
    const success = await assignVerificationRole(interaction, settings);
    
    if (success) {
      await interaction.editReply({
        content: '✅ You have been verified! Welcome to the server.'
      });
      await logVerificationAttempt(interaction, settings, true);
    } else {
      await interaction.editReply({
        content: '❌ Failed to assign verification role. Please contact a server administrator.'
      });
      await logVerificationAttempt(interaction, settings, false, 'Role assignment failed');
    }
    
    return success;
  } catch (error) {
    logError('Verification', `Error in simple button verification: ${error}`);
    return false;
  }
}

/**
 * Start CAPTCHA verification process
 */
async function handleCaptchaVerificationStart(interaction: ButtonInteraction, settings: VerificationSettings): Promise<boolean> {
  try {
    // Interaction is already deferred in main handler
    logInfo('Verification', `Starting CAPTCHA verification for ${interaction.user.tag}`);
    
    // Generate CAPTCHA
    const captchaChars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
    let captchaText = '';
    for (let i = 0; i < 6; i++) {
      captchaText += captchaChars.charAt(Math.floor(Math.random() * captchaChars.length));
    }
    logInfo('Verification', `Generated CAPTCHA text: ${captchaText} for ${interaction.user.tag}`);
    
    // Store attempt BEFORE generating image to ensure it's saved
    const attemptKey = `${interaction.guildId}-${interaction.user.id}`;
    verificationAttempts.set(attemptKey, {
      userId: interaction.user.id,
      guildId: interaction.guildId!,
      captchaAnswer: captchaText,
      attempts: 0,
      type: 'captcha',
      timeout: setTimeout(() => {
        verificationAttempts.delete(attemptKey);
        logInfo('Verification', `CAPTCHA attempt expired for ${interaction.user.tag}`);
      }, 10 * 60 * 1000) // 10 minutes
    });
    logInfo('Verification', `✅ Stored CAPTCHA attempt for ${interaction.user.tag} with key: ${attemptKey}`);
    logInfo('Verification', `Total active verification attempts after storage: ${verificationAttempts.size}`);
    logInfo('Verification', `All attempt keys: ${Array.from(verificationAttempts.keys()).join(', ')}`);
    
    try {
      // Generate image
      logInfo('Verification', `Generating CAPTCHA image for ${interaction.user.tag}`);
      const captchaBuffer = await generateCaptchaImage(captchaText);
      logInfo('Verification', `CAPTCHA image generated successfully for ${interaction.user.tag}, buffer size: ${captchaBuffer.length}`);
      
      const attachment = new AttachmentBuilder(captchaBuffer, { name: 'captcha.png' });
      
      // Create solve button
      const solveButton = new ButtonBuilder()
        .setCustomId(`captcha_solve_${interaction.user.id}`)
        .setLabel('Enter CAPTCHA Code')
        .setStyle(ButtonStyle.Primary)
        .setEmoji('🔤');
      
      const row = new ActionRowBuilder<ButtonBuilder>().addComponents(solveButton);
      
      logInfo('Verification', `Sending CAPTCHA response to ${interaction.user.tag}`);
      await interaction.editReply({
        content: '🔒 **CAPTCHA Verification**\nPlease solve the CAPTCHA below by clicking the button and entering the code shown in the image:',
        files: [attachment],
        components: [row]
      });
      
      logInfo('Verification', `✅ CAPTCHA sent successfully to user ${interaction.user.tag}`);
      return true;
    } catch (imageError) {
      logError('Verification', `❌ Error generating CAPTCHA image for ${interaction.user.tag}: ${imageError}`);
      
      // Send CAPTCHA without image as fallback
      const solveButton = new ButtonBuilder()
        .setCustomId(`captcha_solve_${interaction.user.id}`)
        .setLabel('Enter CAPTCHA Code')
        .setStyle(ButtonStyle.Primary)
        .setEmoji('🔤');
      
      const row = new ActionRowBuilder<ButtonBuilder>().addComponents(solveButton);
      
      await interaction.editReply({
        content: `🔒 **CAPTCHA Verification**\nPlease enter this code: **${captchaText}**\n\nClick the button below to enter the code:`,
        components: [row]
      });
      
      logInfo('Verification', `✅ CAPTCHA sent as text fallback to user ${interaction.user.tag}`);
      return true;
    }
  } catch (error) {
    logError('Verification', `❌ Error starting CAPTCHA verification for ${interaction.user.tag}: ${error}`);
    logError('Verification', `CAPTCHA start error stack: ${(error as Error).stack}`);
    
    // Clear any verification attempt that might have been created
    const attemptKey = `${interaction.guildId}-${interaction.user.id}`;
    const attempt = verificationAttempts.get(attemptKey);
    if (attempt) {
      clearTimeout(attempt.timeout);
      verificationAttempts.delete(attemptKey);
      logInfo('Verification', `Cleared failed CAPTCHA attempt for ${interaction.user.tag}`);
    }
    
    // Try to send an error message to the user
    try {
      await interaction.editReply({
        content: '❌ Failed to generate CAPTCHA. Please try again or contact a server administrator.'
      });
    } catch (replyError) {
      logError('Verification', `Failed to send CAPTCHA error message to ${interaction.user.tag}: ${replyError}`);
    }
    
    return false;
  }
}

/**
 * Handle CAPTCHA solve button click - show modal
 */
export async function handleCaptchaSolveClick(interaction: ButtonInteraction): Promise<boolean> {
  // Create unique interaction key to prevent duplicates
  const interactionKey = `captcha-solve-${interaction.id}`;
  
  // Check if this interaction was already processed
  if (processedVerificationInteractions.has(interactionKey)) {
    logWarning('Verification', `Duplicate CAPTCHA solve interaction detected for ${interaction.user.tag}, skipping`);
    return true;
  }
  
  // Mark as processed immediately
  processedVerificationInteractions.add(interactionKey);
  
  // Log the attempt
  logInfo('Verification', `CAPTCHA solve button clicked by ${interaction.user.tag} (interaction: ${interaction.id})`);
  
  // Check if interaction already handled
  if (interaction.replied || interaction.deferred) {
    logWarning('Verification', `CAPTCHA solve interaction already handled for ${interaction.user.tag}`);
    return true;
  }

  try {
    const attemptKey = `${interaction.guildId}-${interaction.user.id}`;
    const attempt = verificationAttempts.get(attemptKey);
    
    logInfo('Verification', `Checking verification attempt for ${interaction.user.tag}, key: ${attemptKey}`);
    logInfo('Verification', `Total active verification attempts: ${verificationAttempts.size}`);
    logInfo('Verification', `Available attempt keys: ${Array.from(verificationAttempts.keys()).join(', ')}`);
    
    if (attempt) {
      logInfo('Verification', `Found attempt for ${interaction.user.tag}: type=${attempt.type}, attempts=${attempt.attempts}`);
    } else {
      logWarning('Verification', `No attempt found for key: ${attemptKey}`);
    }
    
    if (!attempt || attempt.type !== 'captcha') {
      logWarning('Verification', `No valid CAPTCHA attempt found for ${interaction.user.tag}`);
      await interaction.reply({
        content: 'Your CAPTCHA verification has expired. Please start verification again by clicking the "Verify Account" button.',
        flags: MessageFlags.Ephemeral
      });
      return false;
    }
    
    logInfo('Verification', `Creating CAPTCHA modal for ${interaction.user.tag}`);
    
    // Create modal
    const modal = new ModalBuilder()
      .setCustomId(`captcha_submit_${interaction.user.id}`)
      .setTitle('CAPTCHA Verification');
    
    const codeInput = new TextInputBuilder()
      .setCustomId('captcha_code')
      .setLabel('Enter the 6-character code from the image')
      .setPlaceholder('Enter code here...')
      .setStyle(TextInputStyle.Short)
      .setMinLength(6)
      .setMaxLength(6)
      .setRequired(true);
    
    const row = new ActionRowBuilder<TextInputBuilder>().addComponents(codeInput);
    modal.addComponents(row);
    
    logInfo('Verification', `Showing CAPTCHA modal to ${interaction.user.tag}`);
    await interaction.showModal(modal);
    logInfo('Verification', `CAPTCHA modal shown successfully to ${interaction.user.tag}`);
    return true;
  } catch (error) {
    logError('Verification', `Error showing CAPTCHA modal for ${interaction.user.tag}: ${error}`);
    logError('Verification', `CAPTCHA modal error stack: ${(error as Error).stack}`);
    
    // Try to send an error message if possible
    try {
      if (!interaction.replied && !interaction.deferred) {
        await interaction.reply({
          content: 'An error occurred while showing the CAPTCHA input. Please try again.',
          flags: MessageFlags.Ephemeral
        });
      }
    } catch (replyError) {
      logError('Verification', `Failed to send CAPTCHA modal error message: ${replyError}`);
    }
    
    return false;
  }
}

/**
 * Handle CAPTCHA modal submission
 */
export async function handleCaptchaModalSubmit(interaction: ModalSubmitInteraction): Promise<boolean> {
  // Create unique interaction key to prevent duplicates
  const interactionKey = `captcha-modal-${interaction.id}`;
  
  // Check if this interaction was already processed
  if (processedVerificationInteractions.has(interactionKey)) {
    logWarning('Verification', `Duplicate CAPTCHA modal interaction detected for ${interaction.user.tag}, skipping`);
    return true;
  }
  
  // Mark as processed immediately
  processedVerificationInteractions.add(interactionKey);
  
  logInfo('Verification', `CAPTCHA modal submitted by ${interaction.user.tag} (interaction: ${interaction.id})`);
  
  try {
    if (!interaction.replied && !interaction.deferred) {
      await interaction.deferReply({ flags: MessageFlags.Ephemeral });
    }
    
    const attemptKey = `${interaction.guildId}-${interaction.user.id}`;
    const attempt = verificationAttempts.get(attemptKey);
    
    logInfo('Verification', `Processing CAPTCHA submission for ${interaction.user.tag}, attempt key: ${attemptKey}`);
    logInfo('Verification', `Active attempts: ${verificationAttempts.size}, attempt found: ${!!attempt}`);
    
    if (!attempt || attempt.type !== 'captcha') {
      await interaction.editReply({
        content: 'Your CAPTCHA verification has expired. Please start verification again.'
      });
      return false;
    }
    
    const userCode = interaction.fields.getTextInputValue('captcha_code').toUpperCase();
    const correctCode = attempt.captchaAnswer?.toUpperCase();
    
    logInfo('Verification', `CAPTCHA codes - User: ${userCode}, Correct: ${correctCode}`);
    
    if (userCode !== correctCode) {
      attempt.attempts++;
      
      if (attempt.attempts >= 3) {
        clearTimeout(attempt.timeout);
        verificationAttempts.delete(attemptKey);
        
        await interaction.editReply({
          content: '❌ **Verification Failed**\nToo many incorrect attempts. Please start verification again.'
        });
        
        const settings = await getVerificationSettings(interaction.guildId!);
        if (settings) {
          await logVerificationAttempt(interaction, settings, false, 'Too many CAPTCHA attempts');
        }
        return false;
      }
      
      await interaction.editReply({
        content: `❌ **Incorrect Code**\nYou have ${3 - attempt.attempts} attempts remaining. Please try again.`
      });
      return false;
    }
    
    // Success!
    clearTimeout(attempt.timeout);
    verificationAttempts.delete(attemptKey);
    
    logInfo('Verification', `CAPTCHA verification successful for ${interaction.user.tag}, assigning role`);
    
    const settings = await getVerificationSettings(interaction.guildId!);
    if (!settings) {
      await interaction.editReply({
        content: '❌ Verification settings not found. Please contact a server administrator.'
      });
      return false;
    }
    
    const roleAssigned = await assignVerificationRole(interaction, settings);
    
    if (roleAssigned) {
      const successEmbed = new EmbedBuilder()
        .setColor(Colors.SUCCESS)
        .setTitle('✅ Verification Successful!')
        .setDescription('You have been verified and given access to the server. Welcome!')
        .addFields([
          { name: '🎉 Welcome!', value: 'You now have full access to this server.', inline: false },
          { name: '📋 Next Steps', value: 'Feel free to explore the channels and join the community!', inline: false }
        ])
        .setFooter({ text: 'Made by Soggra' })
        .setTimestamp();

      await interaction.editReply({
        embeds: [successEmbed]
      });
      await logVerificationAttempt(interaction, settings, true);
      return true;
    } else {
      await interaction.editReply({
        content: '❌ Failed to assign verification role. Please contact a server administrator.'
      });
      await logVerificationAttempt(interaction, settings, false, 'Role assignment failed');
      return false;
    }
  } catch (error) {
    logError('Verification', `Error processing CAPTCHA submission: ${error}`);
    return false;
  }
}

/**
 * Start question verification
 */
async function handleQuestionVerificationStart(interaction: ButtonInteraction, settings: VerificationSettings): Promise<boolean> {
  try {
    if (!settings.custom_questions || settings.custom_questions.length === 0) {
      await interaction.editReply({
        content: 'No verification questions have been configured. Please contact a server administrator.'
      });
      return false;
    }
    
    const question = settings.custom_questions[Math.floor(Math.random() * settings.custom_questions.length)];
    
    // Store attempt
    const attemptKey = `${interaction.guildId}-${interaction.user.id}`;
    verificationAttempts.set(attemptKey, {
      userId: interaction.user.id,
      guildId: interaction.guildId!,
      questionId: question.id,
      attempts: 0,
      type: 'question',
      timeout: setTimeout(() => {
        verificationAttempts.delete(attemptKey);
      }, 10 * 60 * 1000)
    });
    
    // Create modal
    const modal = new ModalBuilder()
      .setCustomId(`question_submit_${interaction.user.id}`)
      .setTitle('Verification Question');
    
    const answerInput = new TextInputBuilder()
      .setCustomId('question_answer')
      .setLabel(question.question)
      .setPlaceholder('Enter your answer...')
      .setStyle(TextInputStyle.Short)
      .setRequired(true);
    
    const row = new ActionRowBuilder<TextInputBuilder>().addComponents(answerInput);
    modal.addComponents(row);
    
    await interaction.showModal(modal);
    return true;
  } catch (error) {
    logError('Verification', `Error starting question verification: ${error}`);
    return false;
  }
}

/**
 * Handle question modal submission
 */
export async function handleQuestionModalSubmit(interaction: ModalSubmitInteraction): Promise<boolean> {
  try {
    if (!interaction.replied && !interaction.deferred) {
      await interaction.deferReply({ flags: MessageFlags.Ephemeral });
    }
    
    const attemptKey = `${interaction.guildId}-${interaction.user.id}`;
    const attempt = verificationAttempts.get(attemptKey);
    
    if (!attempt || attempt.type !== 'question') {
      await interaction.editReply({
        content: 'Your verification attempt has expired. Please start verification again.'
      });
      return false;
    }
    
    const settings = await getVerificationSettings(interaction.guildId!);
    if (!settings || !settings.custom_questions) {
      await interaction.editReply({
        content: 'Verification configuration error. Please contact a server administrator.'
      });
      return false;
    }
    
    const question = settings.custom_questions.find(q => q.id === attempt.questionId);
    if (!question) {
      await interaction.editReply({
        content: 'Question not found. Please start verification again.'
      });
      return false;
    }
    
    const userAnswer = interaction.fields.getTextInputValue('question_answer');
    const correctAnswer = question.case_sensitive ? question.answer : question.answer.toLowerCase();
    const submittedAnswer = question.case_sensitive ? userAnswer : userAnswer.toLowerCase();
    
    if (submittedAnswer !== correctAnswer) {
      attempt.attempts++;
      
      if (attempt.attempts >= 3) {
        clearTimeout(attempt.timeout);
        verificationAttempts.delete(attemptKey);
        
        await interaction.editReply({
          content: '❌ **Verification Failed**\nToo many incorrect attempts. Please start verification again.'
        });
        
        await logVerificationAttempt(interaction, settings, false, 'Too many question attempts');
        return false;
      }
      
      await interaction.editReply({
        content: `❌ **Incorrect Answer**\nYou have ${3 - attempt.attempts} attempts remaining.`
      });
      return false;
    }
    
    // Success!
    clearTimeout(attempt.timeout);
    verificationAttempts.delete(attemptKey);
    
    const roleAssigned = await assignVerificationRole(interaction, settings);
    
    if (roleAssigned) {
      const successEmbed = new EmbedBuilder()
        .setColor(Colors.SUCCESS)
        .setTitle('✅ Verification Successful!')
        .setDescription('Correct answer! You have been verified and given access to the server. Welcome!')
        .addFields([
          { name: '🎉 Welcome!', value: 'You now have full access to this server.', inline: false },
          { name: '📋 Next Steps', value: 'Feel free to explore the channels and join the community!', inline: false }
        ])
        .setFooter({ text: 'Made by Soggra' })
        .setTimestamp();

      await interaction.editReply({
        embeds: [successEmbed]
      });
      await logVerificationAttempt(interaction, settings, true);
      return true;
    } else {
      await interaction.editReply({
        content: '❌ Failed to assign verification role. Please contact a server administrator.'
      });
      await logVerificationAttempt(interaction, settings, false, 'Role assignment failed');
      return false;
    }
  } catch (error) {
    logError('Verification', `Error processing question submission: ${error}`);
    return false;
  }
}

/**
 * Start age verification
 */
async function handleAgeVerificationStart(interaction: ButtonInteraction, settings: VerificationSettings): Promise<boolean> {
  try {
    // Store attempt
    const attemptKey = `${interaction.guildId}-${interaction.user.id}`;
    verificationAttempts.set(attemptKey, {
      userId: interaction.user.id,
      guildId: interaction.guildId!,
      attempts: 0,
      type: 'age',
      timeout: setTimeout(() => {
        verificationAttempts.delete(attemptKey);
      }, 5 * 60 * 1000)
    });
    
    const modal = new ModalBuilder()
      .setCustomId(`age_submit_${interaction.user.id}`)
      .setTitle('Age Verification');
    
    const yearInput = new TextInputBuilder()
      .setCustomId('birth_year')
      .setLabel(`What year were you born? (Must be ${settings.min_age || 13}+ years old)`)
      .setPlaceholder('YYYY')
      .setStyle(TextInputStyle.Short)
      .setMinLength(4)
      .setMaxLength(4)
      .setRequired(true);
    
    const row = new ActionRowBuilder<TextInputBuilder>().addComponents(yearInput);
    modal.addComponents(row);
    
    await interaction.showModal(modal);
    return true;
  } catch (error) {
    logError('Verification', `Error starting age verification: ${error}`);
    return false;
  }
}

// Legacy function placeholders for compatibility
export async function handleCaptchaAnswerClick(interaction: ButtonInteraction): Promise<boolean> {
  // Redirect to new CAPTCHA solve handler
  return await handleCaptchaSolveClick(interaction);
}

/**
 * Assign verification role (simplified)
 */
async function assignVerificationRole(interaction: ButtonInteraction | ModalSubmitInteraction, settings: VerificationSettings): Promise<boolean> {
  try {
    if (!settings.role_id) {
      logError('Verification', 'No verification role configured');
      return false;
    }
    
    const member = interaction.member as GuildMember;
    if (!member) {
      logError('Verification', 'Member not found');
      return false;
    }
    
    logInfo('Verification', `Attempting to assign role ${settings.role_id} to ${interaction.user.tag}`);
    
    // Check if member already has the role
    if (member.roles.cache.has(settings.role_id)) {
      logWarning('Verification', `User ${interaction.user.tag} already has the verification role`);
      return true; // Consider this success since they have the role
    }
    
    // Check if the role exists
    const guild = interaction.guild;
    if (!guild) {
      logError('Verification', 'Guild not found');
      return false;
    }
    
    const role = await guild.roles.fetch(settings.role_id);
    if (!role) {
      logError('Verification', `Verification role ${settings.role_id} not found in guild`);
      return false;
    }
    
    logInfo('Verification', `Found role: ${role.name} (${role.id}), assigning to ${interaction.user.tag}`);
    
    await member.roles.add(settings.role_id);
    logInfo('Verification', `✅ Verification role successfully assigned to ${interaction.user.tag}`);
    return true;
  } catch (error) {
    logError('Verification', `❌ Error assigning role to ${interaction.user.tag}: ${error}`);
    logError('Verification', `Role assignment error details: ${(error as Error).stack}`);
    return false;
  }
}

/**
 * Log verification attempt (simplified)
 */
async function logVerificationAttempt(interaction: ButtonInteraction | ModalSubmitInteraction, settings: VerificationSettings, success: boolean, reason?: string): Promise<boolean> {
  try {
    logInfo('Verification', `Logging verification attempt: ${success ? 'SUCCESS' : 'FAILED'} for ${interaction.user.tag}`);
    
    // 1. FIRST: Store in database for dashboard
    try {
      const { db } = await import('../../database/sqlite');
      
      // Insert into server_logs table for dashboard display
      const insertLogStmt = db.prepare(`
        INSERT INTO server_logs (
          guild_id, user_id, target_id, action_type, details, created_at
        ) VALUES (?, ?, ?, ?, ?, ?)
      `);
      
      const logDetails = JSON.stringify({
        verification_type: settings.type,
        success: success,
        reason: reason || null,
        account_age_days: Math.floor((Date.now() - interaction.user.createdAt.getTime()) / (1000 * 60 * 60 * 24))
      });
      
      insertLogStmt.run(
        interaction.guildId,
        interaction.user.id, // moderator (the user verifying themselves)
        interaction.user.id, // target (the user being verified)
        success ? 'memberVerificationSuccess' : 'memberVerificationFailed',
        logDetails,
        Date.now()
      );
      
      logInfo('Verification', `✅ Verification attempt stored in database for ${interaction.user.tag}`);
    } catch (dbError) {
      logError('Verification', `❌ Error storing verification in database: ${dbError}`);
    }
    
    // 2. SECOND: Send to Discord channel (prioritize member log channel)
    let logChannel: TextChannel | null = null;
    let channelSource = '';
    
    // Get server settings for member log channel
    try {
      const { settingsManager } = await import('../../utils/settings');
      const serverSettings = await settingsManager.getSettings(interaction.guildId!);
      
      // Try member log channel first (highest priority)
      if (serverSettings?.member_log_channel_id) {
        try {
          logChannel = await interaction.guild?.channels.fetch(serverSettings.member_log_channel_id) as TextChannel;
          channelSource = 'member logs channel';
          logInfo('Verification', `Found member logs channel for verification logging`);
        } catch (e) {
          logWarning('Verification', `Member logs channel not accessible: ${e}`);
          logChannel = null;
        }
      }
      
      // Fallback to verification log channel
      if (!logChannel && settings.log_channel_id) {
        try {
          logChannel = await interaction.guild?.channels.fetch(settings.log_channel_id) as TextChannel;
          channelSource = 'verification logs channel';
          logInfo('Verification', `Using verification logs channel as fallback`);
        } catch (e) {
          logWarning('Verification', `Verification logs channel not accessible: ${e}`);
          logChannel = null;
        }
      }
    } catch (settingsError) {
      logError('Verification', `Error getting server settings: ${settingsError}`);
    }
    
    if (!logChannel || !logChannel.isTextBased()) {
      logWarning('Verification', `❌ No suitable log channel found for Discord notification`);
      return true; // Still return true since we logged to database
    }
    
    const embed = new EmbedBuilder()
      .setColor(success ? Colors.SUCCESS : Colors.ERROR)
      .setTitle(`${success ? '✅' : '❌'} Member Verification ${success ? 'Successful' : 'Failed'}`)
      .setDescription(`**User:** <@${interaction.user.id}> (${interaction.user.tag})`)
      .addFields([
        { name: 'User ID', value: interaction.user.id, inline: true },
        { name: 'Verification Type', value: settings.type.toUpperCase(), inline: true },
        { name: 'Account Age', value: `${Math.floor((Date.now() - interaction.user.createdAt.getTime()) / (1000 * 60 * 60 * 24))} days`, inline: true }
      ])
      .setThumbnail(interaction.user.displayAvatarURL())
      .setFooter({ text: `User verified themselves • ${channelSource}` })
      .setTimestamp();
    
    if (!success && reason) {
      embed.addFields([{ name: 'Failure Reason', value: reason }]);
    }
    
    if (success) {
      embed.addFields([{ name: 'Status', value: '🎉 User has been verified and given access to the server' }]);
    }
    
    await logChannel.send({ embeds: [embed] });
    logInfo('Verification', `✅ Verification attempt logged to ${channelSource} for ${interaction.user.tag}`);
    return true;
  } catch (error) {
    logError('Verification', `❌ Error logging verification: ${error}`);
    return false;
  }
}

/**
 * Create verification message in channel
 */
export async function createVerificationMessage(channelId: string, guildId: string, settings: VerificationSettings): Promise<string | null> {
  try {
    const { getClient } = await import('../../utils/client-utils');
    const client = getClient();
    
    if (!client) {
      logError('Verification', 'Discord client not available');
      return null;
    }
    
    const guild = await client.guilds.fetch(guildId);
    const channel = await guild.channels.fetch(channelId) as TextChannel;
    
    if (!channel?.isTextBased()) {
      logError('Verification', 'Invalid verification channel');
      return null;
    }
    
    const embed = new EmbedBuilder()
      .setColor(Colors.PRIMARY)
      .setTitle('🔒 Server Verification')
      .setDescription('Welcome! Please verify your account to gain access to this server.')
      .addFields([
        { name: '🔹 Why Verification?', value: 'Verification helps maintain a safe and secure community.' },
        { name: '🔹 How to Verify', value: 'Click the button below to start the verification process.' }
      ])
      .setFooter({ text: 'Made by Soggra • Verification System' })
      .setTimestamp();
    
    const verifyButton = new ButtonBuilder()
      .setCustomId('verify_button')
      .setLabel('Verify Account')
      .setStyle(ButtonStyle.Success)
      .setEmoji('✅');
    
    const row = new ActionRowBuilder<ButtonBuilder>().addComponents(verifyButton);
    
    const message = await channel.send({
      embeds: [embed],
      components: [row]
    });
    
    logInfo('Verification', `Verification message created in ${channel.name}`);
    return message.id;
  } catch (error) {
    logError('Verification', `Error creating verification message: ${error}`);
    return null;
  }
}

/**
 * Create custom verification message in channel
 */
export async function createCustomVerificationMessage(
  channelId: string, 
  guildId: string, 
  settings: VerificationSettings, 
  customMessage: {
    title: string;
    description: string;
    color: string;
    buttonText?: string;
    fields?: Array<{
      name: string;
      value: string;
      inline?: boolean;
    }>;
  }
): Promise<string | null> {
  try {
    logInfo('Verification', `Creating custom verification message with ${customMessage.fields?.length || 0} custom fields`);
    
    // Log the custom fields for debugging
    if (customMessage.fields && customMessage.fields.length > 0) {
      logInfo('Verification', 'Custom fields received:');
      customMessage.fields.forEach((field, index) => {
        logInfo('Verification', `Field ${index + 1}: "${field.name}" = "${field.value}"`);
      });
    } else {
      logInfo('Verification', 'No custom fields provided, using defaults');
    }
    
    const { getClient } = await import('../../utils/client-utils');
    const client = getClient();
    
    if (!client) {
      logError('Verification', 'Discord client not available');
      return null;
    }
    
    const channel = client.channels.cache.get(channelId) as TextChannel;
    if (!channel) {
      logError('Verification', `Channel ${channelId} not found`);
      return null;
    }
    
    const color = customMessage.color.startsWith('#') 
      ? parseInt(customMessage.color.slice(1), 16) 
      : parseInt(customMessage.color, 16);
    
    // Use custom fields if provided, otherwise use defaults
    const fields = customMessage.fields && customMessage.fields.length > 0 
      ? customMessage.fields 
      : [
          { name: '🔹 Why Verification?', value: 'Verification helps maintain a safe and secure community.' },
          { name: '🔹 How to Verify', value: 'Click the button below to start the verification process.' }
        ];
    
    // Log which fields will be used
    logInfo('Verification', `Using ${fields.length} fields in verification message:`);
    fields.forEach((field, index) => {
      logInfo('Verification', `  ${index + 1}. "${field.name}": "${field.value}"`);
    });
    
    // Add spacing between fields for better readability
    const formattedFields = fields.map((field, index) => ({
      name: field.name,
      value: field.value,
      inline: field.inline || false
    }));
    
    const embed = new EmbedBuilder()
      .setColor(color)
      .setTitle(customMessage.title)
      .setDescription(customMessage.description)
      .addFields(formattedFields)
      .setFooter({ text: 'Made by Soggra • Verification System' })
      .setTimestamp();
    
    logInfo('Verification', `Creating embed with ${formattedFields.length} fields`);
    
    // Use custom button text if provided, otherwise use default
    const buttonText = customMessage.buttonText || 'Verify Account';
    logInfo('Verification', `Using button text: "${buttonText}"`);
    
    // Create verification button
    const row = new ActionRowBuilder<ButtonBuilder>()
      .addComponents(
        new ButtonBuilder()
          .setCustomId('verify_button')
          .setLabel(`✅ ${buttonText}`)
          .setStyle(ButtonStyle.Success)
      );
    
    // Send the message
    const message = await channel.send({
      embeds: [embed],
      components: [row]
    });
    
    logInfo('Verification', `Custom verification message created with ID ${message.id} in ${channel.name}`);
    return message.id;
    
  } catch (error) {
    logError('Verification', `Error creating custom verification message: ${error}`);
    return null;
  }
}

/**
 * Clear verification attempt for a user (exported for debugging)
 */
export function clearUserVerificationAttempt(guildId: string, userId: string): boolean {
  try {
    clearVerificationAttempt(guildId, userId);
    return true;
  } catch (error) {
    logError('Verification', `Error clearing verification attempt: ${error}`);
    return false;
  }
}

/**
 * Get all active verification attempts (for debugging)
 */
export function getActiveVerificationAttempts(): Array<{guildId: string, userId: string, type: string, attempts: number}> {
  const active = [];
  for (const [key, attempt] of verificationAttempts.entries()) {
    active.push({
      guildId: attempt.guildId,
      userId: attempt.userId,
      type: attempt.type,
      attempts: attempt.attempts
    });
  }
  return active;
}
