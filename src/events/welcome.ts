import { Client, TextChannel, EmbedBuilder, GuildMember, PartialGuildMember, Events } from 'discord.js';
import { Colors } from '../utils/embeds';
import { logInfo } from '../utils/logger';
import { getGuildSettings } from '../database/sqlite';

export default (client: Client): void => {
  client.on(Events.GuildMemberAdd, async (member) => {
    try {
      const { guild } = member;
      const settings = await getGuildSettings(guild.id);
      const language = settings?.language || 'en';
      const welcomeChannel = guild.channels.cache.find(
        channel => channel.name === 'welcome'
      ) as TextChannel;

      if (!welcomeChannel) {
        console.error(`No welcome channel found in guild ${guild.name}`);
        return;
      }

      const welcomeEmbed = new EmbedBuilder()
        .setColor(Colors.SUCCESS)
        .setTitle('👋 Welcome!')
        .setDescription(
          `Welcome to **${guild.name}**, ${member.user.username}!`
        )
        .setThumbnail(member.user.displayAvatarURL())
        .setTimestamp();

      await welcomeChannel.send({ embeds: [welcomeEmbed] });
      await logInfo('Member Join', `${member.user.tag} joined ${guild.name}`);
    } catch (error) {
      console.error('Error in welcome event:', error);
    }
  });

  client.on(Events.GuildMemberRemove, async (member) => {
    try {
      const { guild } = member;
      const settings = await getGuildSettings(guild.id);
      const language = settings?.language || 'en';
      const welcomeChannel = guild.channels.cache.find(
        channel => channel.name === 'welcome'
      ) as TextChannel;

      if (!welcomeChannel) {
        console.error(`No welcome channel found in guild ${guild.name}`);
        return;
      }

      const goodbyeEmbed = new EmbedBuilder()
        .setColor(Colors.ERROR)
        .setTitle('👋 Goodbye!')
        .setDescription(
          `${member.user.username} has left the server. We hope to see you again soon!`
        )
        .setTimestamp();

      await welcomeChannel.send({ embeds: [goodbyeEmbed] });
      await logInfo('Member Leave', `${member.user.tag} left ${guild.name}`);
    } catch (error) {
      console.error('Error in goodbye event:', error);
    }
  });
};
