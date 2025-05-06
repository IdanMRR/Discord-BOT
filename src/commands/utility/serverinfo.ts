import { SlashCommandBuilder, ChatInputCommandInteraction, EmbedBuilder, Guild } from 'discord.js';
import { createInfoEmbed } from '../../utils/embeds';

module.exports = {
  data: new SlashCommandBuilder()
    .setName('serverinfo')
    .setDescription('Display detailed information about the server'),
  
  async execute(interaction: ChatInputCommandInteraction) {
    const guild = interaction.guild;
    
    if (!guild) {
      await interaction.reply('This command can only be used in a server.');
      return;
    }
    
    // Fetch the guild to get the most up-to-date information
    const fetchedGuild = await interaction.client.guilds.fetch(guild.id);
    
    // Create a detailed server info embed
    const serverInfoEmbed = new EmbedBuilder()
      .setTitle(`${guild.name} - Server Information`)
      .setColor('#5865F2');
      
    // Only set thumbnail if the server has an icon
    const iconURL = guild.iconURL({ size: 256 });
    if (iconURL) {
      serverInfoEmbed.setThumbnail(iconURL);
    }
    
    // Only set banner if the server has one
    const bannerURL = guild.bannerURL({ size: 1024 });
    if (bannerURL) {
      serverInfoEmbed.setImage(bannerURL);
    }
    
    serverInfoEmbed.addFields([
      { name: '📋 General Information', value: getGeneralInfo(fetchedGuild) },
      { name: '👥 Member Statistics', value: getMemberStats(fetchedGuild) },
      { name: '📊 Channel Statistics', value: getChannelStats(fetchedGuild) },
      { name: '🔐 Security Level', value: getSecurityInfo(fetchedGuild) },
      { name: '⏰ Server Created', value: `<t:${Math.floor(fetchedGuild.createdTimestamp / 1000)}:F>\n(<t:${Math.floor(fetchedGuild.createdTimestamp / 1000)}:R>)` }
    ]);
    
    serverInfoEmbed.setFooter({ text: `Coded by IdanMR • Server ID: ${guild.id}` });
    serverInfoEmbed.setTimestamp();
    
    await interaction.reply({ embeds: [serverInfoEmbed] });
  },
};

// Helper functions to format server information
function getGeneralInfo(guild: Guild): string {
  const features = guild.features.length > 0 
    ? guild.features.map(f => `• ${formatFeature(f)}`).join('\n')
    : 'No special features';
  
  return [
    `**Owner:** <@${guild.ownerId}>`,
    `**Region:** ${guild.preferredLocale}`,
    `**Boost Tier:** ${guild.premiumTier || 'None'} (${guild.premiumSubscriptionCount || 0} boosts)`,
    `**Features:**\n${features}`
  ].join('\n');
}

function getMemberStats(guild: Guild): string {
  const totalMembers = guild.memberCount;
  
  return [
    `**Total Members:** ${totalMembers}`,
    `**Humans:** ${totalMembers - guild.members.cache.filter(m => m.user.bot).size}`,
    `**Bots:** ${guild.members.cache.filter(m => m.user.bot).size}`,
    `**Roles:** ${guild.roles.cache.size}`
  ].join('\n');
}

function getChannelStats(guild: Guild): string {
  const textChannels = guild.channels.cache.filter(c => c.type === 0).size;
  const voiceChannels = guild.channels.cache.filter(c => c.type === 2).size;
  const categoryChannels = guild.channels.cache.filter(c => c.type === 4).size;
  const forumChannels = guild.channels.cache.filter(c => c.type === 15).size;
  
  return [
    `**Total Channels:** ${guild.channels.cache.size}`,
    `**Text:** ${textChannels}`,
    `**Voice:** ${voiceChannels}`,
    `**Categories:** ${categoryChannels}`,
    `**Forums:** ${forumChannels}`,
    `**Emojis:** ${guild.emojis.cache.size}`,
    `**Stickers:** ${guild.stickers.cache.size}`
  ].join('\n');
}

function getSecurityInfo(guild: Guild): string {
  const verificationLevel = formatVerificationLevel(guild.verificationLevel);
  const explicitContentFilter = formatExplicitContentFilter(guild.explicitContentFilter);
  
  return [
    `**Verification Level:** ${verificationLevel}`,
    `**Content Filter:** ${explicitContentFilter}`,
    `**2FA Requirement:** ${guild.mfaLevel === 1 ? 'Enabled' : 'Disabled'}`
  ].join('\n');
}

// Format guild features to be more readable
function formatFeature(feature: string): string {
  return feature
    .replace(/_/g, ' ')
    .toLowerCase()
    .replace(/\b\w/g, char => char.toUpperCase());
}

// Format verification level to be more readable
function formatVerificationLevel(level: number): string {
  switch (level) {
    case 0: return '**None** - Unrestricted';
    case 1: return '**Low** - Must have verified email';
    case 2: return '**Medium** - Registered for more than 5 minutes';
    case 3: return '**High** - Member of server for more than 10 minutes';
    case 4: return '**Very High** - Must have verified phone number';
    default: return 'Unknown';
  }
}

// Format explicit content filter to be more readable
function formatExplicitContentFilter(filter: number): string {
  switch (filter) {
    case 0: return '**Disabled** - No scanning';
    case 1: return '**Medium** - Scan messages from members without roles';
    case 2: return '**High** - Scan all messages';
    default: return 'Unknown';
  }
}
