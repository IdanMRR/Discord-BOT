import { Router } from 'express';
import { ModerationCaseService } from '../database/services/sqliteService';
import { authenticateToken } from '../middleware/auth';
import { logError, logInfo } from '../utils/logger';

const router = Router();

// Get all moderation cases for a guild
router.get('/guild/:guildId', authenticateToken, async (req, res) => {
  try {
    const { guildId } = req.params;
    const limit = parseInt(req.query.limit as string) || 50;

    if (!guildId) {
      return res.status(400).json({ error: 'Guild ID is required' });
    }

    logInfo('API', `Fetching moderation cases for guild ${guildId}`);

    const cases = await ModerationCaseService.getByGuild(guildId, limit);
    
    // Transform the cases for frontend consumption
    const transformedCases = cases.map(moderationCase => ({
      id: moderationCase.id,
      caseNumber: moderationCase.case_number,
      actionType: moderationCase.action_type,
      userId: moderationCase.user_id,
      moderatorId: moderationCase.moderator_id,
      reason: moderationCase.reason,
      createdAt: moderationCase.created_at,
      additionalInfo: moderationCase.additional_info,
      active: moderationCase.active
    }));

    res.json({
      success: true,
      cases: transformedCases,
      total: transformedCases.length
    });

  } catch (error) {
    logError('Moderation Cases API', error);
    res.status(500).json({ 
      error: 'Failed to fetch moderation cases',
      details: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

// Get a specific moderation case by case number
router.get('/guild/:guildId/case/:caseNumber', authenticateToken, async (req, res) => {
  try {
    const { guildId, caseNumber } = req.params;

    if (!guildId || !caseNumber) {
      return res.status(400).json({ error: 'Guild ID and case number are required' });
    }

    const caseNum = parseInt(caseNumber);
    if (isNaN(caseNum)) {
      return res.status(400).json({ error: 'Invalid case number' });
    }

    logInfo('API', `Fetching case #${caseNum} for guild ${guildId}`);

    const moderationCase = await ModerationCaseService.getByCaseNumber(guildId, caseNum);
    
    if (!moderationCase) {
      return res.status(404).json({ error: 'Case not found' });
    }

    // Transform the case for frontend consumption
    const transformedCase = {
      id: moderationCase.id,
      caseNumber: moderationCase.case_number,
      actionType: moderationCase.action_type,
      userId: moderationCase.user_id,
      moderatorId: moderationCase.moderator_id,
      reason: moderationCase.reason,
      createdAt: moderationCase.created_at,
      additionalInfo: moderationCase.additional_info,
      active: moderationCase.active
    };

    res.json({
      success: true,
      case: transformedCase
    });

  } catch (error) {
    logError('Moderation Cases API', error);
    res.status(500).json({ 
      error: 'Failed to fetch moderation case',
      details: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

// Update a moderation case (for editing reasons, deactivating, etc.)
router.patch('/guild/:guildId/case/:caseNumber', authenticateToken, async (req, res) => {
  try {
    const { guildId, caseNumber } = req.params;
    const updates = req.body;

    if (!guildId || !caseNumber) {
      return res.status(400).json({ error: 'Guild ID and case number are required' });
    }

    const caseNum = parseInt(caseNumber);
    if (isNaN(caseNum)) {
      return res.status(400).json({ error: 'Invalid case number' });
    }

    // Validate updates object
    const allowedFields = ['reason', 'active', 'additional_info'];
    const filteredUpdates: any = {};
    
    for (const field of allowedFields) {
      if (updates[field] !== undefined) {
        filteredUpdates[field] = updates[field];
      }
    }

    if (Object.keys(filteredUpdates).length === 0) {
      return res.status(400).json({ error: 'No valid fields to update' });
    }

    logInfo('API', `Updating case #${caseNum} for guild ${guildId}: ${JSON.stringify(filteredUpdates)}`);

    const success = await ModerationCaseService.updateCase(guildId, caseNum, filteredUpdates);
    
    if (!success) {
      return res.status(404).json({ error: 'Case not found or update failed' });
    }

    res.json({
      success: true,
      message: 'Case updated successfully'
    });

  } catch (error) {
    logError('Moderation Cases API', error);
    res.status(500).json({ 
      error: 'Failed to update moderation case',
      details: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

export default router; 