import { 
  GuildMember, 
  TextChannel, 
  EmbedBuilder, 
  Guild, 
  Message,
  PartialGuildMember,
  Events,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle
} from 'discord.js';
import { Colors } from '../../utils/embeds';
import { logInfo, logError } from '../../utils/logger';
import { client } from '../../index';
import { db } from '../../database/sqlite';

// Configuration for member events
export interface MemberEventConfig {
  enabled: boolean;
  welcome_channel_id?: string;
  leave_channel_id?: string;
  welcome_message?: string;
  leave_message?: string;
  show_member_count: boolean;
}

// Default configuration
const defaultConfig: MemberEventConfig = {
  enabled: true,
  welcome_message: 'Welcome to the server, {user}! We hope you enjoy your stay.',
  leave_message: '{user} has left the server. We hope to see you again soon!',
  show_member_count: true
};

// Map to store guild-specific configurations
const guildConfigs = new Map<string, MemberEventConfig>();

/**
 * Set the configuration for member events in a guild
 * 
 * @param guildId The guild ID
 * @param config The configuration
 */
export function setMemberEventConfig(guildId: string, config: Partial<MemberEventConfig>): void {
  try {
    // First check if we need to create or update
    const existingConfig = getMemberEventConfig(guildId);
    const newConfig = { ...existingConfig, ...config };
    
    // Store in memory cache
    guildConfigs.set(guildId, newConfig);
    
    // Check if server_settings has member_events_config column
    const hasColumn = db.prepare("PRAGMA table_info(server_settings)").all()
      .some((col: any) => col.name === 'member_events_config');
    
    if (!hasColumn) {
      // Add the column if it doesn't exist
      db.prepare('ALTER TABLE server_settings ADD COLUMN member_events_config TEXT').run();
    }
    
    // Update the database
    const stmt = db.prepare(`
      UPDATE server_settings 
      SET member_events_config = ?,
          updated_at = CURRENT_TIMESTAMP
      WHERE guild_id = ?
    `);
    
    // Check if the guild exists in the database
    const guildExists = db.prepare('SELECT 1 FROM server_settings WHERE guild_id = ?').get(guildId);
    
    if (guildExists) {
      // Update existing record
      stmt.run(JSON.stringify(newConfig), guildId);
    } else {
      // Insert new record
      db.prepare(`
        INSERT INTO server_settings (guild_id, member_events_config, created_at, updated_at)
        VALUES (?, ?, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
      `).run(guildId, JSON.stringify(newConfig));
    }
    
    logInfo('MemberEvents', `Updated member event configuration for guild ${guildId}`);
  } catch (error) {
    logError('MemberEvents', `Error updating member event configuration: ${error}`);
  }
}

/**
 * Get the configuration for member events in a guild
 * 
 * @param guildId The guild ID
 * @returns The configuration
 */
export function getMemberEventConfig(guildId: string): MemberEventConfig {
  try {
    // First check the in-memory cache
    if (guildConfigs.has(guildId)) {
      return guildConfigs.get(guildId)!;
    }
    
    // Check if the column exists
    const hasColumn = db.prepare("PRAGMA table_info(server_settings)").all()
      .some((col: any) => col.name === 'member_events_config');
    
    if (!hasColumn) {
      return { ...defaultConfig };
    }
    
    // Get from database
    const stmt = db.prepare(`
      SELECT member_events_config FROM server_settings WHERE guild_id = ?
    `);
    
    const result = stmt.get(guildId) as { member_events_config: string } | undefined;
    
    if (result && result.member_events_config) {
      try {
        const config = JSON.parse(result.member_events_config) as MemberEventConfig;
        // Store in memory cache
        guildConfigs.set(guildId, config);
        return config;
      } catch (parseError) {
        logError('MemberEvents', `Error parsing member event configuration: ${parseError}`);
      }
    }
    
    // Return default if not found or error
    return { ...defaultConfig };
  } catch (error) {
    logError('MemberEvents', `Error getting member event configuration: ${error}`);
    return { ...defaultConfig };
  }
}

/**
 * Handle the welcome message for a new member
 * 
 * @param member The member that joined
 */
