import { Router } from 'express';
import mongoose from 'mongoose';
import { Project, MaintainerGrant, User } from '../models/index.js';
import { requireAuth, requireRole } from '../middleware/auth.js';
import { verificationSchema } from '../schemas/projects.js';

const router = Router();

/**
 * PATCH /api/projects/:id/verification
 * Access: Platform moderator only.
 * Verifying a project also activates its pending maintainer grants (the controlled approval flow);
 * rejecting revokes them. A moderator never gains the right to review or approve code plans.
 */
router.patch('/projects/:id/verification', requireAuth, requireRole('moderator'), async (req, res, next) => {
  try {
    if (!mongoose.Types.ObjectId.isValid(req.params.id)) {
      return res.status(404).json({ error: { code: 'not_found', message: 'Project not found' } });
    }
    const { status, note } = verificationSchema.parse(req.body);

    const project = await Project.findById(req.params.id);
    if (!project) {
      return res.status(404).json({ error: { code: 'not_found', message: 'Project not found' } });
    }

    project.verificationStatus = status;
    await project.save();

    const pending = await MaintainerGrant.find({ projectId: project._id, status: 'pending' });
    let activatedMaintainers = 0;
    if (pending.length > 0) {
      const grantStatus = status === 'verified' ? 'active' : 'revoked';
      await MaintainerGrant.updateMany(
        { _id: { $in: pending.map((g) => g._id) } },
        { status: grantStatus, grantedBy: req.user._id },
      );
      if (status === 'verified') {
        // The only place a contributor account becomes a maintainer.
        const result = await User.updateMany(
          { _id: { $in: pending.map((g) => g.userId) }, role: 'contributor' },
          { role: 'maintainer' },
        );
        activatedMaintainers = result.modifiedCount ?? 0;
      }
    }

    return res.json({
      message: `Project ${status}`,
      project: { id: project._id, name: project.name, verificationStatus: project.verificationStatus },
      pendingGrantsProcessed: pending.length,
      maintainersActivated: activatedMaintainers,
      note: note ?? null,
    });
  } catch (err) {
    return next(err);
  }
});

export default router;
