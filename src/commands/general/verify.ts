import { SlashCommandBuilder, ChatInputCommandInteraction, GuildMember, MessageFlags, User, EmbedBuilder } from 'discord.js';
import { getVerificationSettings, VerificationType } from '../../handlers/verification/verification-config';
import { logInfo, logError, logWarning } from '../../utils/logger';
import { Colors } from '../../utils/embeds';
import { settingsManager } from '../../utils/settings';

// Track verification attempts to prevent spam
const verificationAttempts = new Map<string, number>();

export const data = new SlashCommandBuilder()
  .setName('verify')
  .setDescription('Verify yourself to gain access to the server')
  .addStringOption(option => 
    option
      .setName('code')
      .setDescription('Verification code (if required by server)')
      .setRequired(false)
  );

export async function execute(interaction: ChatInputCommandInteraction): Promise<void> {
  try {
    const { guildId, user } = interaction;
    
    if (!guildId) {
      await interaction.reply({ 
        content: 'This command can only be used in a server.', 
        ephemeral: true 
      });
      return;
    }
    
    // Verify we're not in a DM
    if (!interaction.guild) {
      await interaction.reply({ 
        content: 'This command can only be used in a server.', 
        ephemeral: true 
      });
      return;
    }
    
    // Get verification settings
    const settings = await getVerificationSettings(guildId);
    
    if (!settings || !settings.enabled) {
      await interaction.reply({ 
        content: 'Verification is not enabled on this server.', 
        ephemeral: true 
      });
      return;
    }
    
    // Defer the reply as ephemeral
    await interaction.deferReply({ ephemeral: true });
    
    // Fetch the member
    const member = interaction.member as GuildMember;
    
    // Check if user is already verified (has the verification role)
    if (settings.role_id && member.roles.cache.has(settings.role_id)) {
      await interaction.editReply({
        content: '✅ You are already verified on this server.'
      });
      return;
    }
    
    // Check if user has a verification attempt in progress (rate limiting)
    const attemptKey = `${guildId}-${user.id}`;
    const now = Date.now();
    const lastAttempt = verificationAttempts.get(attemptKey) || 0;
    
    // Rate limit to one attempt per 30 seconds
    if (lastAttempt && (now - lastAttempt) < 30000) {
      const waitTime = Math.ceil((30000 - (now - lastAttempt)) / 1000);
      await interaction.editReply({
        content: `⏳ Please wait ${waitTime} seconds before attempting to verify again.`
      });
      return;
    }
    
    // Mark this verification attempt
    verificationAttempts.set(attemptKey, now);
    
    // Process verification based on type
    switch (settings.type) {
      case VerificationType.BUTTON:
        await processButtonVerification(interaction, settings);
        break;
        
      case VerificationType.CAPTCHA:
        await processCaptchaVerification(interaction, settings);
        break;
        
      case VerificationType.CUSTOM_QUESTION:
        await interaction.editReply({
          content: '❓ Custom question verification must be completed using the verification channel. Please visit the verification channel to complete the process.'
        });
        break;
        
      case VerificationType.AGE_VERIFICATION:
        await interaction.editReply({
          content: '📅 Age verification must be completed using the verification channel. Please visit the verification channel to complete the process.'
        });
        break;
        
      default:
        await interaction.editReply({
          content: '❌ Unknown verification type. Please contact a server administrator.'
        });
    }
  } catch (error) {
    logError('Verify Command', `Error executing command: ${error}`);
    
    try {
      if (interaction.deferred) {
        await interaction.editReply('An error occurred during verification. Please try again later or contact a server administrator.');
      } else {
        await interaction.reply({ 
          content: 'An error occurred during verification. Please try again later or contact a server administrator.', 
          ephemeral: true 
        });
      }
    } catch (replyError) {
      logError('Verify Command', `Failed to send error message: ${replyError}`);
    }
  }
}

/**
 * Process simple button verification
 */
