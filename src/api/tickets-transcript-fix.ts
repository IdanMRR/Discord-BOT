// This is a temporary file to fix the transcript issue
// We'll use this to modify the validateTicketAction call in the getTicketTranscript function

import express, { Request, Response, NextFunction } from 'express';
import { db } from '../database/sqlite';
import { logError } from '../utils/logger';
import { validateTicketAction } from './ticket-handlers';
const { getClient } = require('../utils/client-utils');

// Helper function to send JSON responses
const sendJsonResponse = <T>(
  res: Response,
  statusCode: number,
  data: T
): void => {
  res.status(statusCode).json(data);
};

// Modified getTicketTranscript function that allows viewing transcripts for deleted tickets
const getTicketTranscript: express.RequestHandler = async (req, res, next) => {
  try {
    const { id } = req.params;
    const ticketId = parseInt(id);
    
    if (isNaN(ticketId)) {
      sendJsonResponse(res, 400, { success: false, error: 'Invalid ticket ID' });
      return;
    }
    
    try {
      // Get the ticket directly from the database instead of using validateTicketAction
      const ticketQuery = db.prepare('SELECT * FROM tickets WHERE id = ?');
      const ticket = ticketQuery.get(ticketId) as any;
      
      if (!ticket) {
        sendJsonResponse(res, 404, { success: false, error: 'Ticket not found' });
        return;
      }
      
      // Get the Discord client
      const client = getClient();
      if (!client) {
        sendJsonResponse(res, 503, { success: false, error: 'Discord client not available' });
        return;
      }
      
      try {
        // Fetch the channel
        const channel = await client.channels.fetch(ticket.channel_id);
        
        if (!channel || !channel.isTextBased()) {
          sendJsonResponse(res, 404, { success: false, error: 'Ticket channel not found or not accessible' });
          return;
        }
        
        // Fetch the messages from the channel (limited to 100 most recent)
        const messages = await (channel as any).messages.fetch({ limit: 100 });
        
        // Format the messages into a transcript
        const transcript = Array.from(messages.values())
          .reverse() // Show oldest messages first
          .map((msg: any) => ({
            id: msg.id,
            author: {
              id: msg.author.id,
              username: msg.author.username,
              bot: msg.author.bot
            },
            content: msg.content,
            timestamp: msg.createdAt,
            attachments: Array.from(msg.attachments.values()).map((att: any) => ({
              url: att.url,
              name: att.name,
              contentType: att.contentType
            })),
            embeds: msg.embeds.map((embed: any) => ({
              title: embed.title,
              description: embed.description,
              color: embed.color,
              fields: embed.fields
            }))
          }));
        
        sendJsonResponse(res, 200, {
          success: true,
          data: {
            ticket,
            transcript
          }
        });
      } catch (discordError) {
        logError('API', `Error fetching ticket transcript: ${discordError}`);
        sendJsonResponse(res, 500, { success: false, error: 'Error fetching ticket transcript' });
      }
    } catch (dbError) {
      logError('API', `Database error getting ticket transcript: ${dbError}`);
      sendJsonResponse(res, 500, { success: false, error: 'Error getting ticket transcript' });
    }
  } catch (error) {
    next(error);
  }
};

export { getTicketTranscript };
