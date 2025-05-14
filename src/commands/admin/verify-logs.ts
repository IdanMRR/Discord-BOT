import { SlashCommandBuilder, ChatInputCommandInteraction, PermissionFlagsBits, EmbedBuilder, ChannelType, TextChannel, CategoryChannel } from 'discord.js';
import { settingsManager } from '../../utils/settings';
import { logInfo, logError, logWarning } from '../../utils/logger';
import { Colors } from '../../utils/embeds';
import { getVerificationSettings } from '../../handlers/verification/verification-config';

export const data = new SlashCommandBuilder()
  .setName('verify-logs')
  .setDescription('Verify and fix log channel settings')
  .setDefaultMemberPermissions(PermissionFlagsBits.Administrator)
  .addSubcommand(subcommand =>
    subcommand
      .setName('check')
      .setDescription('Check the status of log channels')
  )
  .addSubcommand(subcommand =>
    subcommand
      .setName('fix')
      .setDescription('Automatically fix log channel issues')
  )
  .addSubcommand(subcommand =>
    subcommand
      .setName('setup')
      .setDescription('Set up missing log channels')
  );

export async function execute(interaction: ChatInputCommandInteraction): Promise<void> {
  try {
    const subcommand = interaction.options.getSubcommand();
    
    switch (subcommand) {
      case 'check':
        await checkLogChannels(interaction);
        break;
      case 'fix':
        await fixLogChannels(interaction);
        break;
      case 'setup':
        await setupLogChannels(interaction);
        break;
    }
  } catch (error) {
    logError('Verify Logs', `Error executing command: ${error}`);
    
    try {
      if (interaction.deferred) {
        await interaction.editReply('An error occurred while verifying log channels. Please try again later.');
      } else {
        await interaction.reply({ 
          content: 'An error occurred while verifying log channels. Please try again later.',
          ephemeral: true
        });
      }
    } catch (replyError) {
      logError('Verify Logs', `Failed to send error message: ${replyError}`);
    }
  }
}

/**
 * Check log channels status
 */
async function checkLogChannels(interaction: ChatInputCommandInteraction): Promise<void> {
  await interaction.deferReply();
  
  // Get server settings
  const serverSettings = await settingsManager.getSettings(interaction.guildId!);
  
  // Get verification settings
  const verificationSettings = await getVerificationSettings(interaction.guildId!);
  
  // Create response embed
  const embed = new EmbedBuilder()
    .setColor(Colors.INFO)
    .setTitle('Log Channels Status')
    .setDescription('Current status of log channels in your server:')
    .setTimestamp()
    .setFooter({ text: 'Made by Soggra.' });
  
  // Check settings
  const logChannels = [
    { name: 'General Logs', id: serverSettings.log_channel_id, working: false },
    { name: 'Mod Logs', id: serverSettings.mod_log_channel_id, working: false },
    { name: 'Member Logs', id: serverSettings.member_log_channel_id, working: false },
    { name: 'Message Logs', id: serverSettings.message_log_channel_id, working: false },
    { name: 'Server Logs', id: serverSettings.server_log_channel_id, working: false }
  ];
  
  // Add verification logs if applicable
  if (verificationSettings) {
    logChannels.push({ name: 'Verification Logs', id: verificationSettings.log_channel_id, working: false });
  }
  
  // Add ticket logs if applicable
  if (serverSettings.ticket_logs_channel_id) {
    logChannels.push({ name: 'Ticket Logs', id: serverSettings.ticket_logs_channel_id, working: false });
  }
  
  // Check each channel
  for (const channel of logChannels) {
    if (channel.id) {
      try {
        const fetchedChannel = await interaction.guild!.channels.fetch(channel.id);
        if (fetchedChannel && fetchedChannel.type === ChannelType.GuildText) {
          channel.working = true;
          embed.addFields([{
            name: `✅ ${channel.name}`,
            value: `Channel: <#${channel.id}>\nStatus: Working`,
            inline: true
          }]);
        } else {
          embed.addFields([{
            name: `❌ ${channel.name}`,
            value: `Channel ID: ${channel.id}\nStatus: Not a text channel`,
            inline: true
          }]);
        }
      } catch (error) {
        embed.addFields([{
          name: `❌ ${channel.name}`,
          value: `Channel ID: ${channel.id}\nStatus: Not found/Error`,
          inline: true
        }]);
      }
    } else {
      embed.addFields([{
        name: `⚠️ ${channel.name}`,
        value: `Status: Not configured`,
        inline: true
      }]);
    }
  }
  
  // Add fix instructions
  embed.addFields([{
    name: 'Need to fix channels?', 
    value: 'Use `/verify-logs fix` to automatically repair broken channels or `/verify-logs setup` to create missing ones.'
  }]);
  
  await interaction.editReply({ embeds: [embed] });
}

