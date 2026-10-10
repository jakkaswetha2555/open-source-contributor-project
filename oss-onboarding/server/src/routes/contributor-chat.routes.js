import { Router } from 'express';
import { Project } from '../models/Project.js';
import { Snapshot } from '../models/Snapshot.js';
import { requireAuth, isProjectMaintainer } from '../middleware/auth.js';
import { chatSchema, ragAnswerSchema } from '../schemas/ai.js';
import { answerContributorQuestion } from '../services/rag/ragService.js';

const NO_EVIDENCE_ANSWER = 'Not found in snapshot.';

function notFoundAnswer(snapshotVersion = 'unknown') {
  return ragAnswerSchema.parse({
    found: false,
    answer: NO_EVIDENCE_ANSWER,
    citations: [],
    snapshotVersion,
  });
}

async function authorizeProject(project, user) {
  if (project.visibility === 'private') {
    const isMaintainer = await isProjectMaintainer(user._id, project._id);
    return isMaintainer || user.role === 'moderator' ? 'allowed' : 'forbidden';
  }

  if (project.verificationStatus !== 'verified') {
    const isMaintainer = await isProjectMaintainer(user._id, project._id);
    return isMaintainer || user.role === 'moderator' ? 'allowed' : 'not_found';
  }

  return 'allowed';
}

export function createContributorChatRouter({
  answerQuestion = answerContributorQuestion,
} = {}) {
  const router = Router();

  router.post('/contributor-chat', requireAuth, async (req, res, next) => {
    try {
      const { projectId, question } = chatSchema.parse(req.body);
      const project = await Project.findById(projectId);

      if (!project) {
        return res.status(404).json({
          error: { code: 'not_found', message: 'Project not found' },
        });
      }

      // Authorization must finish before reading the current snapshot or chunks.
      const access = await authorizeProject(project, req.user);
      if (access === 'forbidden') {
        return res.status(403).json({
          error: { code: 'forbidden', message: 'Access denied to private project' },
        });
      }
      if (access === 'not_found') {
        return res.status(404).json({
          error: { code: 'not_found', message: 'Project not found' },
        });
      }

      if (!project.currentSnapshotId) {
        return res.json(notFoundAnswer());
      }

      const snapshot = await Snapshot.findOne({
        _id: project.currentSnapshotId,
        projectId: project._id,
      });
      if (!snapshot) {
        return res.json(notFoundAnswer());
      }

      const answer = await answerQuestion({
        question,
        projectId: project._id,
        snapshotId: snapshot._id,
        visibility: project.visibility,
        snapshotVersion: snapshot.version,
      });

      return res.json(ragAnswerSchema.parse(answer));
    } catch (err) {
      return next(err);
    }
  });

  return router;
}

export default createContributorChatRouter();