async function processButtonVerification(
  interaction: ChatInputCommandInteraction, 
  settings: any
): Promise<void> {
  try {
    const member = interaction.member as GuildMember;
    const { guildId, user } = interaction;
    
    // Check account age requirements if enabled
    if (settings.require_account_age && settings.min_account_days) {
      const accountAge = Math.floor((Date.now() - user.createdAt.getTime()) / (1000 * 60 * 60 * 24));
      
      if (accountAge < settings.min_account_days) {
        // Log verification failure
        await logVerificationAttempt(interaction, settings, false, `Account too new (${accountAge} days old, minimum ${settings.min_account_days} days required)`);
        
        await interaction.editReply({
          content: `❌ Your Discord account is too new to verify on this server. Accounts must be at least ${settings.min_account_days} days old. Your account is ${accountAge} days old.`
        });
        return;
      }
    }
    
    // Assign the verification role
    try {
      await member.roles.add(settings.role_id);
      
      // Log verification success
      await logVerificationAttempt(interaction, settings, true);
      
      // Send success message
      await interaction.editReply({
        content: '✅ You have been successfully verified! Welcome to the server.'
      });
      
      // Send welcome message if configured
      await sendWelcomeMessage(interaction, settings);
    } catch (roleError) {
      logError('Verify Command', `Error assigning verification role: ${roleError}`);
      
      await logVerificationAttempt(interaction, settings, false, `Error assigning role: ${roleError}`);
      
      await interaction.editReply({
        content: '❌ An error occurred while assigning the verification role. Please contact a server administrator.'
      });
    }
  } catch (error) {
    logError('Verify Command', `Error processing button verification: ${error}`);
    throw error;
  }
}

/**
 * Process CAPTCHA verification
 */
async function processCaptchaVerification(
  interaction: ChatInputCommandInteraction, 
  settings: any
): Promise<void> {
  try {
    const member = interaction.member as GuildMember;
    const { guildId, user } = interaction;
    const code = interaction.options.getString('code');
    
    // Check if code is provided
    if (!code) {
      await interaction.editReply({
        content: '❓ Please provide the verification code from the verification channel. Use `/verify code:YOUR_CODE`'
      });
      return;
    }
    
    // Check if the code is valid (stored in user_verification table)
    try {
      // Import database
      const { db } = require('../../database/sqlite');
      
      // Get the verification code from the database
      const stmt = db.prepare(`
        SELECT * FROM user_verification 
        WHERE guild_id = ? AND user_id = ? AND verification_code = ? AND expires_at > CURRENT_TIMESTAMP
      `);
      
      const result = stmt.get(guildId, user.id, code);
      
      if (!result) {
        // Log verification failure
        await logVerificationAttempt(interaction, settings, false, 'Invalid or expired verification code');
        
        await interaction.editReply({
          content: '❌ Invalid or expired verification code. Please check the code and try again, or visit the verification channel for a new code.'
        });
        return;
      }
      
      // Code is valid, delete it from the database
      const deleteStmt = db.prepare(`
        DELETE FROM user_verification 
        WHERE guild_id = ? AND user_id = ?
      `);
      
      deleteStmt.run(guildId, user.id);
      
      // Check account age if required
      if (settings.require_account_age && settings.min_account_days) {
        const accountAge = Math.floor((Date.now() - user.createdAt.getTime()) / (1000 * 60 * 60 * 24));
        
        if (accountAge < settings.min_account_days) {
          // Log verification failure
          await logVerificationAttempt(interaction, settings, false, `Account too new (${accountAge} days old, minimum ${settings.min_account_days} days required)`);
          
          await interaction.editReply({
            content: `❌ Your Discord account is too new to verify on this server. Accounts must be at least ${settings.min_account_days} days old. Your account is ${accountAge} days old.`
          });
          return;
        }
      }
      
      // Assign the verification role
      try {
        await member.roles.add(settings.role_id);
        
        // Log verification success
        await logVerificationAttempt(interaction, settings, true);
        
        // Send success message
        await interaction.editReply({
          content: '✅ Code verified successfully! You have been verified and now have access to the server. Welcome!'
        });
        
        // Send welcome message if configured
        await sendWelcomeMessage(interaction, settings);
      } catch (roleError) {
        logError('Verify Command', `Error assigning verification role: ${roleError}`);
        
        await logVerificationAttempt(interaction, settings, false, `Error assigning role: ${roleError}`);
        
        await interaction.editReply({
          content: '❌ An error occurred while assigning the verification role. Please contact a server administrator.'
        });
      }
    } catch (dbError) {
      logError('Verify Command', `Database error checking verification code: ${dbError}`);
      
      await interaction.editReply({
        content: '❌ An error occurred while verifying your code. Please try again later or contact a server administrator.'
      });
    }
  } catch (error) {
    logError('Verify Command', `Error processing CAPTCHA verification: ${error}`);
    throw error;
  }
}