/**
 * Fix log channels
 */
async function fixLogChannels(interaction: ChatInputCommandInteraction): Promise<void> {
  await interaction.deferReply();
  
  // Get server settings
  const serverSettings = await settingsManager.getSettings(interaction.guildId!);
  
  // Get verification settings
  const verificationSettings = await getVerificationSettings(interaction.guildId!);
  
  // Create response embed
  const embed = new EmbedBuilder()
    .setColor(Colors.INFO)
    .setTitle('Log Channels Fix Results')
    .setDescription('Results of fixing log channels in your server:')
    .setTimestamp()
    .setFooter({ text: 'Made by Soggra.' });
  
  // Track fixes
  const fixedChannels: string[] = [];
  const failedChannels: string[] = [];
  let fixCount = 0;
  
  // Define all channels to check
  const logChannels = [
    { name: 'General Logs', setting: 'log_channel_id', id: serverSettings.log_channel_id },
    { name: 'Mod Logs', setting: 'mod_log_channel_id', id: serverSettings.mod_log_channel_id },
    { name: 'Member Logs', setting: 'member_log_channel_id', id: serverSettings.member_log_channel_id },
    { name: 'Message Logs', setting: 'message_log_channel_id', id: serverSettings.message_log_channel_id },
    { name: 'Server Logs', setting: 'server_log_channel_id', id: serverSettings.server_log_channel_id }
  ];
  
  // Add ticket logs if applicable
  if (serverSettings.ticket_logs_channel_id) {
    logChannels.push({ name: 'Ticket Logs', setting: 'ticket_logs_channel_id', id: serverSettings.ticket_logs_channel_id });
  }
  
  // Check each channel
  const workingChannels: Array<{ name: string, setting: string, id: string }> = [];
  
  // First identify which channels work
  for (const channel of logChannels) {
    if (channel.id) {
      try {
        const fetchedChannel = await interaction.guild!.channels.fetch(channel.id);
        if (fetchedChannel && fetchedChannel.type === ChannelType.GuildText) {
          workingChannels.push(channel as { name: string, setting: string, id: string });
        } else {
          // Channel exists but isn't a text channel
          failedChannels.push(channel.name);
        }
      } catch (error) {
        // Channel doesn't exist, try to fix it
        if (channel.id) { // Extra check to satisfy TypeScript
          const result = await tryFixChannel(interaction, 
            { name: channel.name, setting: channel.setting, id: channel.id }, 
            serverSettings, 
            workingChannels);
            
          if (result.fixed) {
            fixedChannels.push(channel.name);
            fixCount++;
          } else {
            failedChannels.push(channel.name);
          }
        }
      }
    }
  }
  
  // Special handling for verification logs
  if (verificationSettings?.log_channel_id) {
    try {
      const verificationLogChannel = await interaction.guild!.channels.fetch(verificationSettings.log_channel_id);
      if (!(verificationLogChannel && verificationLogChannel.type === ChannelType.GuildText)) {
        // Try to fix verification logs
        if (workingChannels.length > 0) {
          // Choose member logs, mod logs, or any other working channel
          const memberLogs = workingChannels.find(c => c.setting === 'member_log_channel_id');
          const modLogs = workingChannels.find(c => c.setting === 'mod_log_channel_id');
          const anyChannel = workingChannels[0];
          
          const channelToUse = memberLogs || modLogs || anyChannel;
          
          // Update verification settings
          verificationSettings.log_channel_id = channelToUse.id;
          await saveVerificationSettings(interaction.guildId!, verificationSettings);
          
          fixedChannels.push('Verification Logs');
          fixCount++;
        } else {
          failedChannels.push('Verification Logs');
        }
      }
    } catch (error) {
      // Channel doesn't exist, try to fix
      if (workingChannels.length > 0) {
        // Choose member logs, mod logs, or any other working channel
        const memberLogs = workingChannels.find(c => c.setting === 'member_log_channel_id');
        const modLogs = workingChannels.find(c => c.setting === 'mod_log_channel_id');
        const anyChannel = workingChannels[0];
        
        const channelToUse = memberLogs || modLogs || anyChannel;
        
        // Update verification settings
        verificationSettings.log_channel_id = channelToUse.id;
        await saveVerificationSettings(interaction.guildId!, verificationSettings);
        
        fixedChannels.push('Verification Logs');
        fixCount++;
      } else {
        failedChannels.push('Verification Logs');
      }
    }
  }
  
  // Build response
  if (fixCount > 0) {
    embed.setColor(Colors.SUCCESS);
    embed.setDescription(`Fixed ${fixCount} log channel(s) in your server.`);
    
    // Add fixed channels
    if (fixedChannels.length > 0) {
      embed.addFields([{
        name: '✅ Fixed Channels',
        value: fixedChannels.map(name => `- ${name}`).join('\n')
      }]);
    }
    
    // Add failed channels
    if (failedChannels.length > 0) {
      embed.addFields([{
        name: '❌ Couldn\'t Fix',
        value: failedChannels.map(name => `- ${name}`).join('\n') + '\n\nUse `/verify-logs setup` to create new channels.'
      }]);
    }
  } else {
    if (failedChannels.length > 0) {
      embed.setColor(Colors.ERROR);
      embed.setDescription('Couldn\'t fix any log channels automatically.');
      
      embed.addFields([{
        name: '❌ Failed Channels',
        value: failedChannels.map(name => `- ${name}`).join('\n') + '\n\nUse `/verify-logs setup` to create new channels.'
      }]);
    } else {
      embed.setColor(Colors.SUCCESS);
      embed.setDescription('All log channels are working properly! No fixes needed.');
    }
  }
  
  await interaction.editReply({ embeds: [embed] });
}

