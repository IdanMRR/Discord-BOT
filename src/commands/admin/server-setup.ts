import { 
  SlashCommandBuilder, 
  PermissionFlagsBits, 
  ChatInputCommandInteraction, 
  ChannelType, 
  EmbedBuilder,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  TextChannel,
  CategoryChannel,
  OverwriteResolvable,
  PermissionsBitField,
  RoleManager,
  Role,
  StringSelectMenuBuilder,
  StringSelectMenuOptionBuilder,
  MessageFlags
} from 'discord.js';
import { Colors, createSuccessEmbed, createErrorEmbed } from '../../utils/embeds';
import { logInfo, logError, logWarning, logCommandUsage } from '../../utils/logger';
import { settingsManager } from '../../utils/settings';

import { db } from '../../database/sqlite';
import { ticketCategories } from '../../handlers/tickets/ticket-categories';
import { AVAILABLE_LANGUAGES, Language, setGuildLanguage, getContextLanguage, getTranslation as t } from '../../utils/language';
import { VerificationType, saveVerificationSettings } from '../../handlers/verification/verification-config';
import { createVerificationMessage } from '../../handlers/verification/verification-handler';
import { setupMemberEvents as configureMemberEvents } from '../../handlers/members/member-events';
import { initializeInviteTracker } from '../../handlers/invites/invite-tracker';

export const data = new SlashCommandBuilder()
  .setName('server-setup')
  .setDescription('Set up the server with tickets, logs, and other essential configurations')
  .setDefaultMemberPermissions(PermissionFlagsBits.Administrator)
  .addRoleOption(option => 
    option.setName('staff_role')
      .setDescription('The role that will have access to tickets and moderation commands')
      .setRequired(true)
  )
  .addBooleanOption(option =>
    option.setName('setup_all')
      .setDescription('Set up everything (recommended for new servers)')
      .setRequired(false)
  )
  .addBooleanOption(option =>
    option.setName('create_categories')
      .setDescription('Create categories for tickets and logs')
      .setRequired(false)
  )
  .addBooleanOption(option =>
    option.setName('setup_tickets')
      .setDescription('Set up the ticket system')
      .setRequired(false)
  )
  .addBooleanOption(option =>
    option.setName('setup_logs')
      .setDescription('Set up logging channels')
      .setRequired(false)
  )
  .addBooleanOption(option =>
    option.setName('setup_welcome')
      .setDescription('Set up welcome messages')
      .setRequired(false)
  )
  .addBooleanOption(option =>
    option.setName('setup_rules')
      .setDescription('Set up rules channel')
      .setRequired(false)
  )
  .addBooleanOption(option =>
    option.setName('setup_verification')
      .setDescription('Set up member verification system')
      .setRequired(false)
  )
  .addStringOption(option =>
    option.setName('verification_type')
      .setDescription('The type of verification to use (REQUIRED if setting up verification)')
      .setRequired(false)
      .addChoices(
        { name: 'Button (Simple Click)', value: 'button' },
        { name: 'CAPTCHA', value: 'captcha' },
        { name: 'Custom Question', value: 'custom_question' },
        { name: 'Age Verification', value: 'age_verification' }
      )
  )
  .addBooleanOption(option =>
    option.setName('setup_member_events')
      .setDescription('Set up welcome/leave messages and member count tracking')
      .setRequired(false)
  )
  .addBooleanOption(option =>
    option.setName('setup_invite_tracking')
      .setDescription('Set up invite tracking system to see who invited members')
      .setRequired(false)
  )
  .addStringOption(option =>
    option.setName('language')
      .setDescription('Set the default server language')
      .setRequired(false)
      .addChoices(
        { name: 'English', value: 'en' },
        { name: 'Hebrew (עברית)', value: 'he' }
      )
  );

