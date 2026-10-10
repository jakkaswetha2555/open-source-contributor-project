import { Router } from 'express';
import { requireAuth } from '../middleware/auth.js';
import { agentRequestSchema } from '../schemas/ai.js';
import { runOnboardingAgent } from '../services/agent/agentService.js';

const router = Router();

/**
 * POST /api/onboarding-agent
 * Proposes a suitable starter task for an authenticated contributor.
 * Strictly relies on authenticated user identity from session/token; ignores any body userId.
 */
router.post('/onboarding-agent', requireAuth, async (req, res, next) => {
  try {
    const validated = agentRequestSchema.parse(req.body);

    const userId = req.user?._id || req.userId;

    const result = await runOnboardingAgent({
      userId,
      projectId: validated.projectId,
      goal: validated.goal,
      skills: validated.skills,
      hoursAvailable: validated.hoursAvailable,
    });

    res.json(result);
  } catch (err) {
    next(err);
  }
});

export default router;