/**
 * Set up missing log channels
 */
async function setupLogChannels(interaction: ChatInputCommandInteraction): Promise<void> {
  await interaction.deferReply();
  
  // Get server settings
  const serverSettings = await settingsManager.getSettings(interaction.guildId!);
  
  // Get verification settings
  const verificationSettings = await getVerificationSettings(interaction.guildId!);
  
  // Create response embed
  const embed = new EmbedBuilder()
    .setColor(Colors.SUCCESS)
    .setTitle('Log Channels Setup')
    .setDescription('Setting up missing log channels...')
    .setTimestamp()
    .setFooter({ text: 'Made by Soggra.' });
  
  // List of channels to create if missing
  const channelsToSetup = [
    { name: 'general-logs', setting: 'log_channel_id', id: serverSettings.log_channel_id, description: 'General server logs' },
    { name: 'mod-logs', setting: 'mod_log_channel_id', id: serverSettings.mod_log_channel_id, description: 'Moderation action logs' },
    { name: 'member-logs', setting: 'member_log_channel_id', id: serverSettings.member_log_channel_id, description: 'Member join/leave logs' },
    { name: 'message-logs', setting: 'message_log_channel_id', id: serverSettings.message_log_channel_id, description: 'Message deletion logs' },
    { name: 'ticket-logs', setting: 'ticket_logs_channel_id', id: serverSettings.ticket_logs_channel_id, description: 'Ticket system logs' }
  ];
  
  // Track new channels
  const createdChannels: string[] = [];
  const updatedSettings: string[] = [];
  
  // Check which category to use
  let logsCategory: CategoryChannel | null = null;
  
  // Look for an existing logs category
  const existingCategory = interaction.guild!.channels.cache.find(
    channel => channel.type === ChannelType.GuildCategory && 
    (channel.name.toLowerCase() === 'logs' || channel.name.toLowerCase() === 'logging')
  ) as CategoryChannel | null;
  
  if (existingCategory) {
    logsCategory = existingCategory;
  } else {
    // Create a logs category
    logsCategory = await interaction.guild!.channels.create({
      name: 'LOGS',
      type: ChannelType.GuildCategory,
      permissionOverwrites: [
        {
          id: interaction.guild!.roles.everyone.id,
          deny: [PermissionFlagsBits.ViewChannel]
        },
        {
          id: interaction.client.user!.id,
          allow: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.SendMessages]
        }
      ]
    });
    
    createdChannels.push('LOGS Category');
  }
  
  // Create missing channels
  for (const channelInfo of channelsToSetup) {
    if (!channelInfo.id) {
      try {
        // Create the channel
        const newChannel = await interaction.guild!.channels.create({
          name: channelInfo.name,
          type: ChannelType.GuildText,
          parent: logsCategory?.id, // Use ID instead of the category object
          topic: channelInfo.description,
          permissionOverwrites: [
            {
              id: interaction.guild!.roles.everyone.id,
              deny: [PermissionFlagsBits.ViewChannel]
            },
            {
              id: interaction.client.user!.id,
              allow: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.SendMessages]
            }
          ]
        });
        
        // Update settings
        const updateObj: Record<string, string> = {};
        updateObj[channelInfo.setting] = newChannel.id;
        await settingsManager.updateSettings(interaction.guildId!, updateObj);
        
        // Track created channel
        createdChannels.push(`#${channelInfo.name}`);
        updatedSettings.push(channelInfo.setting);
        
        // Send welcome message
        const welcomeEmbed = new EmbedBuilder()
          .setColor(Colors.INFO)
          .setTitle(`📋 ${channelInfo.name} Channel`)
          .setDescription(`This channel has been set up for ${channelInfo.description}.`)
          .setFooter({ text: 'Made by Soggra.' });
        
        await newChannel.send({ embeds: [welcomeEmbed] });
      } catch (error) {
        logError('Setup Logs', `Error creating ${channelInfo.name}: ${error}`);
      }
    }
  }
  
  // Update verification logs if needed
  if (verificationSettings && !verificationSettings.log_channel_id) {
    // Use member logs if available, otherwise mod logs
    if (serverSettings.member_log_channel_id) {
      verificationSettings.log_channel_id = serverSettings.member_log_channel_id;
      await saveVerificationSettings(interaction.guildId!, verificationSettings);
      updatedSettings.push('verification_log_channel_id');
    } else if (serverSettings.mod_log_channel_id) {
      verificationSettings.log_channel_id = serverSettings.mod_log_channel_id;
      await saveVerificationSettings(interaction.guildId!, verificationSettings);
      updatedSettings.push('verification_log_channel_id');
    }
  }
  
  // Update response
  if (createdChannels.length > 0) {
    embed.setDescription(`Created ${createdChannels.length} log channels.`);
    
    embed.addFields([{
      name: '✅ Created Channels',
      value: createdChannels.map(name => `- ${name}`).join('\n')
    }]);
    
    embed.addFields([{
      name: '⚙️ Updated Settings',
      value: updatedSettings.map(setting => `- ${setting.replace('_channel_id', '')}`).join('\n')
    }]);
  } else {
    embed.setDescription('All log channels are already set up. No changes were made.');
  }
  
  await interaction.editReply({ embeds: [embed] });
}