export async function execute(interaction: ChatInputCommandInteraction) {
  try {
    // Defer the reply as this might take some time
    await interaction.deferReply({ flags: MessageFlags.Ephemeral });

    // Get options
    const staffRole = interaction.options.getRole('staff_role') as Role;
    const setupAll = interaction.options.getBoolean('setup_all') ?? false;
    
    // If setup_all is true, enable all setup options but still require verification_type if enabling verification
    const createCategories = setupAll ? true : (interaction.options.getBoolean('create_categories') ?? true);
    const setupTickets = setupAll ? true : (interaction.options.getBoolean('setup_tickets') ?? true);
    const setupLogs = setupAll ? true : (interaction.options.getBoolean('setup_logs') ?? true);
    const setupWelcome = setupAll ? true : (interaction.options.getBoolean('setup_welcome') ?? true);
    const setupRules = setupAll ? true : (interaction.options.getBoolean('setup_rules') ?? true);
    const setupInviteTracking = setupAll ? true : (interaction.options.getBoolean('setup_invite_tracking') ?? false);
    const verificationType = interaction.options.getString('verification_type');
    
    // Only enable verification if a type is provided (even with setup_all)
    const setupVerification = (setupAll || interaction.options.getBoolean('setup_verification')) ? (verificationType !== null) : false;
    
    const setupMemberEvents = setupAll ? true : (interaction.options.getBoolean('setup_member_events') ?? false);
    const language = interaction.options.getString('language') as Language || 'en';

    // Log command usage
    await logCommandUsage({
      guild: interaction.guild!,
      user: interaction.user,
      command: 'server-setup',
      options: { 
        staffRole: staffRole?.name,
        createCategories,
        setupTickets,
        setupLogs,
        setupWelcome,
        language
      },
      channel: interaction.channel,
      success: true
    });

    // Initialize settings
    let settings = await settingsManager.getSettings(interaction.guild!.id);
    if (!settings) {
      settings = {};
    }

    // Save staff role
    settings.staff_role_ids = [staffRole!.id];
    await settingsManager.updateSettings(interaction.guild!.id, settings);

    // Create categories if needed
    let ticketCategory: CategoryChannel | null = null;
    let logsCategory: CategoryChannel | null = null;
    
    // Set up each system as requested
    let successMessages: string[] = [];
    
    // Set up language preference
    await setupLanguage(interaction, language);
    successMessages.push('✅ Language settings updated');
    
    // Create categories if requested
    if (createCategories) {
      ticketCategory = await createCategory(interaction, 'TICKETS', staffRole);
      logsCategory = await createCategory(interaction, 'LOGS', staffRole);
      successMessages.push('✅ Categories created');
    }
    
    // Set up ticket system if requested
    if (setupTickets) {
      await setupTicketSystem(interaction, ticketCategory, staffRole);
      successMessages.push('✅ Ticket system set up');
    }
    
    // Set up logging channels if requested
    if (setupLogs) {
      await setupLoggingChannels(interaction, logsCategory, staffRole);
      successMessages.push('✅ Logging channels set up');
    }
    
    // Set up verification system first if requested (before welcome/rules)
    if (setupVerification) {
      // If verification type is not provided, ask the user to provide it
      if (!verificationType) {
        const verificationTypeEmbed = new EmbedBuilder()
          .setColor(Colors.INFO)
          .setTitle('⚠️ Verification Type Required')
          .setDescription('You must select a verification type to set up the verification system.')
          .addFields([
            { name: 'Available Verification Types', value: '• Button (Simple Click) - Users click a button to verify\n• CAPTCHA - Users solve a CAPTCHA\n• Custom Question - Users answer custom questions\n• Age Verification - Users verify their age' },
            { name: 'How to Set Up', value: 'Run the command again with the verification type option:\n`/server-setup setup_verification:True verification_type:[Your Choice]`' }
          ]);
        
        await interaction.editReply({ embeds: [verificationTypeEmbed] });
        // Mark setup as failed
        successMessages.push('❌ Verification system setup failed - verification type required');
        
        // Continue with other setups instead of returning
        // This allows other systems to still be set up even if verification fails
      } else {
        // Only set up verification if type is provided
        await setupVerificationSystem(interaction, staffRole, verificationType);
        successMessages.push('✅ Verification system set up');
      }
    }
    
    // Set up rules channel if requested - but don't send messages if verification is enabled
    if (setupRules) {
      await setupRulesChannel(interaction, staffRole, setupVerification);
      successMessages.push('✅ Rules channel set up');
    }
    
    // Set up welcome system if requested - but don't send messages if verification is enabled
    if (setupWelcome) {
      await setupWelcomeSystem(interaction, setupVerification);
      successMessages.push('✅ Welcome system set up');
    }

    // Set up member events if requested
    if (setupMemberEvents) {
      await setupMemberEventsSystem(interaction);
      successMessages.push('✅ Member events set up');
    }

    // Set up invite tracking system if requested
    if (setupInviteTracking) {
      try {
        // Get current server settings
        const settings = await settingsManager.getSettings(interaction.guild!.id);
        
        // Check if member logs exist, which is required for invite tracking
        if (!settings || !settings.member_log_channel_id) {
          logWarning('Server Setup', `No member logs channel found. Setting up logging channels first.`);
          
          // Set up logging channels if they don't exist
          if (!settings || !settings.member_log_channel_id) {
            // Create or get the logs category
            let logsCategory = interaction.guild!.channels.cache.find(channel => 
              channel.type === ChannelType.GuildCategory && channel.name.toLowerCase() === 'logs'
            ) as CategoryChannel;
            
            if (!logsCategory) {
              logsCategory = await interaction.guild!.channels.create({
                name: 'LOGS',
                type: ChannelType.GuildCategory,
              });
              logInfo('Server Setup', `Created logs category in ${interaction.guild!.name}`);
            }
            
            // Create the member logs channel
            const memberLogsChannel = await interaction.guild!.channels.create({
              name: 'member-logs',
              type: ChannelType.GuildText,
              parent: logsCategory.id,
              permissionOverwrites: [
                {
                  id: interaction.guild!.roles.everyone.id,
                  deny: [PermissionsBitField.Flags.ViewChannel]
                },
                {
                  id: interaction.client.user!.id,
                  allow: [
                    PermissionsBitField.Flags.ViewChannel,
                    PermissionsBitField.Flags.SendMessages,
                    PermissionsBitField.Flags.ManageMessages
                  ]
                }
              ]
            });
            
            // Update settings with member logs channel
            await settingsManager.updateSettings(interaction.guild!.id, {
              member_log_channel_id: memberLogsChannel.id
            });
            
            logInfo('Server Setup', `Created member logs channel for invite tracking in ${interaction.guild!.name}`);
          }
        }
        
        // Create a welcome channel if it doesn't exist (as a public-facing channel)
        if (!settings || !settings.welcome_channel_id) {
          const welcomeChannel = await interaction.guild!.channels.create({
            name: 'welcome',
            type: ChannelType.GuildText,
            permissionOverwrites: [
              {
                id: interaction.guild!.roles.everyone.id,
                allow: [
                  PermissionsBitField.Flags.ViewChannel,
                  PermissionsBitField.Flags.ReadMessageHistory
                ],
                deny: [
                  PermissionsBitField.Flags.SendMessages
                ]
              },
              {
                id: interaction.client.user!.id,
                allow: [
                  PermissionsBitField.Flags.ViewChannel,
                  PermissionsBitField.Flags.SendMessages,
                  PermissionsBitField.Flags.ManageMessages
                ]
              }
            ]
          });
          
          // Update settings with welcome channel
          const updatedSettings = await settingsManager.getSettings(interaction.guild!.id);
          if (!updatedSettings) {
            await settingsManager.updateSettings(interaction.guild!.id, { welcome_channel_id: welcomeChannel.id });
          } else {
            updatedSettings.welcome_channel_id = welcomeChannel.id;
            await settingsManager.updateSettings(interaction.guild!.id, updatedSettings);
          }
          
          // Configure member events to use this channel
          await configureMemberEvents(
            interaction.guild!.id,
            welcomeChannel.id,
            undefined, // No leave channel
            'Welcome to the server, {user}! We hope you enjoy your stay.',
            undefined, // Default leave message
            true // Show member count
          );
          
          logInfo('Server Setup', `Created welcome channel for invite tracking in ${interaction.guild!.name}`);
        }
        
        // Send example of what invite tracking looks like to the member-logs channel
        try {
          // Get the final settings after all the updates
          const finalSettings = await settingsManager.getSettings(interaction.guild!.id);
          
          if (finalSettings && finalSettings.member_log_channel_id) {
            const memberLogsChannel = await interaction.guild!.channels.fetch(finalSettings.member_log_channel_id) as TextChannel;
            
            if (memberLogsChannel && memberLogsChannel.isTextBased()) {
              // Show an example invite tracking log
              const exampleEmbed = new EmbedBuilder()
                .setColor('#5865F2')
                .setTitle('👋 Invite Tracking Configuration')
                .setDescription(`This channel will receive all member join and leave logs with invite information.`)
                .addFields([
                  { 
                    name: 'Invite Tracking', 
                    value: 'The bot will track which invites are used when members join the server.' 
                  },
                  { 
                    name: 'Join Logs', 
                    value: 'You will see who invited each new member, along with server stats.'
                  },
                  { 
                    name: 'Leave Logs', 
                    value: 'When members leave, you will see who invited them and if they might be fake invites.'
                  }
                ])
                .setFooter({ text: '• Made By Soggra' })
                .setTimestamp();
              
              await memberLogsChannel.send({ embeds: [exampleEmbed] });
              logInfo('Server Setup', `Sent invite tracking configuration message to member logs channel`);
            }
          }
        } catch (error) {
          logError('Server Setup', `Error sending invite tracking configuration: ${error}`);
        }
        
        // Initialize invite tracker on the client
        await initializeInviteTracker(interaction.client);
        
        logInfo('Server Setup', `Set up invite tracking system in ${interaction.guild!.name}`);
        successMessages.push('✅ Invite tracking system set up');
      } catch (error) {
        logError('Server Setup', `Error setting up invite tracking system: ${error}`);
      }
    }

    // Send success message
    await interaction.editReply({
      content: null,
      embeds: [createSuccessEmbed(
        '✅ Server Setup Complete',
        'Your server has been set up successfully! Check out the new channels and categories.'
      )]
    });

    // Add details about what was set up
    const setupDetails: string[] = [];
    if (createCategories) setupDetails.push('✅ Created categories for tickets and logs');
    if (setupTickets) setupDetails.push('✅ Set up ticket system');
    if (setupLogs) setupDetails.push('✅ Set up logging channels');
    if (setupWelcome) setupDetails.push('✅ Set up welcome system');
    if (setupRules) setupDetails.push('✅ Set up rules channel');
    if (setupVerification) setupDetails.push('✅ Set up verification system');
    if (setupMemberEvents) setupDetails.push('✅ Set up member events');
    if (setupInviteTracking) setupDetails.push('✅ Set up invite tracking system');
    setupDetails.push(`✅ Set server language to ${language}`);

    // Create success embed with details
    const successEmbed = createSuccessEmbed(
      '✅ Server Setup Complete',
      'Your server has been set up successfully! Check out the new channels and categories.'
    );
    
    successEmbed.addFields([
      { name: 'Setup Details', value: setupDetails.join('\n') },
      { name: 'Staff Role', value: `<@&${staffRole.id}>` },
      { name: 'Next Steps', value: 'You can customize your server further using the various commands available. Use `/help` to see all available commands.' }
    ]);

    // Send the success embed
    await interaction.editReply({ content: null, embeds: [successEmbed] });

    logInfo('Server Setup', `Server setup completed for ${interaction.guild!.name}`);
  } catch (error) {
    logError('Server Setup', error);
    
    // Handle error gracefully
    const errorEmbed = createErrorEmbed(
      'Setup Error',
      'An error occurred during server setup. Please try again or contact support.'
    );
    
    try {
      await interaction.editReply({ embeds: [errorEmbed] });
    } catch (replyError) {
      console.error('Failed to send error message:', replyError);
    }
  }
}

