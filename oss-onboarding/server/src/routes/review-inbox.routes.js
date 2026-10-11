import { Router } from 'express';
import { z } from 'zod';
import { ContributionPlan, Project, MaintainerGrant } from '../models/index.js';
import { requireAuth, requireRole } from '../middleware/auth.js';
import { PLAN_STATUS } from '../constants.js';

const router = Router();

const inboxQuery = z.object({ status: z.enum(PLAN_STATUS).default('submitted') }).strict();

// GET /api/review-inbox?status=submitted   (maintainers: plans for projects they maintain)
router.get('/review-inbox', requireAuth, requireRole('maintainer'), async (req, res, next) => {
  try {
    const { status } = inboxQuery.parse(req.query);
    const grants = await MaintainerGrant.find({ userId: req.user._id, status: 'active' }).select('projectId');
    const created = await Project.find({ createdBy: req.user._id }).select('_id');
    const projectIds = [...new Set([...grants.map((g) => String(g.projectId)), ...created.map((p) => String(p._id))])];

    const plans = await ContributionPlan.find({ projectId: { $in: projectIds }, status })
      .sort({ createdAt: 1 })
      .populate('issueId', 'title status')
      .populate('authorId', 'name')
      .populate('projectId', 'name slug')
      .lean();

    return res.json({ plans });
  } catch (err) {
    return next(err);
  }
});

// GET /api/my-plans   (a contributor's own plans only)
router.get('/my-plans', requireAuth, async (req, res, next) => {
  try {
    const plans = await ContributionPlan.find({ authorId: req.user._id })
      .sort({ createdAt: -1 })
      .populate('issueId', 'title status')
      .populate('projectId', 'name slug')
      .lean();
    return res.json({ plans });
  } catch (err) {
    return next(err);
  }
});

export default router;
