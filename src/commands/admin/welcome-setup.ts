import { SlashCommandBuilder, ChatInputCommandInteraction, PermissionFlagsBits, ChannelType, MessageFlags } from 'discord.js';
import { logCommandUsage } from '../../utils/logger';
import { getGuildSettings } from '../../database/sqlite';
import { setupMemberEvents } from '../../handlers/members/member-events';

export const data = new SlashCommandBuilder()
  .setName('welcome-setup')
  .setDescription('Setup the welcome system')
  .setDefaultMemberPermissions(PermissionFlagsBits.Administrator);

export async function execute(interaction: ChatInputCommandInteraction) {
  try {
    const { guild } = interaction;
    if (!guild) return;

    const settings = await getGuildSettings(guild.id);
    const language = settings?.language || 'en';
    
    // Check if welcome channel exists
    let welcomeChannel = guild.channels.cache.find(channel => channel.name === 'welcome');

    if (welcomeChannel) {
      // If welcome channel exists, just connect it to the member events system
      const success = await setupMemberEvents(
        guild.id,
        welcomeChannel.id,
        undefined, // No leave channel
        undefined, // Default welcome message
        undefined, // Default leave message
        true // Show member count
      );

      if (success) {
        await interaction.reply({
          content: language === 'he'
            ? '✅ מערכת הברוכים הבאים עודכנה בהצלחה!'
            : '✅ Welcome system has been updated successfully!',
          flags: MessageFlags.Ephemeral
        });
      } else {
        await interaction.reply({
          content: language === 'he'
            ? '❌ אירעה שגיאה בעדכון מערכת הברוכים הבאים!'
            : '❌ An error occurred while updating the welcome system!',
          flags: MessageFlags.Ephemeral
        });
      }
      return;
    }

    // Create welcome channel
    welcomeChannel = await guild.channels.create({
      name: 'welcome',
      type: ChannelType.GuildText,
      topic: language === 'he'
        ? 'ערוץ ברוכים הבאים אוטומטי'
        : 'Automatic welcome channel'
    });

    // Default welcome message
    const welcomeMessage = 'Welcome to the server, {user}! We hope you enjoy your stay.';
    
    // Connect the new welcome channel to the member events system
    const success = await setupMemberEvents(
      guild.id,
      welcomeChannel.id,
      undefined, // No leave channel
      welcomeMessage, // Explicit welcome message
      undefined, // Default leave message
      true // Show member count
    );

    if (success) {
      await interaction.reply({
        content: language === 'he'
          ? '✅ מערכת הברוכים הבאים הוגדרה בהצלחה!'
          : '✅ Welcome system has been set up successfully!',
        flags: MessageFlags.Ephemeral
      });
    } else {
      await interaction.reply({
        content: language === 'he'
          ? '❌ אירעה שגיאה בהגדרת מערכת הברוכים הבאים!'
          : '❌ An error occurred while setting up the welcome system!',
        flags: MessageFlags.Ephemeral
      });
    }

    if (interaction.guild) {
      await logCommandUsage({
        command: 'welcome-setup',
        guild: interaction.guild,
        user: interaction.user,
        channel: interaction.channel,
        success: true
      });
    }
  } catch (error) {
    console.error('Error in welcome-setup command:', error);
    await interaction.reply({
      content: '❌ An error occurred while setting up the welcome system.',
      flags: MessageFlags.Ephemeral
    });
    if (interaction.guild) {
      await logCommandUsage({
        command: 'welcome-setup',
        guild: interaction.guild,
        user: interaction.user,
        channel: interaction.channel,
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  }
}