/**
 * Create a category channel with proper permissions
 */
async function createCategory(interaction: ChatInputCommandInteraction, name: string, staffRole: Role | any): Promise<CategoryChannel> {
  try {
    // Create a category for tickets
    const category = await interaction.guild!.channels.create({
      name,
      type: ChannelType.GuildCategory,
      permissionOverwrites: [
        {
          id: interaction.guild!.roles.everyone.id,
          deny: [PermissionsBitField.Flags.ViewChannel]
        },
        {
          id: staffRole.id,
          allow: [
            PermissionsBitField.Flags.ViewChannel,
            PermissionsBitField.Flags.SendMessages,
            PermissionsBitField.Flags.ManageChannels,
            PermissionsBitField.Flags.ManageMessages
          ]
        },
        {
          id: interaction.client.user!.id,
          allow: [
            PermissionsBitField.Flags.ViewChannel,
            PermissionsBitField.Flags.SendMessages,
            PermissionsBitField.Flags.ManageChannels,
            PermissionsBitField.Flags.ManageMessages
          ]
        }
      ]
    });

    logInfo('Server Setup', `Created ${name} category in ${interaction.guild!.name}`);
    return category;
  } catch (error) {
    logError('Server Setup', `Error creating ${name} category: ${error}`);
    throw error;
  }
}

/**
 * Set up the ticket system
 */
