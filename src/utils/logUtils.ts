import { Client, TextChannel, EmbedBuilder, ColorResolvable, Message, Guild } from 'discord.js';
import { LogChannelService } from '../database/services/logChannelService';

export interface LogOptions {
  title: string;
  description?: string;
  color?: ColorResolvable;
  fields?: { name: string; value: string; inline?: boolean }[];
  timestamp?: boolean | Date;
  footer?: { text: string; iconURL?: string };
  thumbnail?: string;
  image?: string;
  author?: { name: string; iconURL?: string; url?: string };
}

export async function sendLog(
  client: Client,
  guild: Guild,
  options: LogOptions
): Promise<void> {
  try {
    const channelId = await LogChannelService.getLogChannel(guild.id);
    if (!channelId) return; // No log channel set up

    const channel = (await client.channels.fetch(channelId)) as TextChannel | null;
    if (!channel) {
      console.warn(`Log channel ${channelId} not found in guild ${guild.id}`);
      return;
    }

    const embed = new EmbedBuilder()
      .setTitle(options.title)
      .setColor(options.color || '#3498db');
      
    // Only set timestamp if it's a Date or not provided (default to now)
    if (options.timestamp === undefined || options.timestamp instanceof Date) {
      embed.setTimestamp(options.timestamp || new Date());
    }

    if (options.description) embed.setDescription(options.description);
    if (options.fields) embed.addFields(options.fields);
    
    // Always include "Made By Soggra" in the footer
    if (options.footer) {
      // If footer text already contains "Made By Soggra", use as is
      if (options.footer.text.includes('Made By Soggra')) {
        embed.setFooter(options.footer);
      } else {
        // Otherwise, prepend "Made By Soggra • " to the footer text
        embed.setFooter({
          text: `Made By Soggra • ${options.footer.text}`,
          iconURL: options.footer.iconURL
        });
      }
    } else {
      // If no footer was provided, add a default one
      embed.setFooter({
        text: 'Made By Soggra'
      });
    }
    
    if (options.thumbnail) embed.setThumbnail(options.thumbnail);
    if (options.image) embed.setImage(options.image);
    if (options.author) embed.setAuthor(options.author);

    await channel.send({ embeds: [embed] });
  } catch (error) {
    console.error('Error sending log:', error);
  }
}

export async function sendMessageLog(
  client: Client,
  guild: Guild,
  action: 'delete' | 'edit' | 'bulkDelete',
  message: Message,
  oldContent?: string
): Promise<void> {
  const actionTitles = {
    delete: 'Message Deleted',
    edit: 'Message Edited',
    bulkDelete: 'Messages Bulk Deleted',
  };

  const fields = [
    { name: 'Author', value: `${message.author} (${message.author.tag})`, inline: true },
    { name: 'Channel', value: `${message.channel}`, inline: true },
  ];

  if (action === 'edit' && oldContent) {
    fields.push(
      { name: 'Before', value: oldContent.substring(0, 1000) || '*No content*', inline: false },
      { name: 'After', value: message.content.substring(0, 1000) || '*No content*', inline: false }
    );
  } else {
    fields.push({
      name: 'Content',
      value: message.content.substring(0, 2000) || '*No content*',
      inline: false,
    });
  }

  if (message.attachments.size > 0) {
    fields.push({
      name: 'Attachments',
      value: message.attachments.map((a) => `[${a.name}](${a.url})`).join('\n'),
      inline: false,
    });
  }

  await sendLog(client, guild, {
    title: `:pencil: ${actionTitles[action]}`,
    color: action === 'delete' ? '#e74c3c' : action === 'edit' ? '#f39c12' : '#9b59b6',
    fields,
    footer: {
      text: `Made By Soggra • Message ID: ${message.id} | Author ID: ${message.author.id}`,
    },
  });
}

export async function sendChannelLog(
  client: Client,
  guild: Guild,
  action: 'create' | 'delete' | 'update',
  channel: any,
  oldChannel?: any
): Promise<void> {
  const actionTitles = {
    create: 'Channel Created',
    delete: 'Channel Deleted',
    update: 'Channel Updated',
  };

  const fields = [
    { name: 'Name', value: channel.name, inline: true },
    { name: 'Type', value: channel.type, inline: true },
    { name: 'ID', value: channel.id, inline: true },
  ];

  if (action === 'update' && oldChannel) {
    if (oldChannel.name !== channel.name) {
      fields.push({
        name: 'Name Changed',
        value: `\`${oldChannel.name}\` → \`${channel.name}\``,
        inline: false,
      });
    }
    // Add more change detections as needed
  }

  await sendLog(client, guild, {
    title: `:hash: Channel ${actionTitles[action]}`,
    color: action === 'delete' ? '#e74c3c' : action === 'create' ? '#2ecc71' : '#3498db',
    fields,
    footer: {
      text: `Made By Soggra • Channel ID: ${channel.id}`,
    },
  });
}
