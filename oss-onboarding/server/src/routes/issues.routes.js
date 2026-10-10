import { Router } from 'express';
import mongoose from 'mongoose';
import { Issue } from '../models/Issue.js';
import { Project } from '../models/Project.js';
import { Interest } from '../models/Interest.js';
import { User } from '../models/User.js';
import { interestSchema, updateIssueSchema } from '../schemas/projects.js';
import { requireAuth, optionalAuth, isProjectMaintainer } from '../middleware/auth.js';

const router = Router();

/**
 * GET /api/issues/:id
 * Access: Public (for verified public projects; authorized for private)
 * Returns issue details with associated project info.
 */
router.get('/issues/:id', optionalAuth, async (req, res, next) => {
  try {
    if (!mongoose.Types.ObjectId.isValid(req.params.id)) {
      return res.status(404).json({
        error: {
          code: 'not_found',
          message: 'Issue not found',
        },
      });
    }

    const issue = await Issue.findById(req.params.id)
      .select('-embedding')
      .populate('projectId', 'name slug visibility verificationStatus repoUrl')
      .populate('ownerId', 'name email')
      .lean();

    if (!issue) {
      return res.status(404).json({
        error: {
          code: 'not_found',
          message: 'Issue not found',
        },
      });
    }

    // Access authorization check for private projects
    if (issue.projectId?.visibility === 'private') {
      if (!req.user) {
        return res.status(403).json({
          error: {
            code: 'forbidden',
            message: 'Access denied to private project issue',
          },
        });
      }
      const isMaintainer = await isProjectMaintainer(req.user._id, issue.projectId._id);
      if (!isMaintainer && req.user.role !== 'moderator') {
        return res.status(403).json({
          error: {
            code: 'forbidden',
            message: 'Access denied to private project issue',
          },
        });
      }
    }

    const interestCount = await Interest.countDocuments({ issueId: issue._id });

    res.json({
      issue,
      interestCount,
    });
  } catch (err) {
    next(err);
  }
});

/**
 * POST /api/issues/:id/interest
 * Access: Contributor (authenticated)
 * Saves a contributor's interest in an issue.
 * Validates request body with strict Zod schema (no unexpected body fields permitted).
 */
router.post('/issues/:id/interest', requireAuth, async (req, res, next) => {
  try {
    if (!mongoose.Types.ObjectId.isValid(req.params.id)) {
      return res.status(404).json({
        error: {
          code: 'not_found',
          message: 'Issue not found',
        },
      });
    }

    // Strict validation: reject any unknown body parameters
    interestSchema.parse(req.body);

    const issue = await Issue.findById(req.params.id);
    if (!issue) {
      return res.status(404).json({
        error: {
          code: 'not_found',
          message: 'Issue not found',
        },
      });
    }

    // Authorize project access if private
    const project = await Project.findById(issue.projectId);
    if (project?.visibility === 'private') {
      const isMaintainer = await isProjectMaintainer(req.user._id, project._id);
      if (!isMaintainer && req.user.role !== 'moderator') {
        return res.status(403).json({
          error: {
            code: 'forbidden',
            message: 'Access denied to private project issue',
          },
        });
      }
    }

    const userId = req.user._id || req.userId;

    // Check if interest already exists
    const existing = await Interest.findOne({
      issueId: issue._id,
      userId,
    });

    if (existing) {
      return res.status(200).json({
        message: 'Interest already recorded',
        interest: existing,
      });
    }

    const interest = await Interest.create({
      issueId: issue._id,
      userId,
    });

    res.status(201).json({
      message: 'Interest recorded successfully',
      interest,
    });
  } catch (err) {
    next(err);
  }
});

/**
 * PATCH /api/issues/:id
 * Access: Maintainer of that project
 * Updates an issue, records ownership, flags stale setup instructions, closes unavailable tasks.
 */
router.patch('/issues/:id', requireAuth, async (req, res, next) => {
  try {
    if (!mongoose.Types.ObjectId.isValid(req.params.id)) {
      return res.status(404).json({
        error: {
          code: 'not_found',
          message: 'Issue not found',
        },
      });
    }

    const validated = updateIssueSchema.parse(req.body);

    const issue = await Issue.findById(req.params.id);
    if (!issue) {
      return res.status(404).json({
        error: {
          code: 'not_found',
          message: 'Issue not found',
        },
      });
    }

    // Authorization check: User must be maintainer of this project
    const isMaintainer = await isProjectMaintainer(req.user._id, issue.projectId);
    if (!isMaintainer) {
      return res.status(403).json({
        error: {
          code: 'forbidden',
          message: 'Only maintainers of this project can update issues',
        },
      });
    }

    // Validate new owner exists if assigned
    if (validated.ownerId) {
      const ownerExists = await User.findById(validated.ownerId);
      if (!ownerExists) {
        return res.status(404).json({
          error: {
            code: 'not_found',
            message: 'Assigned owner user not found',
          },
        });
      }
    }

    // Apply allowed updates
    if (validated.status !== undefined) issue.status = validated.status;
    if (validated.ownerId !== undefined) issue.ownerId = validated.ownerId;
    if (validated.staleSetupFlag !== undefined) issue.staleSetupFlag = validated.staleSetupFlag;
    if (validated.summary !== undefined) issue.summary = validated.summary;
    if (validated.prerequisites !== undefined) issue.prerequisites = validated.prerequisites;
    if (validated.requiredSkills !== undefined) issue.requiredSkills = validated.requiredSkills;

    await issue.save();

    res.json({
      message: 'Issue updated successfully',
      issue,
    });
  } catch (err) {
    next(err);
  }
});

export default router;