async function setupTicketSystem(interaction: ChatInputCommandInteraction, ticketCategory: CategoryChannel | null, staffRole: Role | any) {
  try {
    // Create a channel for ticket creation
    const ticketChannel = await interaction.guild!.channels.create({
      name: 'create-ticket',
      type: ChannelType.GuildText,
      parent: ticketCategory?.id,
      permissionOverwrites: [
        {
          id: interaction.guild!.roles.everyone.id,
          allow: [
            PermissionsBitField.Flags.ViewChannel,
            PermissionsBitField.Flags.SendMessages,
            PermissionsBitField.Flags.ReadMessageHistory
          ]
        },
        {
          id: interaction.client.user!.id,
          allow: [
            PermissionsBitField.Flags.ViewChannel,
            PermissionsBitField.Flags.SendMessages,
            PermissionsBitField.Flags.ManageMessages
          ]
        }
      ]
    });

    // Create a channel for ticket logs (only visible to staff)
    const ticketLogsChannel = await interaction.guild!.channels.create({
      name: 'ticket-logs',
      type: ChannelType.GuildText,
      parent: ticketCategory?.id,
      permissionOverwrites: [
        {
          id: interaction.guild!.roles.everyone.id,
          deny: [PermissionsBitField.Flags.ViewChannel]
        },
        {
          id: staffRole.id,
          allow: [
            PermissionsBitField.Flags.ViewChannel,
            PermissionsBitField.Flags.ReadMessageHistory
          ],
          deny: [PermissionsBitField.Flags.SendMessages]
        },
        {
          id: interaction.client.user!.id,
          allow: [
            PermissionsBitField.Flags.ViewChannel,
            PermissionsBitField.Flags.SendMessages,
            PermissionsBitField.Flags.ManageMessages
          ]
        }
      ]
    });

    // Update settings
    let settings = await settingsManager.getSettings(interaction.guild!.id);
    if (!settings) {
      settings = {};
    }

    settings.ticket_category_id = ticketCategory?.id;
    settings.ticket_panel_channel_id = ticketChannel.id;
    settings.ticket_logs_channel_id = ticketLogsChannel.id;

    await settingsManager.updateSettings(interaction.guild!.id, settings);

    // Create ticket panel embed
    const ticketEmbed = new EmbedBuilder()
      .setTitle('🎫 Support Tickets')
      .setDescription('Need help? Have a question? Want to report something? Create a ticket and our staff team will assist you as soon as possible.')
      .setColor(Colors.PRIMARY)
      .addFields([
        { name: 'How to Create a Ticket', value: 'Click the button below to create a new support ticket.' },
        { name: 'Available Categories', value: ticketCategories.map(c => `${c.emoji} **${c.label}**: ${c.description}`).join('\n') }
      ]);

    // Create ticket button
    const ticketButton = new ButtonBuilder()
      .setCustomId('create_ticket')
      .setLabel('Create Ticket')
      .setStyle(ButtonStyle.Primary)
      .setEmoji('🎫');

    // Create FAQ button
    const faqButton = new ButtonBuilder()
      .setCustomId('show_faq')
      .setLabel('FAQ')
      .setStyle(ButtonStyle.Secondary)
      .setEmoji('❓');

    // Add buttons to the action row
    const row = new ActionRowBuilder<ButtonBuilder>()
      .addComponents(ticketButton, faqButton);

    // Send the ticket panel
    const message = await ticketChannel.send({
      embeds: [ticketEmbed],
      components: [row]
    });

    // Update the message ID in settings
    settings.ticket_panel_message_id = message.id;
    await settingsManager.updateSettings(interaction.guild!.id, settings);

    logInfo('Server Setup', `Set up ticket system in ${interaction.guild!.name}`);
  } catch (error) {
    logError('Server Setup', `Error setting up ticket system: ${error}`);
    throw error;
  }
}

/**
 * Set up logging channels
 */
async function setupLoggingChannels(interaction: ChatInputCommandInteraction, logsCategory: CategoryChannel | null, staffRole: Role | any) {
  try {
    // Create general log channel
    const generalLogChannel = await interaction.guild!.channels.create({
      name: 'general-logs',
      type: ChannelType.GuildText,
      parent: logsCategory?.id,
      permissionOverwrites: [
        {
          id: interaction.guild!.roles.everyone.id,
          deny: [PermissionsBitField.Flags.ViewChannel]
        },
        {
          id: staffRole.id,
          allow: [
            PermissionsBitField.Flags.ViewChannel,
            PermissionsBitField.Flags.ReadMessageHistory
          ],
          deny: [PermissionsBitField.Flags.SendMessages]
        },
        {
          id: interaction.client.user!.id,
          allow: [
            PermissionsBitField.Flags.ViewChannel,
            PermissionsBitField.Flags.SendMessages,
            PermissionsBitField.Flags.ManageMessages
          ]
        }
      ]
    });

    // Create moderation log channel
    const modLogChannel = await interaction.guild!.channels.create({
      name: 'mod-logs',
      type: ChannelType.GuildText,
      parent: logsCategory?.id,
      permissionOverwrites: [
        {
          id: interaction.guild!.roles.everyone.id,
          deny: [PermissionsBitField.Flags.ViewChannel]
        },
        {
          id: staffRole.id,
          allow: [
            PermissionsBitField.Flags.ViewChannel,
            PermissionsBitField.Flags.ReadMessageHistory
          ],
          deny: [PermissionsBitField.Flags.SendMessages]
        },
        {
          id: interaction.client.user!.id,
          allow: [
            PermissionsBitField.Flags.ViewChannel,
            PermissionsBitField.Flags.SendMessages,
            PermissionsBitField.Flags.ManageMessages
          ]
        }
      ]
    });

    // Create message log channel
    const messageLogChannel = await interaction.guild!.channels.create({
      name: 'message-logs',
      type: ChannelType.GuildText,
      parent: logsCategory?.id,
      permissionOverwrites: [
        {
          id: interaction.guild!.roles.everyone.id,
          deny: [PermissionsBitField.Flags.ViewChannel]
        },
        {
          id: staffRole.id,
          allow: [
            PermissionsBitField.Flags.ViewChannel,
            PermissionsBitField.Flags.ReadMessageHistory
          ],
          deny: [PermissionsBitField.Flags.SendMessages]
        },
        {
          id: interaction.client.user!.id,
          allow: [
            PermissionsBitField.Flags.ViewChannel,
            PermissionsBitField.Flags.SendMessages,
            PermissionsBitField.Flags.ManageMessages
          ]
        }
      ]
    });

    // Create member log channel
    const memberLogChannel = await interaction.guild!.channels.create({
      name: 'member-logs',
      type: ChannelType.GuildText,
      parent: logsCategory?.id,
      permissionOverwrites: [
        {
          id: interaction.guild!.roles.everyone.id,
          deny: [PermissionsBitField.Flags.ViewChannel]
        },
        {
          id: staffRole.id,
          allow: [
            PermissionsBitField.Flags.ViewChannel,
            PermissionsBitField.Flags.ReadMessageHistory
          ],
          deny: [PermissionsBitField.Flags.SendMessages]
        },
        {
          id: interaction.client.user!.id,
          allow: [
            PermissionsBitField.Flags.ViewChannel,
            PermissionsBitField.Flags.SendMessages,
            PermissionsBitField.Flags.ManageMessages
          ]
        }
      ]
    });

    // Update settings
    let settings = await settingsManager.getSettings(interaction.guild!.id);
    if (!settings) {
      settings = {};
    }

    settings.log_channel_id = generalLogChannel.id;
    settings.mod_log_channel_id = modLogChannel.id;
    settings.message_log_channel_id = messageLogChannel.id;
    settings.member_log_channel_id = memberLogChannel.id;
    settings.log_all_commands = true;

    await settingsManager.updateSettings(interaction.guild!.id, settings);

    // Send information messages to the mod log channel
    // Send information messages to the mod log channel
    const rulesInfoEmbed = new EmbedBuilder()
      .setTitle('ℹ️ Customizing Rules')
      .setDescription('Staff members can customize these rules using the `/rules-manager` command. You can add, edit, or remove rules as needed.')
      .setColor(Colors.INFO)
      .setTimestamp();

    const welcomeInfoEmbed = new EmbedBuilder()
      .setTitle('👋 Welcome Messages')
      .setDescription('The bot will automatically send welcome messages when new members join. You can customize the welcome message using the `/setup-welcome` command.')
      .setColor(Colors.INFO)
      .setTimestamp();

    // Send both messages to the mod log channel only
    await modLogChannel.send({ embeds: [rulesInfoEmbed] });
    await modLogChannel.send({ embeds: [welcomeInfoEmbed] });
    
    logInfo('Server Setup', `Set up logging channels in ${interaction.guild!.name}`);
    return { modLogChannel, memberLogChannel, messageLogChannel, generalLogChannel };
  } catch (error) {
    logError('Server Setup', `Error setting up logging channels: ${error}`);
    throw error;
  }
}

