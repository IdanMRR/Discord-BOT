import { SlashCommandBuilder } from '@discordjs/builders';
import { 
  ChatInputCommandInteraction, 
  EmbedBuilder, 
  PermissionFlagsBits, 
  MessageFlags,
  TextChannel,
  ChannelType
} from 'discord.js';
import { Colors } from '../../utils/embeds';
import { db } from '../../database/sqlite';
import { logCommandUsage } from '../../utils/command-logger';

interface LoggingSettings {
  id: number;
  guild_id: string;
  message_delete_logging: number;
  message_edit_logging: number;
  command_logging: number;
  dm_logging: number;
  log_channel_id?: string;
  message_log_channel_id?: string;
  command_log_channel_id?: string;
  dm_log_channel_id?: string;
  created_at: string;
  updated_at: string;
}

export const data = new SlashCommandBuilder()
  .setName('logging-config')
  .setDescription('Configure message and command logging settings')
  .addSubcommand(subcommand =>
    subcommand
      .setName('toggle')
      .setDescription('Toggle specific logging features on/off')
      .addStringOption(option =>
        option.setName('feature')
          .setDescription('Logging feature to toggle')
          .setRequired(true)
          .addChoices(
            { name: 'Message Deletions', value: 'message_delete' },
            { name: 'Message Edits', value: 'message_edit' },
            { name: 'Command Usage', value: 'command' },
            { name: 'Direct Messages', value: 'dm' }
          ))
      .addBooleanOption(option =>
        option.setName('enabled')
          .setDescription('Enable or disable this feature')
          .setRequired(true)))
  .addSubcommand(subcommand =>
    subcommand
      .setName('channels')
      .setDescription('Set log channels for different types of logs')
      .addChannelOption(option =>
        option.setName('message-channel')
          .setDescription('Channel for message delete/edit logs')
          .setRequired(false))
      .addChannelOption(option =>
        option.setName('command-channel')
          .setDescription('Channel for command usage logs')
          .setRequired(false))
      .addChannelOption(option =>
        option.setName('dm-channel')
          .setDescription('Channel for DM logs')
          .setRequired(false)))
  .addSubcommand(subcommand =>
    subcommand
      .setName('status')
      .setDescription('View current logging configuration'))
  .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild);

// Helper function to get logging settings
function getLoggingSettings(guildId: string): LoggingSettings | null {
  try {
    const stmt = db.prepare('SELECT * FROM logging_settings WHERE guild_id = ?');
    return stmt.get(guildId) as LoggingSettings | undefined || null;
  } catch (error) {
    logError('Logging Config', `Error getting settings: ${error}`);
    return null;
  }
}

// Helper function to ensure logging settings exist
function ensureLoggingSettings(guildId: string): LoggingSettings | null {
  try {
    const existing = getLoggingSettings(guildId);
    if (existing) return existing;
    
    const stmt = db.prepare(`
      INSERT INTO logging_settings (guild_id, message_delete_logging, message_edit_logging, command_logging, dm_logging)
      VALUES (?, 1, 1, 1, 1)
    `);
    stmt.run(guildId);
    
    return getLoggingSettings(guildId);
  } catch (error) {
    logError('Logging Config', `Error ensuring settings: ${error}`);
    return null;
  }
}

// Helper function to update setting
function updateLoggingSetting(guildId: string, field: string, value: any) {
  try {
    ensureLoggingSettings(guildId);
    const stmt = db.prepare(`
      UPDATE logging_settings 
      SET ${field} = ?, updated_at = CURRENT_TIMESTAMP 
      WHERE guild_id = ?
    `);
    stmt.run(value, guildId);
    return true;
  } catch (error) {
    logError('Logging Config', `Error updating setting: ${error}`);
    return false;
  }
}