async function handleMemberJoin(member: GuildMember): Promise<void> {
  try {
    const { guild } = member;
    logInfo('MemberEvents', `Member joined: ${member.user.tag} (${member.id}) in guild ${guild.name} (${guild.id})`);
    
    const config = getMemberEventConfig(guild.id);
    
    if (!config.enabled) {
      logInfo('MemberEvents', `Welcome messages disabled for guild ${guild.id}`);
      return;
    }
    
    // Get server settings to check if invite tracking is enabled
    const { settingsManager } = await import('../../utils/settings');
    const serverSettings = await settingsManager.getSettings(guild.id);
    
    // If member_log_channel_id exists, assume the invite tracker is handling the detailed logs
    // so we'll only send the public welcome message, not the logs message
    const inviteTrackingEnabled = serverSettings && serverSettings.member_log_channel_id;
    
    // Only process welcome channel message - don't send to member logs
    if (config.welcome_channel_id && config.welcome_message) {
      try {
        logInfo('MemberEvents', `Fetching welcome channel ${config.welcome_channel_id} for guild ${guild.id}`);
        const welcomeChannel = await guild.channels.fetch(config.welcome_channel_id) as TextChannel;
        
        if (!welcomeChannel) {
          logError('MemberEvents', `Welcome channel ${config.welcome_channel_id} not found in guild ${guild.id}`);
        } else if (!welcomeChannel.isTextBased()) {
          logError('MemberEvents', `Welcome channel ${config.welcome_channel_id} is not a text channel in guild ${guild.id}`);
        } else {
          const memberCount = guild.memberCount;
          
          logInfo('MemberEvents', `Creating welcome embed for ${member.user.tag} in guild ${guild.name}`);
          
          // Create welcome embed - RESTORED TO ORIGINAL FORMAT
          const welcomeEmbed = new EmbedBuilder()
            .setColor(Colors.SUCCESS)
            .setTitle('Joined Member')
            .setDescription(`Welcome <@${member.id}> to- ${guild.name}`)
            .setThumbnail(member.user.displayAvatarURL())
            .setFooter({ text: `Coding API - Welcome System • Made By Soggra • Today at ${new Date().toLocaleTimeString()}` })
            .setTimestamp();
          
          // Send welcome message with embed
          const welcomeMessage = await welcomeChannel.send({
            embeds: [welcomeEmbed]
          });
          
          // Add member count as a disabled button styled like a reaction
          const memberCountButton = new ActionRowBuilder<ButtonBuilder>().addComponents(
            new ButtonBuilder()
              .setCustomId('member_count')
              .setLabel(`👑 YOU ARE OUR ${memberCount}TH MEMBER!`)
              .setStyle(ButtonStyle.Primary)
              .setDisabled(true)
          );
          await welcomeChannel.send({
            components: [memberCountButton]
          });
          
          logInfo('MemberEvents', `Sent welcome message for ${member.user.tag} in guild ${guild.name}`);
        }
      } catch (error) {
        logError('MemberEvents', `Error sending welcome message: ${error}`);
      }
    }
  } catch (error) {
    logError('MemberEvents', `Error handling member join: ${error}`);
  }
}

/**
 * Handle the leave message for a member
 * 
 * @param member The member that left
 */
async function handleMemberLeave(member: GuildMember | PartialGuildMember): Promise<void> {
  try {
    const { guild } = member;
    const config = getMemberEventConfig(guild.id);
    
    if (!config.enabled) {
      return;
    }
    
    // Get server settings to check if invite tracking is enabled
    const { settingsManager } = await import('../../utils/settings');
    const serverSettings = await settingsManager.getSettings(guild.id);
    
    // If member_log_channel_id exists, assume the invite tracker is handling the detailed logs
    // so we'll only send the public leave message, not the logs message
    const inviteTrackingEnabled = serverSettings && serverSettings.member_log_channel_id;
    
    // Only process leave channel message
    if (config.leave_channel_id && config.leave_message) {
      try {
        const leaveChannel = await guild.channels.fetch(config.leave_channel_id) as TextChannel;
        
        if (!leaveChannel || !leaveChannel.isTextBased()) {
          logError('MemberEvents', `Leave channel ${config.leave_channel_id} not found or not a text channel in guild ${guild.id}`);
        } else {
          const memberCount = guild.memberCount;
          
          // Get the user tag if available (for partial members)
          const userTag = member.user?.tag || 'Unknown User';
          
          const leaveEmbed = new EmbedBuilder()
            .setColor(Colors.ERROR)
            .setTitle('👋 Member Left')
            .setDescription(config.leave_message.replace('{user}', member.user ? `<@${member.id}>` : userTag))
            .setThumbnail(member.user?.displayAvatarURL() || null)
            .addFields([
              { name: 'Member Count', value: `${memberCount} members`, inline: true },
              { name: 'Joined Server', value: member.joinedAt ? `<t:${Math.floor(member.joinedAt.getTime() / 1000)}:R>` : 'Unknown', inline: true }
            ])
            .setFooter({ text: `Coding API - Leave System • Made By Soggra • Today at ${new Date().toLocaleTimeString()}` })
            .setTimestamp();
          
          await leaveChannel.send({
            embeds: [leaveEmbed]
          });
          
          logInfo('MemberEvents', `Sent leave message for ${userTag} in guild ${guild.name}`);
        }
      } catch (error) {
        logError('MemberEvents', `Error sending leave message: ${error}`);
      }
    }
  } catch (error) {
    logError('MemberEvents', `Error sending leave message: ${error}`);
  }
}

