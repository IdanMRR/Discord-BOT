import { 
  SlashCommandBuilder, 
  EmbedBuilder, 
  ActionRowBuilder, 
  ButtonBuilder, 
  ButtonStyle, 
  StringSelectMenuBuilder, 
  StringSelectMenuOptionBuilder,
  ChatInputCommandInteraction,
  MessageFlags
} from 'discord.js';
import { Colors } from '../../utils/embeds';
import { logCommandUsage } from '../../utils/logger';

export const data = new SlashCommandBuilder()
  .setName('help')
  .setDescription('Get comprehensive help with all bot commands and features')
  .addStringOption(option =>
    option.setName('category')
      .setDescription('The category of commands to get help with')
      .setRequired(false)
      .addChoices(
        { name: 'Admin', value: 'admin' },
        { name: 'Moderation', value: 'moderation' },
        { name: 'Tickets', value: 'tickets' },
        { name: 'Red Alert', value: 'redalert' },
        { name: 'Giveaways', value: 'giveaways' },
        { name: 'Utility', value: 'utility' },
        { name: 'General', value: 'general' },
        { name: 'All Commands', value: 'all' }
      )
  );

export async function execute(interaction: ChatInputCommandInteraction) {
  try {
    // Defer the reply immediately to prevent timeout
    await interaction.deferReply({ flags: MessageFlags.Ephemeral });
    
    const category = interaction.options.getString('category') || 'all';
    
    if (category === 'all') {
      // Create the main help embed
      const helpEmbed = new EmbedBuilder()
        .setTitle('📚 Complete Bot Help Center')
        .setDescription('🎯 **Welcome to the comprehensive help system!**\n\nThis bot provides powerful features for server management, moderation, tickets, alerts, and more. Select a category below to explore specific commands.')
        .setColor(Colors.INFO)
        .addFields(
          { name: '⚙️ Admin Commands', value: '`Server setup, configurations, logs, and management tools`', inline: true },
          { name: '🛡️ Moderation Commands', value: '`User moderation, warnings, bans, and staff tools`', inline: true },
          { name: '🎫 Ticket Commands', value: '`Support ticket system and management`', inline: true },
          { name: '🚨 Red Alert Commands', value: '`Israeli emergency alert system integration`', inline: true },
          { name: '🎁 Giveaway Commands', value: '`Create and manage server giveaways`', inline: true },
          { name: '🔧 Utility Commands', value: '`General purpose tools and information`', inline: true },
          { name: '👋 General Commands', value: '`Basic user commands and verification`', inline: true },
          { name: '📊 Total Commands', value: '`**70+** commands available across all categories`', inline: true }
        )
        .addFields({
          name: '🚀 Quick Start Guide',
          value: [
            '• **New Server?** Start with `/server-setup` for automated configuration',
            '• **Need Tickets?** Use `/ticket-config` to set up support system',
            '• **Want Alerts?** Use `/setup-redalert` for emergency notifications',
            '• **Staff Management?** Check out `/roles-setup` and `/dashboard-perms`'
          ].join('\n'),
          inline: false
        })
        .setFooter({ text: 'Use /help [category] to view specific command categories • Bot made with ❤️' });

      // Create a select menu for categories
      const row = new ActionRowBuilder<StringSelectMenuBuilder>()
        .addComponents(
          new StringSelectMenuBuilder()
            .setCustomId('help_category_select')
            .setPlaceholder('📂 Select a category to explore commands')
            .addOptions(
              new StringSelectMenuOptionBuilder()
                .setLabel('Admin Commands')
                .setDescription('Server management and administrative tools')
                .setValue('admin')
                .setEmoji('⚙️'),
              new StringSelectMenuOptionBuilder()
                .setLabel('Moderation Commands')
                .setDescription('User moderation and staff management tools')
                .setValue('moderation')
                .setEmoji('🛡️'),
              new StringSelectMenuOptionBuilder()
                .setLabel('Ticket Commands')
                .setDescription('Support ticket system and management')
                .setValue('tickets')
                .setEmoji('🎫'),
              new StringSelectMenuOptionBuilder()
                .setLabel('Red Alert Commands')
                .setDescription('Israeli emergency alert system')
                .setValue('redalert')
                .setEmoji('🚨'),
              new StringSelectMenuOptionBuilder()
                .setLabel('Giveaway Commands')
                .setDescription('Create and manage server giveaways')
                .setValue('giveaways')
                .setEmoji('🎁'),
              new StringSelectMenuOptionBuilder()
                .setLabel('Utility Commands')
                .setDescription('General purpose tools and utilities')
                .setValue('utility')
                .setEmoji('🔧'),
              new StringSelectMenuOptionBuilder()
                .setLabel('General Commands')
                .setDescription('Basic user commands and verification')
                .setValue('general')
                .setEmoji('👋')
            )
        );

      await interaction.editReply({ 
        embeds: [helpEmbed], 
        components: [row]
      });
      
      // Log the command usage after successful execution
      await logCommandUsage({
        guild: interaction.guild!,
        user: interaction.user,
        command: 'help',
        options: { category },
        channel: interaction.channel,
        success: true
      });
      
      return;
    }

    // Show help for a specific category
    let helpEmbed = new EmbedBuilder();
    switch (category) {
      case 'admin':
        helpEmbed = new EmbedBuilder()
          .setTitle('⚙️ Admin Commands')
          .setDescription('**Complete administrative toolkit for server management**\n\n*Manage your server with powerful automation and configuration tools*')
          .setColor(Colors.INFO)
          .addFields(
            // Server Setup & Configuration
            { name: '🏗️ **Server Setup & Configuration**', value: '━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━', inline: false },
            { name: '/server-setup', value: '🔧 Complete server setup with tickets, logs, roles, and essential configurations', inline: false },
            { name: '/setup-wizard', value: '🧙‍♂️ Interactive setup wizard to guide you through server configuration', inline: false },
            { name: '/roles-setup', value: '🎭 Configure bot permission roles (admin, moderator, ticket staff, etc.)', inline: false },
            { name: '/dashboard-perms', value: '👥 Manage web dashboard permissions for users and roles', inline: false },
            
            // Logging & Monitoring
            { name: '📊 **Logging & Monitoring**', value: '━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━', inline: false },
            { name: '/setup-logs', value: '📝 Configure server logging channels and settings', inline: false },
            { name: '/command-logs', value: '📋 View command usage history with filtering options', inline: false },
            { name: '/dm-logs', value: '📨 View bot direct message logs and history', inline: false },
            { name: '/ticket-logs', value: '🎫 View detailed ticket action logs and statistics', inline: false },
            { name: '/verify-logs', value: '✅ View verification system logs and user activity', inline: false },
            { name: '/toggle-command-logging', value: '🔄 Enable/disable command usage logging', inline: false },
            { name: '/force-log', value: '📤 Manually create log entries for testing', inline: false },
            
            // Content Management
            { name: '📝 **Content Management**', value: '━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━', inline: false },
            { name: '/rules-manager', value: '📜 Manage server rules (add, edit, delete, display)', inline: false },
            { name: '/faq-manager', value: '❓ Manage frequently asked questions and responses', inline: false },
            { name: '/welcome-setup', value: '👋 Configure welcome messages and new member setup', inline: false },
            
            // System Tools
            { name: '🛠️ **System Tools**', value: '━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━', inline: false },
            { name: '/server-cleanup', value: '🧹 Clean up server channels, roles, and unused elements', inline: false },
            { name: '/nuke', value: '💥 Advanced channel management and cleanup tools', inline: false },
            { name: '/migrate-warnings', value: '📦 Migrate warning data between systems', inline: false },
            { name: '/reset-staff-table', value: '🔄 Reset staff activity tracking tables', inline: false }
          );
        break;
        
      case 'moderation':
        helpEmbed = new EmbedBuilder()
          .setTitle('🛡️ Moderation Commands')
          .setDescription('**Complete moderation toolkit for maintaining server order**\n\n*Keep your community safe with powerful moderation tools*')
          .setColor(Colors.INFO)
          .addFields(
            // User Actions
            { name: '👤 **User Moderation Actions**', value: '━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━', inline: false },
            { name: '/ban', value: '🔨 Ban a user from the server with optional reason and duration', inline: false },
            { name: '/kick', value: '👢 Kick a user from the server with optional reason', inline: false },
            { name: '/timeout', value: '⏰ Timeout a user for a specified duration with reason', inline: false },
            { name: '/warn', value: '⚠️ Issue a warning to a user with detailed reason', inline: false },
            { name: '/removewarn', value: '❌ Remove a specific warning from a user', inline: false },
            { name: '/warnings', value: '📋 View all warnings for a specific user', inline: false },
            
            // Communication Tools
            { name: '💬 **Communication & Messaging**', value: '━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━', inline: false },
            { name: '/dm', value: '📨 Send a direct message to a user through the bot', inline: false },
            { name: '/staff-message', value: '👥 Send a message visible only to staff in ticket channels', inline: false },
            
            // Case Management
            { name: '📁 **Case Management**', value: '━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━', inline: false },
            { name: '/cases', value: '📂 View moderation cases and history for users', inline: false },
            { name: '/staff-stats', value: '📊 View staff performance statistics and activity', inline: false },
            
            // Configuration
            { name: '⚙️ **Moderation Configuration**', value: '━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━', inline: false },
            { name: '/setlogchannel', value: '📍 Set the channel where moderation logs will be sent', inline: false },
            { name: '/ticket-status', value: '🎫 Change the status of tickets (Open, In Progress, On Hold, Closed)', inline: false },
            { name: '/ticket-rate', value: '⭐ Rate completed tickets and provide feedback', inline: false }
          );
        break;
        
      case 'tickets':
        helpEmbed = new EmbedBuilder()
          .setTitle('🎫 Ticket System Commands')
          .setDescription('**Complete support ticket management system**\n\n*Provide excellent customer support with advanced ticket features*')
          .setColor(Colors.INFO)
          .addFields(
            // Setup & Configuration
            { name: '🏗️ **Ticket Setup & Configuration**', value: '━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━', inline: false },
            { name: '/ticket-config', value: '⚙️ Configure ticket system settings and categories', inline: false },
            { name: '/setup-ticket-logs', value: '📝 Set up ticket logging channel and preferences', inline: false },
            { name: '/ticket-cleanup', value: '🧹 Clean up old tickets and manage ticket archives', inline: false },
            
            // Ticket Management
            { name: '🎛️ **Ticket Management**', value: '━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━', inline: false },
            { name: '/ticket-add-user', value: '➕ Add a user to the current ticket channel', inline: false },
            { name: '/ticket-remove-user', value: '➖ Remove a user from the current ticket channel', inline: false },
            { name: '/ticket-priority', value: '🚨 Set ticket priority level (High, Medium, Low)', inline: false },
            { name: '/ticket-status', value: '📊 Change ticket status (Open, In Progress, On Hold, Closed)', inline: false },
            
            // Staff Tools
            { name: '👥 **Staff Tools**', value: '━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━', inline: false },
            { name: '/staff-message', value: '🔒 Send messages visible only to staff members', inline: false },
            { name: '/staff-stats', value: '📈 View staff performance and ticket handling statistics', inline: false },
            { name: '/ticket-debug', value: '🔍 Debug ticket system issues and view diagnostics', inline: false },
            
            // User Experience
            { name: '⭐ **User Experience**', value: '━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━', inline: false },
            { name: '/ticket-rate', value: '⭐ Rate ticket support experience and provide feedback', inline: false },
            { name: '/test-logs', value: '🧪 Test ticket logging system functionality', inline: false }
          );
        break;
        
      case 'redalert':
        helpEmbed = new EmbedBuilder()
          .setTitle('🚨 Red Alert Commands')
          .setDescription('**Israeli Emergency Alert System Integration**\n\n*Real-time emergency notifications with comprehensive coverage*')
          .setColor(Colors.ERROR)
          .addFields(
            // System Setup
            { name: '🔧 **System Setup**', value: '━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━', inline: false },
            { name: '/setup-redalert', value: '🚨 Configure a channel to receive real-time Red Alert notifications', inline: false },
            { name: '/remove-redalert', value: '🗑️ Remove Red Alert notifications from channels', inline: false },
            { name: '/list-redalert', value: '📋 View all configured Red Alert channels and their status', inline: false },
            
            // Configuration & Settings
            { name: '⚙️ **Configuration & Settings**', value: '━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━', inline: false },
            { name: '/redalert-settings view', value: '👀 Display current Red Alert configuration and preferences', inline: false },
            { name: '/redalert-settings notifications', value: '📢 Configure mention preferences and notification settings', inline: false },
            { name: '/redalert-settings filters', value: '🎯 Configure alert type and location filtering options', inline: false },
            { name: '/redalert-settings reset', value: '🔄 Reset all Red Alert settings to default values', inline: false },
            
            // Monitoring & Analytics
            { name: '📊 **Monitoring & Analytics**', value: '━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━', inline: false },
            { name: '/redalert-history', value: '📈 View recent Red Alert history with statistics and trends', inline: false },
            { name: '/test-redalert', value: '🧪 Send test Red Alert notifications with different alert types', inline: false }
          )
          .addFields(
            {
              name: '🌍 **Coverage Areas**',
              value: [
                '• **עוטף גזה** (Gaza Envelope) - 15 second shelter time',
                '• **מחוז המרכז** (Central District) - 90 second shelter time', 
                '• **מחוז הצפון** (Northern District) - 30-60 second shelter time',
                '• **מחוז הדרום** (Southern District) - 30-60 second shelter time',
                '• **ירושלים** (Jerusalem District) - 90 second shelter time'
              ].join('\n'),
              inline: true
            },
            {
              name: '⚡ **System Features**',
              value: [
                '✅ Real-time monitoring (10-second intervals)',
                '✅ Hebrew & English dual language support',
                '✅ Interactive map integration',
                '✅ Population impact calculations',
                '✅ Multiple alert type detection',
                '✅ Smart spam prevention',
                '✅ Historical data tracking'
              ].join('\n'),
              inline: true
            }
          );
        break;
        
      case 'giveaways':
        helpEmbed = new EmbedBuilder()
          .setTitle('🎁 Giveaway Commands')
          .setDescription('**Complete giveaway management system**\n\n*Engage your community with exciting giveaways and prizes*')
          .setColor(Colors.SUCCESS)
          .addFields(
            // Giveaway Management
            { name: '🎯 **Giveaway Management**', value: '━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━', inline: false },
            { name: '/giveaway-create', value: '🎁 Create a new giveaway with prizes, duration, and requirements', inline: false },
            { name: '/giveaway-end', value: '🏁 Manually end a giveaway early and select winners', inline: false },
            { name: '/giveaway-cancel', value: '❌ Cancel an active giveaway with optional reason', inline: false },
            { name: '/giveaway-reroll', value: '🎲 Reroll winners for a completed giveaway', inline: false },
            
            // Information & Analytics
            { name: '📊 **Information & Analytics**', value: '━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━', inline: false },
            { name: '/giveaway-list', value: '📋 List all giveaways with status filtering options', inline: false },
            { name: '/giveaway-info', value: 'ℹ️ View detailed information about a specific giveaway', inline: false },
            { name: '/giveaway-entries', value: '👥 View entries and participants for a giveaway', inline: false }
          )
          .addFields({
            name: '✨ **Features**',
            value: [
              '• **Role Requirements** - Require specific roles to participate',
              '• **Server Boost Requirements** - Boost-only giveaways',
              '• **Multiple Winners** - Support for multiple prize winners',
              '• **Flexible Duration** - Minutes to weeks duration support',
              '• **Auto Management** - Automatic winner selection and notifications',
              '• **Entry Tracking** - Complete participant management'
            ].join('\n'),
            inline: false
          });
        break;
        
      case 'utility':
        helpEmbed = new EmbedBuilder()
          .setTitle('🔧 Utility Commands')
          .setDescription('**General purpose tools and utilities**\n\n*Helpful commands for everyday server and user needs*')
          .setColor(Colors.INFO)
          .addFields(
            // Information Commands
            { name: 'ℹ️ **Information Commands**', value: '━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━', inline: false },
            { name: '/help', value: '📚 Show this comprehensive help menu with all available commands', inline: false },
            { name: '/serverinfo', value: '🏠 Display detailed information about the current server', inline: false },
            { name: '/userinfo', value: '👤 Display detailed information about a user', inline: false },
            { name: '/avatar', value: '🖼️ Display a user\'s avatar in high resolution', inline: false },
            
            // Social & Communication
            { name: '💬 **Social & Communication**', value: '━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━', inline: false },
            { name: '/chatbot', value: '🤖 Ask the AI chatbot questions and get intelligent responses', inline: false },
            { name: '/quote', value: '💬 Quote and highlight specific messages', inline: false },
            
            // Invites & Growth
            { name: '📈 **Invites & Growth**', value: '━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━', inline: false },
            { name: '/invite', value: '🔗 Get an invite link for the bot', inline: false },
            { name: '/invites', value: '📊 View server invite statistics and leaderboard', inline: false },
            { name: '/invite-stats', value: '📈 View detailed invite statistics for users', inline: false },
            { name: '/invite-leaderboard', value: '🏆 Display the server invite leaderboard', inline: false },
            
            // Weather & Location
            { name: '🌤️ **Weather & Location**', value: '━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━', inline: false },
            { name: '/weather', value: '🌡️ Get current weather and forecast for any location', inline: false },
            { name: '/set-weather-channel', value: '📍 Set a channel for automatic weather updates', inline: false },
            { name: '/set-weather-schedule', value: '⏰ Configure automated weather update schedule', inline: false },
            
            // System & Testing
            { name: '🔧 **System & Testing**', value: '━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━', inline: false },
            { name: '/language', value: '🌐 Set your preferred language for bot interactions', inline: false },
            { name: '/test-chatbot', value: '🧪 Test the AI chatbot functionality', inline: false },
            { name: '/check-chatbot-status', value: '📊 Check the status of the AI chatbot system', inline: false },
            { name: '/toggle-ai-chatbot', value: '🔄 Enable/disable AI chatbot functionality', inline: false },
            { name: '/test-events', value: '🎪 Test various bot events and handlers', inline: false },
            { name: '/test-verification', value: '✅ Test the verification system functionality', inline: false }
          );
        break;
        
      case 'general':
        helpEmbed = new EmbedBuilder()
          .setTitle('👋 General Commands')
          .setDescription('**Basic user commands and verification**\n\n*Essential commands for all server members*')
          .setColor(Colors.PRIMARY)
          .addFields(
            // User Commands
            { name: '👤 **User Commands**', value: '━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━', inline: false },
            { name: '/verify', value: '✅ Complete server verification process and gain access', inline: false },
            { name: '/verification-setup', value: '⚙️ Configure server verification system (Admin only)', inline: false },
            { name: '/member-events-setup', value: '🎉 Set up member join/leave events (Admin only)', inline: false }
          )
          .addFields({
            name: '📋 **Verification Features**',
            value: [
              '• **Custom Questions** - Server-specific verification questions',
              '• **Role Assignment** - Automatic role assignment after verification',
              '• **Anti-Bot Protection** - Advanced bot detection and prevention',
              '• **Welcome Messages** - Customizable welcome system',
              '• **Member Tracking** - Complete join/leave event logging'
            ].join('\n'),
            inline: false
          });
        break;
    }

    // Create navigation buttons
    const row = new ActionRowBuilder<ButtonBuilder>()
      .addComponents(
        new ButtonBuilder()
          .setCustomId('help_back')
          .setLabel('Back to Main Menu')
          .setStyle(ButtonStyle.Secondary)
          .setEmoji('⬅️'),
        new ButtonBuilder()
          .setCustomId('help_admin')
          .setLabel('Admin')
          .setStyle(ButtonStyle.Primary)
          .setEmoji('⚙️')
          .setDisabled(category === 'admin'),
        new ButtonBuilder()
          .setCustomId('help_moderation')
          .setLabel('Moderation')
          .setStyle(ButtonStyle.Primary)
          .setEmoji('🛡️')
          .setDisabled(category === 'moderation'),
        new ButtonBuilder()
          .setCustomId('help_tickets')
          .setLabel('Tickets')
          .setStyle(ButtonStyle.Primary)
          .setEmoji('🎫')
          .setDisabled(category === 'tickets'),
        new ButtonBuilder()
          .setCustomId('help_redalert')
          .setLabel('Red Alert')
          .setStyle(ButtonStyle.Danger)
          .setEmoji('🚨')
          .setDisabled(category === 'redalert')
      );

    const row2 = new ActionRowBuilder<ButtonBuilder>()
      .addComponents(
        new ButtonBuilder()
          .setCustomId('help_giveaways')
          .setLabel('Giveaways')
          .setStyle(ButtonStyle.Success)
          .setEmoji('🎁')
          .setDisabled(category === 'giveaways'),
        new ButtonBuilder()
          .setCustomId('help_utility')
          .setLabel('Utility')
          .setStyle(ButtonStyle.Primary)
          .setEmoji('🔧')
          .setDisabled(category === 'utility'),
        new ButtonBuilder()
          .setCustomId('help_general')
          .setLabel('General')
          .setStyle(ButtonStyle.Primary)
          .setEmoji('👋')
          .setDisabled(category === 'general')
      );

    await interaction.editReply({ 
      embeds: [helpEmbed], 
      components: [row, row2]
    });
    
    // Log the command usage after successful execution
    await logCommandUsage({
      guild: interaction.guild!,
      user: interaction.user,
      command: 'help',
      options: { category },
      channel: interaction.channel,
      success: true
    });
    
  } catch (error: any) {
    console.error('Error executing help command:', error);
    
    try {
      await interaction.editReply({ 
        content: 'There was an error executing the help command.'
      });
    } catch (replyError) {
      console.error('Failed to send error response:', replyError);
    }
  }
}
