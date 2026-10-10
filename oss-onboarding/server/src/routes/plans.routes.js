import { Router } from 'express';
import mongoose from 'mongoose';
import { ContributionPlan } from '../models/ContributionPlan.js';
import { Issue } from '../models/Issue.js';
import { Project } from '../models/Project.js';
import { Review } from '../models/Review.js';
import { createPlanSchema, reviewSchema } from '../schemas/plans.js';
import { requireAuth, isProjectMaintainer } from '../middleware/auth.js';

const router = Router();

/**
 * POST /api/contribution-plans
 * Access: Contributor (authenticated)
 * Create a plan for an issue, with repository evidence.
 * Server strictly sets authorId from session; rejects attempts to spoof authorId.
 */
router.post('/contribution-plans', requireAuth, async (req, res, next) => {
  try {
    const validated = createPlanSchema.parse(req.body);

    const issue = await Issue.findById(validated.issueId);
    if (!issue) {
      return res.status(404).json({
        error: {
          code: 'not_found',
          message: 'Issue not found',
        },
      });
    }

    // Check project access if private
    const project = await Project.findById(issue.projectId);
    if (project?.visibility === 'private') {
      const isMaintainer = await isProjectMaintainer(req.user._id, project._id);
      if (!isMaintainer && req.user.role !== 'moderator') {
        return res.status(403).json({
          error: {
            code: 'forbidden',
            message: 'Access denied to private project',
          },
        });
      }
    }

    const userId = req.user._id || req.userId;

    // Create plan owned by the authenticated user
    const plan = await ContributionPlan.create({
      issueId: issue._id,
      projectId: issue.projectId,
      authorId: userId,
      approach: validated.approach,
      steps: validated.steps || [],
      evidence: validated.evidence,
      status: 'submitted',
    });

    res.status(201).json({
      message: 'Contribution plan created successfully',
      plan,
    });
  } catch (err) {
    next(err);
  }
});

/**
 * GET /api/contribution-plans/:id
 * Access: Contributor (own plan only) or maintainer of that project.
 * Enforces ownership rules: contributors edit/view only their own plans.
 */
router.get('/contribution-plans/:id', requireAuth, async (req, res, next) => {
  try {
    if (!mongoose.Types.ObjectId.isValid(req.params.id)) {
      return res.status(404).json({
        error: {
          code: 'not_found',
          message: 'Contribution plan not found',
        },
      });
    }

    const plan = await ContributionPlan.findById(req.params.id)
      .populate('issueId', 'title summary status requiredSkills prerequisites')
      .populate('authorId', 'name email role')
      .populate('projectId', 'name slug visibility')
      .lean();

    if (!plan) {
      return res.status(404).json({
        error: {
          code: 'not_found',
          message: 'Contribution plan not found',
        },
      });
    }

    const currentUserId = (req.user._id || req.userId).toString();
    const authorId = (plan.authorId?._id || plan.authorId).toString();
    const isAuthor = currentUserId === authorId;

    if (isAuthor) {
      return res.json({ plan });
    }

    const isMaintainer = await isProjectMaintainer(req.user._id, plan.projectId?._id || plan.projectId);

    // Rule: A contributor can only view their own plan; maintainers of that project may view.
    // Moderators cannot view or review code plans (page 12: "moderators cannot approve code plans").
    if (!isMaintainer) {
      return res.status(403).json({
        error: {
          code: 'forbidden',
          message: 'You do not have permission to view this contribution plan',
        },
      });
    }

    res.json({ plan });
  } catch (err) {
    next(err);
  }
});

/**
 * POST /api/contribution-plans/:id/review
 * Access: Maintainer of that project
 * Approve or request changes with feedback.
 */
router.post('/contribution-plans/:id/review', requireAuth, async (req, res, next) => {
  try {
    if (!mongoose.Types.ObjectId.isValid(req.params.id)) {
      return res.status(404).json({
        error: {
          code: 'not_found',
          message: 'Contribution plan not found',
        },
      });
    }

    const validated = reviewSchema.parse(req.body);

    const plan = await ContributionPlan.findById(req.params.id);
    if (!plan) {
      return res.status(404).json({
        error: {
          code: 'not_found',
          message: 'Contribution plan not found',
        },
      });
    }

    const isMaintainer = await isProjectMaintainer(req.user._id, plan.projectId);
    if (!isMaintainer) {
      return res.status(403).json({
        error: {
          code: 'forbidden',
          message: 'Only maintainers of this project can review contribution plans',
        },
      });
    }

    // Record review
    const review = await Review.create({
      planId: plan._id,
      reviewerId: req.user._id,
      decision: validated.decision,
      feedback: validated.feedback,
    });

    // Update plan status
    plan.status = validated.decision === 'approved' ? 'approved' : 'changes_requested';
    await plan.save();

    // If approved, assign the issue to the contributor
    if (validated.decision === 'approved') {
      await Issue.findByIdAndUpdate(plan.issueId, {
        status: 'assigned',
        ownerId: plan.authorId,
      });
    }

    res.status(201).json({
      message: `Plan ${plan.status}`,
      review,
      planStatus: plan.status,
    });
  } catch (err) {
    next(err);
  }
});

export default router;