/**
 * Set up language preference for the server
 */
async function setupLanguage(interaction: ChatInputCommandInteraction, language: Language) {
  try {
    // Set the guild language
    await setGuildLanguage(interaction.guild!.id, language);
    
    logInfo('Server Setup', `Set server language to ${language} for ${interaction.guild!.name}`);
  } catch (error) {
    logError('Server Setup', `Error setting server language: ${error}`);
    throw error;
  }
}

/**
 * Set up verification system
 * @param interaction The interaction
 * @param staffRole The staff role
 * @param verificationType Optional verification type to use
 */
async function setupVerificationSystem(interaction: ChatInputCommandInteraction, staffRole: Role, verificationType?: string): Promise<void> {
  try {
    // Create verification channel
    const verificationChannel = await interaction.guild!.channels.create({
      name: 'verification',
      type: ChannelType.GuildText,
      permissionOverwrites: [
        {
          id: interaction.guild!.roles.everyone.id,
          allow: [
            PermissionsBitField.Flags.ViewChannel,
            PermissionsBitField.Flags.ReadMessageHistory
          ],
          deny: [
            PermissionsBitField.Flags.SendMessages
          ]
        },
        {
          id: staffRole.id,
          allow: [
            PermissionsBitField.Flags.ViewChannel,
            PermissionsBitField.Flags.ReadMessageHistory,
            PermissionsBitField.Flags.SendMessages,
            PermissionsBitField.Flags.ManageMessages
          ]
        },
        {
          id: interaction.client.user!.id,
          allow: [
            PermissionsBitField.Flags.ViewChannel,
            PermissionsBitField.Flags.SendMessages,
            PermissionsBitField.Flags.ManageMessages
          ]
        }
      ]
    });
    
    // Create verified role
    const verifiedRole = await interaction.guild!.roles.create({
      name: 'Verified',
      color: 0x2ecc71,
      reason: 'Role for verified members'
    });
    
    // Determine verification type
    let verType = VerificationType.BUTTON; // Default to button verification
    
    if (verificationType) {
      switch (verificationType) {
        case 'captcha':
          verType = VerificationType.CAPTCHA;
          break;
        case 'custom_question':
          verType = VerificationType.CUSTOM_QUESTION;
          break;
        case 'age_verification':
          verType = VerificationType.AGE_VERIFICATION;
          break;
        default:
          verType = VerificationType.BUTTON;
      }
    }
    
    // Set up verification settings
    const settings: any = {
      enabled: true,
      type: verType,
      role_id: verifiedRole.id,
      channel_id: verificationChannel.id
    };
    
    // Create verification message
    const messageId = await createVerificationMessage(verificationChannel.id, interaction.guild!.id, settings);
    
    if (!messageId) {
      await interaction.editReply('Failed to create verification message. Please try again.');
      return;
    }
    
    // Save message ID
    settings.message_id = messageId;
    
    // Save settings
    await saveVerificationSettings(interaction.guild!.id, settings);
    
    // Format the current time for the footer
    const now = new Date();
    const timeString = `${now.getHours()}:${now.getMinutes().toString().padStart(2, '0')}`;
    
    // Send info to mod log channel
    try {
      // Get settings to find log channel
      const serverSettings = await settingsManager.getSettings(interaction.guild!.id);
      
      if (serverSettings && serverSettings.mod_log_channel_id) {
        const logChannel = await interaction.guild!.channels.fetch(serverSettings.mod_log_channel_id) as TextChannel;
        
        if (logChannel && logChannel.isTextBased()) {
          const infoEmbed = new EmbedBuilder()
            .setColor(Colors.INFO)
            .setTitle('🔒 Verification System Setup')
            .setDescription('The verification system has been set up. Members will need to verify before accessing the server.')
            .addFields([
              { name: 'Verification Channel', value: `<#${verificationChannel.id}>`, inline: true },
              { name: 'Verified Role', value: `<@&${verifiedRole.id}>`, inline: true },
              { name: 'Verification Type', value: getVerificationTypeName(verType), inline: true },
              { name: 'Next Steps', value: 'Use `/verification-setup` to customize verification settings.' }
            ])
            .setFooter({ text: `Coded by IdanMR • Today at ${timeString}` });
          
          await logChannel.send({ embeds: [infoEmbed] });
        }
      }
    } catch (error) {
      console.error('Error sending verification info to log channel:', error);
    }
    
    logInfo('Server Setup', `Set up verification system in ${interaction.guild!.name}`);
    
    // Don't return anything (void function)
  } catch (error) {
    logError('Server Setup', `Error setting up verification system: ${error}`);
    throw error;
  }
}

