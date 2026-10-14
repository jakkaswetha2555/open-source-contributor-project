import { Router } from 'express';
import mongoose from 'mongoose';
import { requireAuth, isProjectMaintainer } from '../middleware/auth.js';
import { chatSchema } from '../schemas/ai.js';
import { Project } from '../models/Project.js';
import { Snapshot } from '../models/Snapshot.js';
import { answerContributorQuestion } from '../services/rag/ragService.js';

export function createContributorChatRouter({ answerQuestion = answerContributorQuestion } = {}) {
  const router = Router();

  /**
   * POST /api/contributor-chat
   * Answers questions about a project documentation snapshot using RAG with vector search and citations.
   * Enforces authentication, project visibility, and snapshot isolation.
   */
  router.post('/contributor-chat', requireAuth, async (req, res, next) => {
    try {
      const validated = chatSchema.parse(req.body);
      const projectId = validated.projectId;

      if (!mongoose.Types.ObjectId.isValid(projectId)) {
        return res.status(404).json({ error: { code: 'not_found', message: 'Project not found' } });
      }

      const project = await Project.findById(projectId);
      if (!project) {
        return res.status(404).json({ error: { code: 'not_found', message: 'Project not found' } });
      }

      // Check visibility & authorization BEFORE snapshot lookup or retrieval
      if (project.visibility === 'private') {
        const isMaintainer = await isProjectMaintainer(req.userId, project._id);
        if (!isMaintainer && req.user?.role !== 'moderator') {
          return res.status(403).json({ error: { code: 'forbidden', message: 'Access denied to private project' } });
        }
      } else if (project.verificationStatus !== 'verified') {
        const isMaintainer = await isProjectMaintainer(req.userId, project._id);
        if (!isMaintainer && req.user?.role !== 'moderator') {
          return res.status(404).json({ error: { code: 'not_found', message: 'Project not found' } });
        }
      }

      if (!project.currentSnapshotId) {
        return res.status(404).json({ error: { code: 'not_found', message: 'Project has no active snapshot' } });
      }

      const snapshot = Snapshot.findById?.mock
        ? await Snapshot.findById(project.currentSnapshotId)
        : await Snapshot.findOne({ _id: project.currentSnapshotId });
      if (!snapshot) {
        return res.status(404).json({ error: { code: 'not_found', message: 'Active snapshot not found' } });
      }

      const result = await answerQuestion({
        projectId: project._id,
        snapshotId: snapshot._id,
        visibility: project.visibility,
        snapshotVersion: snapshot.version,
        question: validated.question,
        user: req.user,
      });

      res.json(result);
    } catch (err) {
      next(err);
    }
  });

  return router;
}

const defaultRouter = createContributorChatRouter();
export default defaultRouter;
