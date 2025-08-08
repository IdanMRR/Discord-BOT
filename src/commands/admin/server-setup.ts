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
  PermissionsBitField,
  Role,
  MessageFlags
} from 'discord.js';
import { Colors, createSuccessEmbed, createErrorEmbed } from '../../utils/embeds';
import { logInfo, logError } from '../../utils/logger';
import { ServerSettingsService } from '../../database/services/serverSettingsService';

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
  .addStringOption(option =>
    option.setName('verification_type')
      .setDescription('Type of verification system to set up')
      .setRequired(false)
      .addChoices(
        { name: 'None - No verification required', value: 'none' },
        { name: 'Button - Simple button verification', value: 'button' },
        { name: 'Captcha - Math captcha verification', value: 'captcha' },
        { name: 'Role - Manual role assignment', value: 'role' }
      )
  );

export async function execute(interaction: ChatInputCommandInteraction) {
  // IMMEDIATELY defer the reply to prevent timeout - this is critical
  try {
    await interaction.deferReply({ flags: MessageFlags.Ephemeral });
  } catch (error) {
    console.error('[Server Setup] Failed to defer reply:', error);
    return;
  }

  try {
    // Permission check
    if (!interaction.memberPermissions?.has(PermissionFlagsBits.Administrator)) {
      await interaction.editReply({
        content: '❌ You need Administrator permissions to use this command.'
      });
      return;
    }

    // Get options
    const staffRole = interaction.options.getRole('staff_role') as Role;
    const setupAll = interaction.options.getBoolean('setup_all') ?? true;
    const verificationType = interaction.options.getString('verification_type') ?? 'none';

    // Note: Command logging is handled globally by index.ts

    // Get or create server settings
    let settings = await ServerSettingsService.getOrCreate(interaction.guild!.id, interaction.guild!.name);
    if (!settings) {
      await interaction.editReply({
        content: '❌ Failed to initialize server settings. Please try again.'
      });
      return;
    }

    let successMessages: string[] = [];
    
    // 1. Save staff role
    const staffRoleUpdate = await ServerSettingsService.updateSettings(interaction.guild!.id, {
      staff_role_ids: [staffRole.id]
    });
    
    if (staffRoleUpdate) {
      successMessages.push('✅ Staff role configured');
    } else {
      successMessages.push('❌ Failed to save staff role');
    }

    if (setupAll) {
      // 2. Create categories
      const { ticketCategory, logsCategory } = await createCategories(interaction, staffRole);
      if (ticketCategory && logsCategory) {
      successMessages.push('✅ Categories created');
    }
    
      // 3. Set up ticket system
      const ticketResult = await setupTicketSystem(interaction, ticketCategory, staffRole);
      if (ticketResult) {
        successMessages.push('✅ Ticket system configured');
      } else {
        successMessages.push('❌ Failed to set up ticket system');
      }

      // 4. Set up logging channels
      const logsResult = await setupLoggingChannels(interaction, logsCategory, staffRole);
      if (logsResult) {
        successMessages.push('✅ Logging channels configured');
      } else {
        successMessages.push('❌ Failed to set up logging channels');
      }

      // 5. Set up welcome system
      const welcomeResult = await setupWelcomeSystem(interaction);
      if (welcomeResult) {
        successMessages.push('✅ Welcome system configured');
      } else {
        successMessages.push('❌ Failed to set up welcome system');
      }

      // 6. Set up verification system
      if (verificationType !== 'none') {
        const verificationResult = await setupVerificationSystem(interaction, verificationType, staffRole);
        if (verificationResult) {
          successMessages.push(`✅ ${getVerificationTypeName(verificationType)} verification configured`);
      } else {
          successMessages.push(`❌ Failed to set up ${getVerificationTypeName(verificationType)} verification`);
        }
      }
    }

    // Create final response embed
    const finalEmbed = new EmbedBuilder()
      .setTitle('🚀 Server Setup Complete')
      .setDescription(successMessages.join('\n'))
      .setColor(Colors.SUCCESS)
      .setFooter({ text: 'Made by Soggra.' })
      .setTimestamp();

    await interaction.editReply({ embeds: [finalEmbed] });

    logInfo('Server Setup', `Server setup completed for ${interaction.guild!.name}`);

  } catch (error) {
    logError('Server Setup', `Error in server setup: ${error}`);
    
    try {
      const errorEmbed = createErrorEmbed(
        'Setup Failed',
        `An error occurred during server setup: ${error}`
      );
      
      await interaction.editReply({ embeds: [errorEmbed] });
    } catch (editError) {
      console.error('[Server Setup] Failed to send error message:', editError);
    }
    
    // Note: Error logging is handled globally by index.ts
  }
}