/**
 * Set up welcome system
 * @param skipMessages If true, don't send welcome messages (used when verification is enabled)
 */
async function setupWelcomeSystem(interaction: ChatInputCommandInteraction, skipMessages: boolean = false) {
  try {
    // Create welcome channel
    const welcomeChannel = await interaction.guild!.channels.create({
      name: 'welcome',
      type: ChannelType.GuildText,
      permissionOverwrites: [
        {
          id: interaction.guild!.roles.everyone.id,
          allow: [
            PermissionsBitField.Flags.ViewChannel,
            PermissionsBitField.Flags.ReadMessageHistory
          ],
          deny: [
            PermissionsBitField.Flags.SendMessages
          ]
        },
        {
          id: interaction.client.user!.id,
          allow: [
            PermissionsBitField.Flags.ViewChannel,
            PermissionsBitField.Flags.SendMessages,
            PermissionsBitField.Flags.ManageMessages
          ]
        }
      ]
    });

    // Set up welcome message
    const welcomeMessage = `Welcome to {server}! We're glad to have you here.\n\nPlease read our rules and enjoy your stay!\n\nIf you need help, feel free to create a ticket in the <#${interaction.guild!.channels.cache.find(c => c.name === 'create-ticket')?.id}> channel.`;

    // Update settings
    let settings = await settingsManager.getSettings(interaction.guild!.id);
    if (!settings) {
      settings = {};
    }

    settings.welcome_channel_id = welcomeChannel.id;
    settings.welcome_message = welcomeMessage;

    await settingsManager.updateSettings(interaction.guild!.id, settings);

    // Send welcome channel setup message only if skipMessages is false
    if (!skipMessages) {
      const welcomeEmbed = new EmbedBuilder()
        .setTitle('👋 Welcome Channel')
        .setDescription('This channel will be used to welcome new members to the server.')
        .setColor(Colors.INFO)
        .addFields(
          { name: 'Default Message', value: welcomeMessage.replace('{server}', interaction.guild!.name) },
          { name: 'Customization', value: 'You can customize the welcome message using the `/setwelcome` command.' }
        );

      await welcomeChannel.send({ embeds: [welcomeEmbed] });
    } else {
      logInfo('Server Setup', `Skipping welcome messages due to verification being enabled in ${interaction.guild!.name}`);
    }

    logInfo('Server Setup', `Set up welcome system in ${interaction.guild!.name}`);
  } catch (error) {
    logError('Server Setup', `Error setting up welcome system: ${error}`);
    throw error;
  }
}

/**
 * Set up member events system with welcome and leave messages and member count tracking
 */
