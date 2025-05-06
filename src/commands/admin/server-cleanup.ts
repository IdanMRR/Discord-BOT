import { 
  SlashCommandBuilder, 
  PermissionFlagsBits, 
  ChatInputCommandInteraction,
  ChannelType,
  EmbedBuilder,
  TextChannel,
  CategoryChannel,
  MessageFlags
} from 'discord.js';
import { Colors, createSuccessEmbed, createErrorEmbed } from '../../utils/embeds';
import { logInfo, logError, logCommandUsage } from '../../utils/logger';
import { settingsManager } from '../../utils/settings';

import { getContextLanguage, getTranslation as t } from '../../utils/language';

export const data = new SlashCommandBuilder()
  .setName('server-cleanup')
  .setDescription('Delete old server setup channels and categories')
  .setDefaultMemberPermissions(PermissionFlagsBits.Administrator)
  .addBooleanOption(option =>
    option.setName('delete_tickets')
      .setDescription('Delete ticket channels and category')
      .setRequired(false)
  )
  .addBooleanOption(option =>
    option.setName('delete_logs')
      .setDescription('Delete log channels and category')
      .setRequired(false)
  )
  .addBooleanOption(option =>
    option.setName('delete_welcome')
      .setDescription('Delete welcome channel')
      .setRequired(false)
  )
  .addBooleanOption(option =>
    option.setName('delete_all')
      .setDescription('Delete all server setup channels and categories')
      .setRequired(false)
  )
  .addBooleanOption(option =>
    option.setName('reset_settings')
      .setDescription('Reset server settings in the database')
      .setRequired(false)
  );