async function createCategories(interaction: ChatInputCommandInteraction, staffRole: Role) {
  try {
    // Create TICKETS category
    const ticketCategory = await interaction.guild!.channels.create({
      name: 'TICKETS',
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
            PermissionsBitField.Flags.ManageChannels,
                    PermissionsBitField.Flags.ManageMessages
                ]
              },
              {
                id: interaction.client.user!.id,
                allow: [
                  PermissionsBitField.Flags.ViewChannel,
            PermissionsBitField.Flags.ManageChannels,
                  PermissionsBitField.Flags.ManageMessages
                ]
              }
            ]
          });
          
    // Create LOGS category
    const logsCategory = await interaction.guild!.channels.create({
      name: 'LOGS',
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

    logInfo('Server Setup', `Created categories in ${interaction.guild!.name}`);
    return { ticketCategory, logsCategory };

  } catch (error) {
    logError('Server Setup', `Error creating categories: ${error}`);
    return { ticketCategory: null, logsCategory: null };
  }
}

async function setupTicketSystem(interaction: ChatInputCommandInteraction, ticketCategory: CategoryChannel | null, staffRole: Role): Promise<boolean> {
  try {
    // Create ticket panel channel
    const ticketPanelChannel = await interaction.guild!.channels.create({
      name: 'create-ticket',
      type: ChannelType.GuildText,
      parent: ticketCategory?.id,
      permissionOverwrites: [
        {
          id: interaction.guild!.roles.everyone.id,
          allow: [PermissionsBitField.Flags.ViewChannel, PermissionsBitField.Flags.ReadMessageHistory],
          deny: [PermissionsBitField.Flags.SendMessages]
        },
        {
          id: staffRole.id,
          allow: [
            PermissionsBitField.Flags.ViewChannel,
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

    // Create ticket logs channel
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

    // Create ticket panel message
    const ticketEmbed = new EmbedBuilder()
      .setTitle('🎫 Support Tickets')
      .setDescription('Need help? Create a support ticket by clicking the button below!')
      .setColor(Colors.PRIMARY)
      .setFooter({ text: 'Made by Soggra.' });

    const ticketRow = new ActionRowBuilder<ButtonBuilder>()
      .addComponents(
        new ButtonBuilder()
      .setCustomId('create_ticket')
      .setLabel('Create Ticket')
      .setStyle(ButtonStyle.Primary)
          .setEmoji('🎫')
      );

    const message = await ticketPanelChannel.send({
      embeds: [ticketEmbed],
      components: [ticketRow]
    });

    // Update settings with ticket system configuration
    const ticketUpdates = {
      ticket_category_id: ticketCategory?.id,
      ticket_panel_channel_id: ticketPanelChannel.id,
      ticket_panel_message_id: message.id,
      ticket_logs_channel_id: ticketLogsChannel.id
    };

    console.log(`[TICKET SETUP DEBUG] Ticket category ID: ${ticketCategory?.id}`);
    console.log(`[TICKET SETUP DEBUG] Ticket updates object:`, JSON.stringify(ticketUpdates, null, 2));

    const updateResult = await ServerSettingsService.updateSettings(interaction.guild!.id, ticketUpdates);
    console.log(`[TICKET SETUP DEBUG] Update result: ${updateResult}`);
    
    if (updateResult) {
      // Verify the settings were saved
      const verifySettings = await ServerSettingsService.getServerSettings(interaction.guild!.id);
      console.log(`[TICKET SETUP DEBUG] Verified settings:`, JSON.stringify(verifySettings, null, 2));

    logInfo('Server Setup', `Set up ticket system in ${interaction.guild!.name}`);
      return true;
    } else {
      logError('Server Setup', `Failed to save ticket system settings for ${interaction.guild!.name}`);
      return false;
    }

  } catch (error) {
    logError('Server Setup', `Error setting up ticket system: ${error}`);
    return false;
  }
}

async function setupLoggingChannels(interaction: ChatInputCommandInteraction, logsCategory: CategoryChannel | null, staffRole: Role): Promise<boolean> {
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

    // Update settings with logging channels
    const logChannelUpdates = {
      log_channel_id: generalLogChannel.id,
      mod_log_channel_id: modLogChannel.id,
      message_log_channel_id: messageLogChannel.id,
      member_log_channel_id: memberLogChannel.id,
      log_all_commands: true
    };

    const updateResult = await ServerSettingsService.updateSettings(interaction.guild!.id, logChannelUpdates);
    
    if (updateResult) {
    logInfo('Server Setup', `Set up logging channels in ${interaction.guild!.name}`);
      return true;
    } else {
      logError('Server Setup', `Failed to save logging channel settings for ${interaction.guild!.name}`);
      return false;
    }

  } catch (error) {
    logError('Server Setup', `Error setting up logging channels: ${error}`);
    return false;
  }
}

async function setupWelcomeSystem(interaction: ChatInputCommandInteraction): Promise<boolean> {
  try {
    // Create community category
    const communityCategory = await interaction.guild!.channels.create({
      name: 'COMMUNITY',
      type: ChannelType.GuildCategory,
      permissionOverwrites: [
        {
          id: interaction.guild!.roles.everyone.id,
          allow: [PermissionsBitField.Flags.ViewChannel, PermissionsBitField.Flags.ReadMessageHistory],
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

    // Create welcome channel
    const welcomeChannel = await interaction.guild!.channels.create({
      name: 'welcome',
      type: ChannelType.GuildText,
      parent: communityCategory.id,
      permissionOverwrites: [
        {
          id: interaction.guild!.roles.everyone.id,
          allow: [PermissionsBitField.Flags.ViewChannel, PermissionsBitField.Flags.ReadMessageHistory],
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
    
    // Create goodbye channel
    const goodbyeChannel = await interaction.guild!.channels.create({
      name: 'goodbye',
      type: ChannelType.GuildText,
      parent: communityCategory.id,
      permissionOverwrites: [
        {
          id: interaction.guild!.roles.everyone.id,
          allow: [PermissionsBitField.Flags.ViewChannel, PermissionsBitField.Flags.ReadMessageHistory],
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

    // Update settings with welcome system using proper database fields
    const welcomeUpdates = {
      welcome_channel_id: welcomeChannel.id,
      goodbye_channel_id: goodbyeChannel.id,
      welcome_message: `Welcome to {server}! We're glad to have you here.\n\nPlease read our rules and enjoy your stay!\n\nIf you need help, feel free to create a ticket.`
    };

    const updateResult = await ServerSettingsService.updateSettings(interaction.guild!.id, welcomeUpdates);
    
    if (updateResult) {
    logInfo('Server Setup', `Set up welcome system in ${interaction.guild!.name}`);
      
      // Send welcome message to the welcome channel
    const welcomeEmbed = new EmbedBuilder()
        .setTitle('👋 Welcome System Configured')
        .setDescription('This channel will be used for welcoming new members to the server!')
      .setColor(Colors.SUCCESS)
        .setFooter({ text: 'Made by Soggra.' });
      
      await welcomeChannel.send({ embeds: [welcomeEmbed] });
      
      // Send goodbye message to the goodbye channel
      const goodbyeEmbed = new EmbedBuilder()
        .setTitle('👋 Goodbye System Configured')
        .setDescription('This channel will be used for farewell messages when members leave the server!')
        .setColor(Colors.INFO)
        .setFooter({ text: 'Made by Soggra.' });
      
      await goodbyeChannel.send({ embeds: [goodbyeEmbed] });
      
      return true;
    } else {
      logError('Server Setup', `Failed to save welcome system settings for ${interaction.guild!.name}`);
      return false;
    }
    
  } catch (error) {
    logError('Server Setup', `Error setting up welcome system: ${error}`);
    return false;
  }
}

async function setupVerificationSystem(interaction: ChatInputCommandInteraction, verificationType: string, staffRole: Role): Promise<boolean> {
  try {
    // Create verification channel
    const verificationChannel = await interaction.guild!.channels.create({
      name: 'verification',
      type: ChannelType.GuildText,
      permissionOverwrites: [
        {
          id: interaction.guild!.roles.everyone.id,
          allow: [PermissionsBitField.Flags.ViewChannel, PermissionsBitField.Flags.ReadMessageHistory],
          deny: [PermissionsBitField.Flags.SendMessages]
        },
        {
          id: staffRole.id,
          allow: [
            PermissionsBitField.Flags.ViewChannel,
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
      color: 0x00FF00,
      reason: 'Verification system setup'
    });

    // Create verification embed and button based on type
    let verificationEmbed: EmbedBuilder;
    let verificationRow: ActionRowBuilder<ButtonBuilder>;

    switch (verificationType) {
      case 'button':
        verificationEmbed = new EmbedBuilder()
          .setTitle('🔒 Server Verification')
          .setDescription('Welcome! Please click the button below to verify yourself and gain access to the server.')
          .setColor(Colors.PRIMARY)
          .setFooter({ text: 'Made by Soggra.' });

        verificationRow = new ActionRowBuilder<ButtonBuilder>()
          .addComponents(
            new ButtonBuilder()
              .setCustomId('verify_button')
              .setLabel('Verify')
              .setStyle(ButtonStyle.Success)
              .setEmoji('✅')
          );
        break;

      case 'captcha':
        verificationEmbed = new EmbedBuilder()
          .setTitle('🧮 Captcha Verification')
          .setDescription('Welcome! Please click the button below to solve a captcha and verify yourself.')
          .setColor(Colors.PRIMARY)
          .setFooter({ text: 'Made by Soggra.' });

        verificationRow = new ActionRowBuilder<ButtonBuilder>()
          .addComponents(
            new ButtonBuilder()
              .setCustomId('verify_button')
              .setLabel('Start Captcha')
              .setStyle(ButtonStyle.Primary)
              .setEmoji('🧮')
          );
        break;

      case 'role':
        verificationEmbed = new EmbedBuilder()
          .setTitle('👥 Manual Verification')
          .setDescription('Welcome! Please wait for a staff member to manually verify you and assign your role.')
          .setColor(Colors.INFO)
          .setFooter({ text: 'Made by Soggra.' });

        verificationRow = new ActionRowBuilder<ButtonBuilder>()
          .addComponents(
            new ButtonBuilder()
              .setCustomId('request_verification')
              .setLabel('Request Verification')
              .setStyle(ButtonStyle.Secondary)
              .setEmoji('📝')
          );
        break;

      default:
        return false;
    }

    // Send verification message
    const message = await verificationChannel.send({
      embeds: [verificationEmbed],
      components: [verificationRow]
    });

    // Update server settings with verification configuration
    const verificationUpdates = {
      verification_channel_id: verificationChannel.id,
      verification_message_id: message.id,
      verified_role_id: verifiedRole.id,
      verification_type: verificationType
    };

    const updateResult = await ServerSettingsService.updateSettings(interaction.guild!.id, verificationUpdates);
    
    if (updateResult) {
      logInfo('Server Setup', `Set up ${verificationType} verification in ${interaction.guild!.name}`);
      return true;
    } else {
      logError('Server Setup', `Failed to save verification settings for ${interaction.guild!.name}`);
      return false;
    }

  } catch (error) {
    logError('Server Setup', `Error setting up verification system: ${error}`);
    return false;
  }
}

function getVerificationTypeName(type: string): string {
  switch (type) {
    case 'button': return 'Button';
    case 'captcha': return 'Captcha';
    case 'role': return 'Manual';
    default: return 'Unknown';
  }
} 