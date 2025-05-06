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
        .setTitle(language === 'he' ? '👋 ברוך הבא!' : '👋 Welcome!')
        .setDescription(
          language === 'he'
            ? `ברוך הבא ${member} לשרת ${guild.name}!\nאנחנו שמחים שהצטרפת אלינו!`
            : `Welcome ${member} to ${guild.name}!\nWe're glad to have you here!`
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
        .setTitle(language === 'he' ? '👋 להתראות!' : '👋 Goodbye!')
        .setDescription(
          language === 'he'
            ? `${member.user.tag} עזב את השרת`
            : `${member.user.tag} has left the server`
        )
        .setTimestamp();

      await welcomeChannel.send({ embeds: [goodbyeEmbed] });
      await logInfo('Member Leave', `${member.user.tag} left ${guild.name}`);
    } catch (error) {
      console.error('Error in goodbye event:', error);
    }
  });
};