export async function setupMemberEventsSystem(interaction: ChatInputCommandInteraction): Promise<void> {
  try {
    // Create welcome and leave channels in a category if they don't exist
    const guild = interaction.guild!;
    
    // Create or get the community category
    let communityCategory = guild.channels.cache.find(channel => 
      channel.type === ChannelType.GuildCategory && channel.name.toLowerCase() === 'community'
    ) as CategoryChannel;
    
    if (!communityCategory) {
      communityCategory = await guild.channels.create({
        name: 'COMMUNITY',
        type: ChannelType.GuildCategory,
      });
      logInfo('Server Setup', `Created community category in ${guild.name}`);
    }
    
    // Create welcome channel if it doesn't exist
    let welcomeChannel = guild.channels.cache.find(channel => 
      channel.type === ChannelType.GuildText && channel.name.toLowerCase() === 'welcome'
    ) as TextChannel;
    
    if (!welcomeChannel) {
      welcomeChannel = await guild.channels.create({
        name: 'welcome',
        type: ChannelType.GuildText,
        parent: communityCategory.id
      });
      logInfo('Server Setup', `Created welcome channel in ${guild.name}`);
    } else if (welcomeChannel.parentId !== communityCategory.id) {
      // Move the channel to the community category if it's not already there
      await welcomeChannel.setParent(communityCategory.id);
      logInfo('Server Setup', `Moved welcome channel to community category in ${guild.name}`);
    }
    
    // Create leave channel if it doesn't exist
    let leaveChannel = guild.channels.cache.find(channel => 
      channel.type === ChannelType.GuildText && channel.name.toLowerCase() === 'goodbye'
    ) as TextChannel;
    
    if (!leaveChannel) {
      leaveChannel = await guild.channels.create({
        name: 'goodbye',
        type: ChannelType.GuildText,
        parent: communityCategory.id
      });
      logInfo('Server Setup', `Created goodbye channel in ${guild.name}`);
    } else if (leaveChannel.parentId !== communityCategory.id) {
      // Move the channel to the community category if it's not already there
      await leaveChannel.setParent(communityCategory.id);
      logInfo('Server Setup', `Moved goodbye channel to community category in ${guild.name}`);
    }
    
    // Create default welcome and leave messages
    const welcomeMessage = 'Welcome to the server, {user}! We hope you enjoy your stay here!';
    const leaveMessage = 'Goodbye {user}! We hope to see you again soon!';
    
    // Set up member events
    await configureMemberEvents(
      guild.id,
      welcomeChannel.id,
      leaveChannel.id,
      welcomeMessage,
      leaveMessage,
      true // Enable member count tracking
    );
    
    // Get settings to find member logs channel
    const settings = await settingsManager.getSettings(guild.id);
    let memberLogsChannel: TextChannel | null = null;
    
    // Try to get the member logs channel - this is where we should send the configuration info
    if (settings && settings.member_log_channel_id) {
      try {
        memberLogsChannel = await guild.channels.fetch(settings.member_log_channel_id) as TextChannel;
      } catch (error) {
        logError('Server Setup', `Error fetching member logs channel: ${error}`);
      }
    }
    
    // Prepare configuration embeds
    const welcomeEmbed = new EmbedBuilder()
      .setColor(Colors.SUCCESS)
      .setTitle('👋 Member Welcome Configuration')
      .setDescription('This channel will show welcome messages for new members joining the server.')
      .addFields([
        { name: 'Default Message', value: welcomeMessage.replace('{user}', '@member') },
        { name: 'Customization', value: 'You can customize the welcome messages using the `/setup-member-events` command.' }
      ])
      .setFooter({ text: '• Made By Soggra' });
    
    const leaveEmbed = new EmbedBuilder()
      .setColor(Colors.ERROR)
      .setTitle('👋 Member Leave Configuration')
      .setDescription('This channel will show messages when members leave the server.')
      .addFields([
        { name: 'Default Message', value: leaveMessage.replace('{user}', '@member') },
        { name: 'Customization', value: 'You can customize the leave messages using the `/setup-member-events` command.' }
      ])
      .setFooter({ text: '• Made By Soggra' });
    
    // Send config messages to the member logs channel if available, otherwise to welcome/leave channels
    if (memberLogsChannel) {
      try {
        // Send both configuration messages to member logs
        await memberLogsChannel.send({ embeds: [welcomeEmbed] });
        await memberLogsChannel.send({ embeds: [leaveEmbed] });
        logInfo('Server Setup', `Sent member events configuration to member logs channel in ${guild.name}`);
      } catch (error) {
        logError('Server Setup', `Error sending to member logs channel: ${error}`);
        
        // Fall back to sending to welcome/leave channels if member logs fails
        await welcomeChannel.send({ embeds: [welcomeEmbed] });
        await leaveChannel.send({ embeds: [leaveEmbed] });
      }
    } else {
      // No member logs channel, so send to individual welcome/leave channels
      await welcomeChannel.send({ embeds: [welcomeEmbed] });
      await leaveChannel.send({ embeds: [leaveEmbed] });
    }
    
    logInfo('Server Setup', `Set up member events system in ${guild.name}`);
  } catch (error) {
    logError('Server Setup', `Error setting up member events system: ${error}`);
    throw error;
  }
}

/**
 * Helper function to get the verification type name
 * @param type The verification type
 * @returns The verification type name
 */
function getVerificationTypeName(type: VerificationType): string {
  switch (type) {
    case VerificationType.BUTTON:
      return 'Button Verification';
    case VerificationType.CAPTCHA:
      return 'CAPTCHA Verification';
    case VerificationType.CUSTOM_QUESTION:
      return 'Custom Question Verification';
    case VerificationType.AGE_VERIFICATION:
      return 'Age Verification';
    default:
      return 'Button Verification';
  }
}

/**
 * Set up rules channel with default rules
 * @param skipMessages If true, don't send welcome messages (used when verification is enabled)
 */
export async function setupRulesChannel(interaction: ChatInputCommandInteraction, staffRole: Role, skipMessages: boolean = false) {
  try {
    // Create rules channel
    const rulesChannel = await interaction.guild!.channels.create({
      name: 'rules',
      type: ChannelType.GuildText,
      permissionOverwrites: [
        {
          id: interaction.guild!.roles.everyone.id,
          allow: [
            PermissionsBitField.Flags.ViewChannel,
            PermissionsBitField.Flags.ReadMessageHistory
          ],
          deny: [
            PermissionsBitField.Flags.SendMessages
          ]
        },
        {
          id: staffRole.id,
          allow: [
            PermissionsBitField.Flags.ViewChannel,
            PermissionsBitField.Flags.ReadMessageHistory,
            PermissionsBitField.Flags.SendMessages
          ]
        },
        {
          id: interaction.client.user!.id,
          allow: [
            PermissionsBitField.Flags.ViewChannel,
            PermissionsBitField.Flags.SendMessages,
            PermissionsBitField.Flags.ManageMessages
          ]
        }
      ]
    });

    // Update settings
    let settings = await settingsManager.getSettings(interaction.guild!.id);
    if (!settings) {
      settings = {};
    }

    settings.rules_channel_id = rulesChannel.id;
    await settingsManager.updateSettings(interaction.guild!.id, settings);

    // Format the current time for the footer
    const now = new Date();
    const timeString = `${now.getHours()}:${now.getMinutes().toString().padStart(2, '0')}`;

    // Only send messages if skipMessages is false
    if (!skipMessages) {
      // Create default rules embed
      const rulesHeaderEmbed = new EmbedBuilder()
        .setTitle('📜 Server Rules')
        .setDescription(`Welcome to ${interaction.guild!.name}! To ensure everyone has a positive experience, please follow these rules:`)
        .setColor(Colors.INFO)
        .setFooter({ text: `Coded by IdanMR • Today at ${timeString}` });

      // Add server icon if available
      if (interaction.guild!.iconURL()) {
        rulesHeaderEmbed.setThumbnail(interaction.guild!.iconURL());
      }

      // Default rules
      const defaultRules = [
        {
          title: 'Be Respectful',
          description: 'Treat all members with respect. Harassment, hate speech, discrimination, or bullying will not be tolerated.'
        },
        {
          title: 'No Inappropriate Content',
          description: 'Do not post NSFW, illegal, or offensive content in any channel.'
        },
        {
          title: 'No Spamming',
          description: 'Avoid sending repeated messages, excessive mentions, or flooding channels with messages.'
        },
        {
          title: 'Follow Discord\'s Terms',
          description: 'Adhere to Discord\'s Terms of Service and Community Guidelines at all times.'
        },
        {
          title: 'Use Appropriate Channels',
          description: 'Post content in the relevant channels. Keep discussions on-topic.'
        }
      ];

      // Send header embed
      await rulesChannel.send({ embeds: [rulesHeaderEmbed] });

      // Send each rule as a separate embed
      for (let i = 0; i < defaultRules.length; i++) {
        const rule = defaultRules[i];
        const ruleEmbed = new EmbedBuilder()
          .setTitle(`Rule ${i + 1}: ${rule.title}`)
          .setDescription(rule.description)
          .setColor(Colors.INFO);

        await rulesChannel.send({ embeds: [ruleEmbed] });
      }

      // Send info about customization
      const customizationEmbed = new EmbedBuilder()
        .setTitle('ℹ️ Customizing Rules')
        .setDescription('Staff members can customize these rules using the `/rules-manager` command. You can add, edit, or remove rules as needed.')
        .setColor(Colors.INFO);

      await rulesChannel.send({ embeds: [customizationEmbed] });
    } else {
      logInfo('Server Setup', `Skipping rules messages due to verification being enabled in ${interaction.guild!.name}`);
    }

    logInfo('Server Setup', `Set up rules channel in ${interaction.guild!.name}`);
  } catch (error) {
    logError('Server Setup', `Error setting up rules channel: ${error}`);
    throw error;
  }
}