/**
 * Try to fix a single log channel
 */
async function tryFixChannel(
  interaction: ChatInputCommandInteraction,
  channel: { name: string, setting: string, id: string },
  serverSettings: any,
  workingChannels: Array<{ name: string, setting: string, id: string }>
): Promise<{ fixed: boolean, newChannelId?: string }> {
  try {
    // First try to find a working substitute
    if (workingChannels.length > 0) {
      // Choose order: member logs > mod logs > any working channel
      const memberLogs = workingChannels.find(c => c.setting === 'member_log_channel_id');
      const modLogs = workingChannels.find(c => c.setting === 'mod_log_channel_id');
      const anyChannel = workingChannels[0];
      
      const channelToUse = memberLogs || modLogs || anyChannel;
      
      // Update settings
      const updateObj: Record<string, string> = {};
      updateObj[channel.setting] = channelToUse.id;
      await settingsManager.updateSettings(interaction.guildId!, updateObj);
      
      return { fixed: true, newChannelId: channelToUse.id };
    }
    
    return { fixed: false };
  } catch (error) {
    logError('Fix Log Channel', `Error fixing ${channel.name}: ${error}`);
    return { fixed: false };
  }
}

/**
 * Save verification settings
 */
async function saveVerificationSettings(guildId: string, settings: any): Promise<boolean> {
  try {
    const { saveVerificationSettings } = require('../../handlers/verification/verification-config');
    return await saveVerificationSettings(guildId, settings);
  } catch (error) {
    logError('Verify Logs', `Error saving verification settings: ${error}`);
    return false;
  }
} 