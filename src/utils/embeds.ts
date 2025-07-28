import { EmbedBuilder, User, ColorResolvable } from 'discord.js';
import { formatIsraeliTime, formatIsraeliDateForTranscript } from './time-formatter';

/**
 * Professional color palette for different types of embeds
 * These colors are chosen to match Discord's design system
 */
export const Colors = {
  PRIMARY: 0x5865F2,   // Discord Blurple - Main brand color
  SUCCESS: 0x57F287,   // Green - Positive actions and confirmations
  WARNING: 0xFEE75C,   // Yellow - Warnings and cautions
  ERROR: 0xED4245,     // Red - Errors and critical actions
  INFO: 0x5865F2,      // Blurple - Informational messages
  MODERATION: 0xEB459E, // Pink - Moderation actions
  TICKETS: 0x2D3136,   // Dark Gray - Ticket system
  DONATION: 0x57F287,  // Green - Donation related
  SUPPORT: 0x5865F2,   // Blurple - Support related
  SECONDARY: 0x4F545C, // Secondary Gray - Additional category color
};

/**
 * Creates a standardized embed with consistent styling across the bot
 * 
 * @param options Configuration options for the embed
 * @returns A configured EmbedBuilder instance ready to be sent
 */
export function createEmbed(options: {
  title: string;                // The title of the embed
  description?: string;         // Optional description text
  color?: ColorResolvable;      // Optional color (defaults to PRIMARY)
  thumbnail?: string;           // Optional thumbnail URL
  footer?: string;              // Optional footer text
  timestamp?: boolean;          // Whether to include current timestamp
  author?: {
    name: string;              // Author name
    iconURL?: string;          // Author icon URL
  };
  fields?: {
    name: string;              // Field name
    value: string;             // Field value
    inline?: boolean;          // Whether field should be inline
  }[];
}) {
  // Create the base embed with required properties
  const embed = new EmbedBuilder()
    .setTitle(options.title)
    .setColor(options.color || Colors.PRIMARY);
  
  // Add optional properties if provided
  if (options.description) embed.setDescription(options.description);
  if (options.thumbnail) embed.setThumbnail(options.thumbnail);
  
  // Set footer with branding
  if (options.footer) {
    embed.setFooter({ text: options.footer + ' • Made by Soggra.' });
  } else {
    // Default footer with branding using Israeli timezone
    const timeString = formatIsraeliTime();
    embed.setFooter({ text: `Made by Soggra. • Today at ${timeString}` });
  }
  
  // Add timestamp if requested
  if (options.timestamp) embed.setTimestamp();
  
  // Add author if provided
  if (options.author) {
    embed.setAuthor({
      name: options.author.name,
      iconURL: options.author.iconURL
    });
  }
  
  // Add fields if provided
  if (options.fields && options.fields.length > 0) {
    embed.addFields(options.fields);
  }
  
  return embed;
}

