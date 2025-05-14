import { SlashCommandBuilder, ChatInputCommandInteraction, MessageFlags } from 'discord.js';
import { createInfoEmbed } from '../../utils/embeds';

module.exports = {
  data: new SlashCommandBuilder()
    .setName('invite')
    .setDescription('Get an invite link for the bot with proper permissions'),
  
  async execute(interaction: ChatInputCommandInteraction) {
    // Get the client ID from environment
    const clientId = process.env.CLIENT_ID;
    
    if (!clientId) {
      await interaction.reply({ 
        content: 'Error: CLIENT_ID not found in environment variables.', 
        flags: MessageFlags.Ephemeral 
      });
      return;
    }
    
    // Create an invite link with necessary permissions
    const inviteLink = `https://discord.com/api/oauth2/authorize?client_id=${clientId}&permissions=8&scope=bot%20applications.commands`;
    
    const inviteEmbed = createInfoEmbed(
      'Invite Bot',
      'Use the link below to invite the bot to your server with proper permissions:'
    );
    
    inviteEmbed.addFields({ name: 'Invite Link', value: `[Click Here](${inviteLink})` });
    
    await interaction.reply({ embeds: [inviteEmbed], flags: MessageFlags.Ephemeral });
  },
};