/**
 * Log verification attempt
 */
async function logVerificationAttempt(
  interaction: ChatInputCommandInteraction,
  settings: any,
  success: boolean,
  reason?: string
): Promise<boolean> {
  try {
    const { guildId, user } = interaction;
    
    // Log to console first
    if (success) {
      logInfo('Verify Command', `User ${user.tag} (${user.id}) was verified in guild ${interaction.guild?.name} (${guildId})`);
    } else {
      logWarning('Verify Command', `User ${user.tag} (${user.id}) failed verification in guild ${interaction.guild?.name} (${guildId}): ${reason || 'No reason provided'}`);
    }
    
    // Find a log channel to use
    let logChannel = null;
    
    // First try the verification log channel
    if (settings.log_channel_id) {
      try {
        logChannel = await interaction.guild?.channels.fetch(settings.log_channel_id);
        if (!logChannel || !('send' in logChannel)) {
          logChannel = null;
        }
      } catch (error) {
        logError('Verify Command', `Error fetching verification log channel: ${error}`);
      }
    }
    
    // If no verification log channel, try a member log or mod log
    if (!logChannel) {
      try {
        const serverSettings = await settingsManager.getSettings(guildId!);
        
        // Try member logs first
        if (serverSettings.member_log_channel_id) {
          try {
            logChannel = await interaction.guild?.channels.fetch(serverSettings.member_log_channel_id);
            if (!logChannel || !('send' in logChannel)) {
              logChannel = null;
            }
          } catch (error) {
            // Just try next option
          }
        }
        
        // Then try mod logs
        if (!logChannel && serverSettings.mod_log_channel_id) {
          try {
            logChannel = await interaction.guild?.channels.fetch(serverSettings.mod_log_channel_id);
            if (!logChannel || !('send' in logChannel)) {
              logChannel = null;
            }
          } catch (error) {
            // Just continue
          }
        }
      } catch (error) {
        logError('Verify Command', `Error fetching server settings: ${error}`);
      }
    }
    
    // If we found a log channel, send a log
    if (logChannel && 'send' in logChannel) {
      // Create account age string
      const accountCreated = user.createdAt;
      const accountAge = Math.floor((Date.now() - accountCreated.getTime()) / (1000 * 60 * 60 * 24));
      
      // Create verification log embed
      const embed = new EmbedBuilder()
        .setColor(success ? Colors.SUCCESS : Colors.ERROR)
        .setTitle(`${success ? '✅' : '❌'} Verification ${success ? 'Successful' : 'Failed'}`)
        .setDescription(`User: <@${user.id}> (${user.tag})`)
        .addFields([
          { name: 'User ID', value: user.id, inline: true },
          { name: 'Verification Type', value: settings.type, inline: true },
          { name: 'Account Age', value: `${accountAge} days`, inline: true },
          { name: 'Method', value: '`/verify` command', inline: true }
        ])
        .setTimestamp()
        .setFooter({ text: 'Made by Soggra.' });
      
      // If failure, add reason
      if (!success && reason) {
        embed.addFields([{ name: 'Failure Reason', value: reason }]);
      }
      
      // Send to log channel
      try {
        await logChannel.send({ embeds: [embed] });
        return true;
      } catch (error) {
        logError('Verify Command', `Error sending to log channel: ${error}`);
      }
    }
    
    return false;
  } catch (error) {
    logError('Verify Command', `Error logging verification attempt: ${error}`);
    return false;
  }
}

/**
 * Send welcome message if configured
 */
async function sendWelcomeMessage(
  interaction: ChatInputCommandInteraction,
  settings: any
): Promise<void> {
  try {
    const { guild, user } = interaction;
    
    // Check if welcome message is configured
    if (!settings.welcome_message || !settings.welcome_channel_id) {
      return;
    }
    
    try {
      // Get the welcome channel
      const welcomeChannel = await guild?.channels.fetch(settings.welcome_channel_id);
      
      if (welcomeChannel && 'send' in welcomeChannel) {
        // Format the welcome message
        const formattedMessage = settings.welcome_message.replace(/{user}/g, `<@${user.id}>`);
        
        // Send the welcome message
        await welcomeChannel.send(formattedMessage);
      }
    } catch (error) {
      logError('Verify Command', `Error sending welcome message: ${error}`);
    }
  } catch (error) {
    logError('Verify Command', `Error in sendWelcomeMessage: ${error}`);
  }
} 