// Moderation action embed (kick, ban, etc.)
export function createModerationEmbed(options: {
  action: string;
  target: User;
  moderator: User;
  reason: string;
  additionalFields?: { name: string; value: string; inline?: boolean }[];
  color?: ColorResolvable;
  caseNumber?: number;
  issuedAt?: string;
  removedAt?: string;
  removedBy?: string;
}) {
  // Get emoji based on action type
  const actionEmoji = getActionEmoji(options.action);
  const caseNum = options.caseNumber ? options.caseNumber.toString().padStart(4, '0') : null;
  
  // Get current time using Israeli timezone
  const timeString = formatIsraeliTime();
  
  // Format date like "5/5/2025, 9:20:03 AM" using Israeli time
  const formattedDate = formatIsraeliDateForTranscript();
  
  // For other date formatting (e.g., in warning removal history)
  const israeliTime = new Date(new Date().toLocaleString("en-US", { timeZone: "Asia/Jerusalem" }));
  const days = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
  const months = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
  const longFormattedDate = `${days[israeliTime.getDay()]}, ${israeliTime.getDate()} ${months[israeliTime.getMonth()]} ${israeliTime.getFullYear()} at ${timeString}`;
  
  const embed = new EmbedBuilder()
    .setColor(options.color || Colors.MODERATION)
    .setTitle(`${actionEmoji} ${options.action.toUpperCase()} | ${caseNum ? `Case #${caseNum}` : options.target.username}`)
    .setDescription(`${options.target} (${options.target.id}) has been ${options.action === 'Warning' ? 'warned' : options.action.toLowerCase() + 'ed'} by ${options.moderator}.`)
    .setThumbnail(options.target.displayAvatarURL({ size: 256 }))
    .addFields([{ name: 'Reason:', value: options.reason }])
    .addFields([{ name: 'This action was taken on', value: formattedDate }]);
  
  // Format the footer with the current time - using the already declared timeString variable
  embed.setFooter({ text: `Made by Soggra. • Today at ${timeString}` });
  
  // Add user and moderator information sections exactly as requested
  embed.addFields([
    { name: '👤 User Information', value: `Tag: ${options.target.username}\nID: ${options.target.id}\nCreated: 6 years ago`, inline: false },
    { name: '🛡️ Moderator Information', value: `Tag: ${options.moderator.username}\nID: ${options.moderator.id}`, inline: false }
  ]);
  
  // Add detailed reason section
  embed.addFields([{ name: '📝 Detailed Reason', value: options.reason || 'No reason provided' }]);
  
  // Add issue date and removed info if provided
  if (options.issuedAt || options.removedAt) {
    let formattedDates = '';
    
    if (options.issuedAt) {
      const issueDate = new Date(options.issuedAt);
      const issueDays = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
      const issueMonths = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
      formattedDates += `Issued: ${issueDays[issueDate.getDay()]}, ${issueDate.getDate()} ${issueMonths[issueDate.getMonth()]} ${issueDate.getFullYear()} at ${issueDate.getHours()}:${issueDate.getMinutes().toString().padStart(2, '0')}`;
    }
    
    if (options.removedBy && options.removedAt) {
      if (formattedDates) formattedDates += '\n';
      formattedDates += `Removed by: ${options.removedBy}\n`;
      
      const removeDate = new Date(options.removedAt);
      const removeDays = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
      const removeMonths = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
      formattedDates += `Removed: ${removeDays[removeDate.getDay()]}, ${removeDate.getDate()} ${removeMonths[removeDate.getMonth()]} ${removeDate.getFullYear()} at ${removeDate.getHours()}:${removeDate.getMinutes().toString().padStart(2, '0')}`;
    }
    
    if (formattedDates) {
      embed.addFields([{ name: '⏱️ Timing Information', value: formattedDates }]);
    }
  }
  
  // Add the case number, server and warning count fields in a clean row
  if (options.caseNumber) {
    const caseNumFormatted = options.caseNumber.toString().padStart(4, '0');
    
    // Add server, warning count, and case number in a row as shown in the screenshot
    const warningCount = options.additionalFields?.find(field => field.name === '⚠️ Active Warnings')?.value || '0';
    embed.addFields([
      { name: '🏠 Server', value: options.additionalFields?.find(field => field.name === '🏠 Server')?.value || 'Coding API', inline: true },
      { name: '⚠️ Warning Count', value: warningCount, inline: true },
      { name: '📋 Case Number', value: `#${caseNumFormatted}`, inline: true }
    ]);
  }
  
  // Add any additional fields
  if (options.additionalFields) {
    // Filter out fields that we already added (server, warning count, case number)
    const filteredFields = options.additionalFields.filter(field => 
      !field.name.includes('Server') && 
      !field.name.includes('Warning Count') && 
      !field.name.includes('Case Number')
    );
    
    if (filteredFields.length > 0) {
      embed.addFields(filteredFields);
    }
  }
  
  // Helper function to get emoji for different action types
  function getActionEmoji(action: string): string {
    switch(action.toLowerCase()) {
      case 'ban': return '🔨';
      case 'kick': return '👢';
      case 'mute': return '🔇';
      case 'warn': return '⚠️';
      case 'timeout': return '⏱️';
      default: return '🛡️';
    }
  }
  
  // Footer is already set earlier, no need to override it again
  
  return embed;
}

// Success message embed
export function createSuccessEmbed(title: string, description: string) {
  return createEmbed({
    title: `✅ ${title}`,
    description,
    color: Colors.SUCCESS,
    timestamp: true,
  }).setFooter({ text: 'Made by Soggra.' });
}

// Error message embed
export function createErrorEmbed(title: string, description: string) {
  return createEmbed({
    title: `❌ ${title}`,
    description,
    color: Colors.ERROR,
    timestamp: true,
  }).setFooter({ text: 'Made by Soggra.' });
}

// Info message embed
export function createInfoEmbed(title: string, description: string) {
  return createEmbed({
    title: `ℹ️ ${title}`,
    description,
    color: Colors.INFO,
    timestamp: true,
  }).setFooter({ text: 'Made by Soggra.' });
}
