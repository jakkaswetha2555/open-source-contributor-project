import { Router } from 'express';
import { requireAuth } from '../middleware/auth.js';
import { matchRequestSchema } from '../schemas/ai.js';
import { matchIssues } from '../services/matching/index.js';

const router = Router();

/**
 * POST /api/issue-matches
 * Access: any signed-in member. Returns open, unassigned issues from projects the user may see, each with reasons.
 */
router.post('/issue-matches', requireAuth, async (req, res, next) => {
  try {
    const body = matchRequestSchema.parse(req.body ?? {});
    const result = await matchIssues({ user: req.user, ...body });

    if (result.status === 'no_profile') {
      return res.status(422).json({
        error: { code: 'no_profile', message: 'Add skills or interests to your profile (PATCH /api/me/profile) or send them in the request.' },
      });
    }
    if (result.status === 'project_not_found') {
      return res.status(404).json({ error: { code: 'not_found', message: 'Project not found' } });
    }
    return res.json({
      method: result.method,
      matches: result.matches,
      message: result.matches.length ? undefined : 'No open issues matched your skills. Try adding more skills or interests.',
    });
  } catch (err) {
    return next(err);
  }
});

export default router;