export async function execute(interaction: ChatInputCommandInteraction) {
  try {
    await interaction.deferReply({ flags: MessageFlags.Ephemeral });

    if (!interaction.guildId) {
      await interaction.editReply('This command can only be used in a server.');
      return;
    }

    const subcommand = interaction.options.getSubcommand();

    switch (subcommand) {
      case 'toggle': {
        const feature = interaction.options.getString('feature', true);
        const enabled = interaction.options.getBoolean('enabled', true);
        
        const fieldMap: Record<string, string> = {
          'message_delete': 'message_delete_logging',
          'message_edit': 'message_edit_logging',
          'command': 'command_logging',
          'dm': 'dm_logging'
        };
        
        const field = fieldMap[feature];
        if (!field) {
          await interaction.editReply('Invalid feature specified.');
          return;
        }
        
        const success = updateLoggingSetting(interaction.guildId, field, enabled ? 1 : 0);
        
        if (!success) {
          await interaction.editReply('Failed to update logging setting.');
          return;
        }
        
        const featureNames: Record<string, string> = {
          'message_delete': 'Message Deletion Logging',
          'message_edit': 'Message Edit Logging',
          'command': 'Command Usage Logging',
          'dm': 'Direct Message Logging'
        };
        
        const embed = new EmbedBuilder()
          .setColor(enabled ? Colors.SUCCESS : Colors.WARNING)
          .setTitle('🔧 Logging Configuration Updated')
          .setDescription(`**${featureNames[feature]}** has been ${enabled ? 'enabled' : 'disabled'}.`)
          .addFields(
            { name: 'Feature', value: featureNames[feature], inline: true },
            { name: 'Status', value: enabled ? '✅ Enabled' : '❌ Disabled', inline: true },
            { name: 'Updated By', value: `<@${interaction.user.id}>`, inline: true }
          )
          .setTimestamp();
        
        await interaction.editReply({ embeds: [embed] });
        
        logInfo('Logging Config', `${featureNames[feature]} ${enabled ? 'enabled' : 'disabled'} in ${interaction.guild?.name} by ${interaction.user.tag}`);
        break;
      }
      
      case 'channels': {
        const messageChannel = interaction.options.getChannel('message-channel') as TextChannel;
        const commandChannel = interaction.options.getChannel('command-channel') as TextChannel;
        const dmChannel = interaction.options.getChannel('dm-channel') as TextChannel;
        
        if (!messageChannel && !commandChannel && !dmChannel) {
          await interaction.editReply('Please specify at least one channel to configure.');
          return;
        }
        
        ensureLoggingSettings(interaction.guildId);
        
        const updates: string[] = [];
        
        if (messageChannel) {
          if (messageChannel.type !== ChannelType.GuildText) {
            await interaction.editReply('Message log channel must be a text channel.');
            return;
          }
          updateLoggingSetting(interaction.guildId, 'message_log_channel_id', messageChannel.id);
          updates.push(`Message logs: <#${messageChannel.id}>`);
        }
        
        if (commandChannel) {
          if (commandChannel.type !== ChannelType.GuildText) {
            await interaction.editReply('Command log channel must be a text channel.');
            return;
          }
          updateLoggingSetting(interaction.guildId, 'command_log_channel_id', commandChannel.id);
          updates.push(`Command logs: <#${commandChannel.id}>`);
        }
        
        if (dmChannel) {
          if (dmChannel.type !== ChannelType.GuildText) {
            await interaction.editReply('DM log channel must be a text channel.');
            return;
          }
          updateLoggingSetting(interaction.guildId, 'dm_log_channel_id', dmChannel.id);
          updates.push(`DM logs: <#${dmChannel.id}>`);
        }
        
        const embed = new EmbedBuilder()
          .setColor(Colors.SUCCESS)
          .setTitle('📝 Log Channels Updated')
          .setDescription('The following log channels have been configured:')
          .addFields(
            { name: 'Channels', value: updates.join('\n'), inline: false },
            { name: 'Updated By', value: `<@${interaction.user.id}>`, inline: true }
          )
          .setTimestamp();
        
        await interaction.editReply({ embeds: [embed] });
        break;
      }
      
      case 'status': {
        const settings = ensureLoggingSettings(interaction.guildId);
        
        if (!settings) {
          await interaction.editReply('Failed to retrieve logging settings.');
          return;
        }
        
        const embed = new EmbedBuilder()
          .setColor(Colors.INFO)
          .setTitle('📊 Current Logging Configuration')
          .setDescription('Here are the current logging settings for this server:')
          .addFields(
            { 
              name: '🗑️ Message Deletion Logging', 
              value: settings.message_delete_logging ? '✅ Enabled' : '❌ Disabled', 
              inline: true 
            },
            { 
              name: '✏️ Message Edit Logging', 
              value: settings.message_edit_logging ? '✅ Enabled' : '❌ Disabled', 
              inline: true 
            },
            { 
              name: '⚡ Command Logging', 
              value: settings.command_logging ? '✅ Enabled' : '❌ Disabled', 
              inline: true 
            },
            { 
              name: '💬 DM Logging', 
              value: settings.dm_logging ? '✅ Enabled' : '❌ Disabled', 
              inline: true 
            }
          );
        
        // Add channel information
        const channels: string[] = [];
        if (settings.message_log_channel_id) {
          channels.push(`Message logs: <#${settings.message_log_channel_id}>`);
        }
        if (settings.command_log_channel_id) {
          channels.push(`Command logs: <#${settings.command_log_channel_id}>`);
        }
        if (settings.dm_log_channel_id) {
          channels.push(`DM logs: <#${settings.dm_log_channel_id}>`);
        }
        
        if (channels.length > 0) {
          embed.addFields({ name: '📺 Log Channels', value: channels.join('\n'), inline: false });
        } else {
          embed.addFields({ name: '📺 Log Channels', value: 'No specific channels configured (using default log channel)', inline: false });
        }
        
        embed.addFields({ 
          name: 'ℹ️ Information', 
          value: 'Use `/logging-config toggle` to enable/disable features\nUse `/logging-config channels` to set log channels', 
          inline: false 
        });
        
        await interaction.editReply({ embeds: [embed] });
        break;
      }
    }
    
      } catch (error) {
    logError('Logging Config', error);
    
    try {
      await logCommandUsage({
        guild: interaction.guild!,
        user: interaction.user,
        command: 'logging-config',
        options: { error: error instanceof Error ? error.message : String(error) },
        channel: interaction.channel,
        success: false
      });
    } catch (logError) {
      // Silent fail for logging
    }
    
    try {
      if (interaction.deferred) {
        await interaction.editReply('An error occurred while configuring logging settings.');
      } else {
        await interaction.reply({ 
          content: 'An error occurred while configuring logging settings.', 
          flags: MessageFlags.Ephemeral 
        });
      }
    } catch (replyError) {
      logError('Logging Config', replyError);
    }
  }
}