/**
 * Show the member count in a reaction to a message
 * 
 * @param message The message to react to
 */
async function showMemberCount(message: Message): Promise<void> {
  try {
    const { guild } = message;
    
    if (!guild) return;
    
    const config = getMemberEventConfig(guild.id);
    
    if (!config.enabled || !config.show_member_count) {
      return;
    }
    
    // Only respond to non-bot messages with some text content
    if (message.author.bot || !message.content.trim()) {
      return;
    }
    
    // Randomly decide to show the count (10% chance) to avoid spamming
    if (Math.random() > 0.1) {
      return;
    }
    
    const memberCount = guild.memberCount;
    
    // Create a simple embed with the member count
    const countEmbed = new EmbedBuilder()
      .setColor(Colors.PRIMARY)
      .setDescription(`**Server Stats:** This server has **${memberCount}** members.`)
      .setFooter({ text: `• Made By Soggra` });
    
    await message.reply({
      embeds: [countEmbed]
    });
    
    logInfo('MemberEvents', `Showed member count in guild ${guild.name}`);
  } catch (error) {
    logError('MemberEvents', `Error showing member count: ${error}`);
  }
}

/**
 * Initialize event listeners for member events
 */
export function initializeMemberEvents(): void {
  try {
    // Load all configurations from the database
    loadAllConfigurations();
    
    // Listen for new members - but ONLY if invite tracking isn't active
    // since invite tracker will handle the detailed logs
    client.on(Events.GuildMemberAdd, handleMemberJoin);
    
    // Listen for members leaving - but ONLY if invite tracking isn't active 
    // since invite tracker will handle the detailed logs
    client.on(Events.GuildMemberRemove, handleMemberLeave);
    
    // Listen for messages to show member count
    client.on(Events.MessageCreate, showMemberCount);
    
    logInfo('MemberEvents', 'Member event handlers initialized');
  } catch (error) {
    logError('MemberEvents', `Error initializing member events: ${error}`);
  }
}

/**
 * Load all member event configurations from the database
 */
function loadAllConfigurations(): void {
  try {
    // Check if the column exists
    const hasColumn = db.prepare("PRAGMA table_info(server_settings)").all()
      .some((col: any) => col.name === 'member_events_config');
    
    if (!hasColumn) {
      logInfo('MemberEvents', 'No member_events_config column found, skipping configuration loading');
      return;
    }
    
    // Get all configurations
    const stmt = db.prepare(`
      SELECT guild_id, member_events_config FROM server_settings WHERE member_events_config IS NOT NULL
    `);
    
    const results = stmt.all() as { guild_id: string, member_events_config: string }[];
    
    for (const result of results) {
      try {
        if (result.member_events_config) {
          const config = JSON.parse(result.member_events_config) as MemberEventConfig;
          guildConfigs.set(result.guild_id, config);
          logInfo('MemberEvents', `Loaded configuration for guild ${result.guild_id}`);
        }
      } catch (parseError) {
        logError('MemberEvents', `Error parsing member event configuration for guild ${result.guild_id}: ${parseError}`);
      }
    }
    
    logInfo('MemberEvents', `Loaded ${guildConfigs.size} guild configurations`);
  } catch (error) {
    logError('MemberEvents', `Error loading member event configurations: ${error}`);
  }
}

// Command to set the welcome and leave channels
export async function setupMemberEvents(
  guildId: string, 
  welcomeChannelId?: string, 
  leaveChannelId?: string, 
  welcomeMessage?: string,
  leaveMessage?: string,
  showMemberCount: boolean = true
): Promise<boolean> {
  try {
    // Set default messages if none provided
    const defaultWelcomeMessage = 'Welcome to the server, {user}! We hope you enjoy your stay.';
    const defaultLeaveMessage = '{user} has left the server. We hope to see you again soon!';
    
    // Set the configuration
    setMemberEventConfig(guildId, {
      enabled: true,
      welcome_channel_id: welcomeChannelId,
      leave_channel_id: leaveChannelId,
      welcome_message: welcomeMessage || defaultWelcomeMessage,
      leave_message: leaveMessage || defaultLeaveMessage,
      show_member_count: showMemberCount
    });
    
    logInfo('MemberEvents', `Member events setup complete for guild ${guildId} with welcome channel ${welcomeChannelId}`);
    return true;
  } catch (error) {
    logError('MemberEvents', `Error setting up member events: ${error}`);
    return false;
  }
}