// Add helper function for staff role creation
async function createStaffRole(interaction: ChatInputCommandInteraction): Promise<Role> {
  // Check if staff role already exists
  let staffRole = interaction.guild!.roles.cache.find(role => role.name === 'Staff');
  
  if (!staffRole) {
    // Create staff role
    staffRole = await interaction.guild!.roles.create({
      name: 'Staff',
      color: '#5865F2',
      reason: 'Server setup - create staff role',
      permissions: [
        PermissionsBitField.Flags.ManageMessages,
        PermissionsBitField.Flags.KickMembers,
        PermissionsBitField.Flags.ModerateMembers
      ]
    });
    logInfo('Server Setup', `Created Staff role in ${interaction.guild!.name}`);
  }
  
  return staffRole;
}

// Add helper function for logs category creation
async function createLogsCategory(interaction: ChatInputCommandInteraction): Promise<CategoryChannel> {
  // Check if logs category already exists
  let logsCategory = interaction.guild!.channels.cache.find(
    channel => channel.type === ChannelType.GuildCategory && channel.name.toLowerCase() === 'logs'
  ) as CategoryChannel;
  
  if (!logsCategory) {
    // Create logs category
    logsCategory = await interaction.guild!.channels.create({
      name: 'Logs',
      type: ChannelType.GuildCategory,
      permissionOverwrites: [
        {
          id: interaction.guild!.roles.everyone.id,
          deny: [PermissionsBitField.Flags.ViewChannel]
        },
        {
          id: interaction.client.user!.id,
          allow: [
            PermissionsBitField.Flags.ViewChannel,
            PermissionsBitField.Flags.SendMessages,
            PermissionsBitField.Flags.ManageMessages
          ]
        }
      ]
    });
    logInfo('Server Setup', `Created Logs category in ${interaction.guild!.name}`);
  }
  
  return logsCategory;
}

/**
 * Set up invite tracking system
 */
async function setupInviteTrackingSystem(interaction: ChatInputCommandInteraction): Promise<void> {
  try {
    // Get current server settings
    const settings = await settingsManager.getSettings(interaction.guild!.id);
    
    // Check if member logs exist, which is required for invite tracking
    if (!settings || !settings.member_log_channel_id) {
      logWarning('Server Setup', `No member logs channel found. Setting up logging channels first.`);
      
      // Set up logging channels if they don't exist
      if (!settings || !settings.member_log_channel_id) {
        // Create or get the logs category
        let logsCategory = interaction.guild!.channels.cache.find(channel => 
          channel.type === ChannelType.GuildCategory && channel.name.toLowerCase() === 'logs'
        ) as CategoryChannel;
        
        if (!logsCategory) {
          logsCategory = await interaction.guild!.channels.create({
            name: 'LOGS',
            type: ChannelType.GuildCategory,
          });
          logInfo('Server Setup', `Created logs category in ${interaction.guild!.name}`);
        }
        
        // Create the member logs channel
        const memberLogsChannel = await interaction.guild!.channels.create({
          name: 'member-logs',
          type: ChannelType.GuildText,
          parent: logsCategory.id,
          permissionOverwrites: [
            {
              id: interaction.guild!.roles.everyone.id,
              deny: [PermissionsBitField.Flags.ViewChannel]
            },
            {
              id: interaction.client.user!.id,
              allow: [
                PermissionsBitField.Flags.ViewChannel,
                PermissionsBitField.Flags.SendMessages,
                PermissionsBitField.Flags.ManageMessages
              ]
            }
          ]
        });
        
        // Update settings with member logs channel
        await settingsManager.updateSettings(interaction.guild!.id, {
          member_log_channel_id: memberLogsChannel.id
        });
        
        logInfo('Server Setup', `Created member logs channel for invite tracking in ${interaction.guild!.name}`);
      }
    }
    
    // Ensure the database has the required table
    db.prepare(`
      CREATE TABLE IF NOT EXISTS invite_tracking (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        guild_id TEXT NOT NULL,
        user_id TEXT NOT NULL,
        invite_code TEXT,
        inviter TEXT,
        inviter_id TEXT,
        joined_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `).run();
    
    // Send example invite tracking logs to the member logs channel
    const { sendInviteTrackingExamples } = await import('../../handlers/invites/invite-tracker');
    await sendInviteTrackingExamples(interaction.guild!.id);
    
    logInfo('Server Setup', `Set up invite tracking system in ${interaction.guild!.name}`);
  } catch (error) {
    logError('Server Setup', `Error setting up invite tracking system: ${error}`);
    throw error;
  }
}