export async function execute(interaction: ChatInputCommandInteraction) {
  try {
    // Defer the reply as this might take some time
    await interaction.deferReply({ flags: MessageFlags.Ephemeral });

    // Get the guild's language preference
    const language = await getContextLanguage(interaction.guildId!);

    // Get options
    const deleteTickets = interaction.options.getBoolean('delete_tickets') ?? false;
    const deleteLogs = interaction.options.getBoolean('delete_logs') ?? false;
    const deleteWelcome = interaction.options.getBoolean('delete_welcome') ?? false;
    const deleteAll = interaction.options.getBoolean('delete_all') ?? false;
    const resetSettings = interaction.options.getBoolean('reset_settings') ?? false;

    // Log command usage
    await logCommandUsage({
      guild: interaction.guild!,
      user: interaction.user,
      command: 'server-cleanup',
      options: { 
        deleteTickets,
        deleteLogs,
        deleteWelcome,
        deleteAll,
        resetSettings
      },
      channel: interaction.channel,
      success: true
    });

    // Get server settings
    const settings = await settingsManager.getSettings(interaction.guildId!);
    
    // Track what was deleted
    const deletedItems: string[] = [];
    
    // Delete ticket channels and category if requested
    if (deleteTickets || deleteAll) {
      // Delete ticket category
      if (settings?.ticket_category_id) {
        const ticketCategory = await interaction.guild!.channels.fetch(settings.ticket_category_id).catch(() => null);
        if (ticketCategory && ticketCategory.type === ChannelType.GuildCategory) {
          // Get all channels in the category
          const ticketChannels = interaction.guild!.channels.cache.filter(
            channel => channel.parentId === ticketCategory.id
          );
          
          // Delete each channel in the category
          for (const [, channel] of ticketChannels) {
            await channel.delete().catch(error => {
              logError('Server Cleanup', `Error deleting channel ${channel.name}: ${error}`);
            });
            deletedItems.push(`Channel: #${channel.name}`);
          }
          
          // Delete the category itself
          await ticketCategory.delete().catch(error => {
            logError('Server Cleanup', `Error deleting ticket category: ${error}`);
          });
          deletedItems.push('Category: Tickets');
        }
      }
      
      // Delete ticket panel channel
      if (settings?.ticket_panel_channel_id) {
        const ticketPanelChannel = await interaction.guild!.channels.fetch(settings.ticket_panel_channel_id).catch(() => null);
        if (ticketPanelChannel) {
          await ticketPanelChannel.delete().catch(error => {
            logError('Server Cleanup', `Error deleting ticket panel channel: ${error}`);
          });
          deletedItems.push(`Channel: #${ticketPanelChannel.name}`);
        }
      }
      
      // Delete ticket logs channel
      if (settings?.ticket_logs_channel_id) {
        const ticketLogsChannel = await interaction.guild!.channels.fetch(settings.ticket_logs_channel_id).catch(() => null);
        if (ticketLogsChannel) {
          await ticketLogsChannel.delete().catch(error => {
            logError('Server Cleanup', `Error deleting ticket logs channel: ${error}`);
          });
          deletedItems.push(`Channel: #${ticketLogsChannel.name}`);
        }
      }
    }
    
    // Delete log channels and category if requested
    if (deleteLogs || deleteAll) {
      // Delete log channels
      const logChannelIds = [
        settings?.log_channel_id,
        settings?.mod_log_channel_id,
        settings?.message_log_channel_id,
        settings?.member_log_channel_id,
        settings?.server_log_channel_id
      ].filter(Boolean);
      
      for (const channelId of logChannelIds) {
        if (!channelId) continue;
        
        const logChannel = await interaction.guild!.channels.fetch(channelId).catch(() => null);
        if (logChannel) {
          await logChannel.delete().catch(error => {
            logError('Server Cleanup', `Error deleting log channel: ${error}`);
          });
          deletedItems.push(`Channel: #${logChannel.name}`);
        }
      }
      
      // Find and delete logs category
      const logsCategory = interaction.guild!.channels.cache.find(
        channel => channel.type === ChannelType.GuildCategory && channel.name.toUpperCase() === 'LOGS'
      ) as CategoryChannel | undefined;
      
      if (logsCategory) {
        // Delete any remaining channels in the category
        const logsCategoryChannels = interaction.guild!.channels.cache.filter(
          channel => channel.parentId === logsCategory.id
        );
        
        for (const [, channel] of logsCategoryChannels) {
          await channel.delete().catch(error => {
            logError('Server Cleanup', `Error deleting channel in logs category: ${error}`);
          });
          deletedItems.push(`Channel: #${channel.name}`);
        }
        
        // Delete the category itself
        await logsCategory.delete().catch(error => {
          logError('Server Cleanup', `Error deleting logs category: ${error}`);
        });
        deletedItems.push('Category: Logs');
      }
    }
    
    // Delete welcome channel if requested
    if (deleteWelcome || deleteAll) {
      if (settings?.welcome_channel_id) {
        const welcomeChannel = await interaction.guild!.channels.fetch(settings.welcome_channel_id).catch(() => null);
        if (welcomeChannel) {
          await welcomeChannel.delete().catch(error => {
            logError('Server Cleanup', `Error deleting welcome channel: ${error}`);
          });
          deletedItems.push(`Channel: #${welcomeChannel.name}`);
        }
      }
    }
    
    // Reset server settings if requested
    if (resetSettings) {
      // Create a new empty settings object
      const newSettings = {};
      
      // Update settings in the database
      await settingsManager.updateSettings(interaction.guildId!, newSettings);
      
      deletedItems.push('Server settings reset');
    }
    
    // Create response embed
    const embed = new EmbedBuilder()
      .setTitle(`🧹 ${t('settings.server_cleanup', language) || 'Server Cleanup'}`)
      .setColor(Colors.SUCCESS)
      .setDescription(deletedItems.length > 0 
        ? `${t('settings.cleanup_success', language) || 'Successfully cleaned up the following items:'}\n\n${deletedItems.map(item => `• ${item}`).join('\n')}`
        : t('settings.nothing_to_cleanup', language) || 'No items were selected for cleanup.')
      .setFooter({ text: t('general.footer', language) });
    
    // Send response - wrap in try/catch to handle potential interaction timeout
    try {
      await interaction.editReply({ embeds: [embed] });
      logInfo('Server Cleanup', `Cleaned up server setup for ${interaction.guild!.name}`);
    } catch (replyError: any) {
      // Check if this is an Unknown Message error (interaction expired)
      if (replyError.code === 10008) {
        logInfo('Server Cleanup', `Interaction expired before cleanup completed for ${interaction.guild!.name}, but cleanup was successful`);
      } else {
        // Log other errors but don't crash
        logError('Server Cleanup', `Error sending completion message: ${replyError}`);
      }
    }
  } catch (error) {
    logError('Server Cleanup', `Error cleaning up server: ${error}`);
    
    try {
      // Get the guild's language preference
      const language = await getContextLanguage(interaction.guildId!);
      
      // Format the current time for the footer (using Israeli format)
      const now = new Date();
      const timeString = `${now.getHours()}:${now.getMinutes().toString().padStart(2, '0')}`;
      
      // Create error embed with proper formatting
      const errorEmbed = new EmbedBuilder()
        .setColor(Colors.ERROR)
        .setTitle('❌ Server Cleanup Error')
        .setDescription(t('settings.cleanup_error', language) || 'An error occurred while cleaning up the server.')
        .setFooter({ text: `Coded by IdanMR • Today at ${timeString}` });
      
      // Send error message - wrapped in try/catch to handle potential interaction timeout
      await interaction.editReply({ embeds: [errorEmbed] });
    } catch (replyError: any) {
      // If we can't reply (interaction expired), just log it
      if (replyError.code === 10008) {
        logInfo('Server Cleanup', 'Interaction expired before error message could be sent');
      } else {
        logError('Server Cleanup', `Error sending error message: ${replyError}`);
      }
    }
  }
}
