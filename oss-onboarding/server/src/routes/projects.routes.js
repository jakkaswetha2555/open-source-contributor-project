import { Router } from 'express';
import mongoose from 'mongoose';
import { Project } from '../models/Project.js';
import { Issue } from '../models/Issue.js';
import { Snapshot } from '../models/Snapshot.js';
import { Document } from '../models/Document.js';
import { Chunk } from '../models/Chunk.js';
import { importSchema } from '../schemas/projects.js';
import { requireAuth, optionalAuth, isProjectMaintainer } from '../middleware/auth.js';
import { prepareSnapshotChunks } from '../services/rag/ingestionService.js';

const router = Router();

/**
 * Helper to resolve project by ObjectId or slug.
 */
async function resolveProject(idOrSlug) {
  if (mongoose.Types.ObjectId.isValid(idOrSlug)) {
    return await Project.findById(idOrSlug);
  }
  return await Project.findOne({ slug: idOrSlug.toLowerCase() });
}

async function cleanupIncompleteSnapshotImport(projectId, snapshotId) {
  const results = await Promise.allSettled([
    Chunk.deleteMany({ projectId, snapshotId }),
    Document.deleteMany({ projectId, snapshotId }),
    Issue.deleteMany({ projectId, snapshotId }),
    Snapshot.deleteOne({ _id: snapshotId, projectId }),
  ]);
  if (results.some((result) => result.status === 'rejected')) {
    console.error('Could not fully clean up an incomplete snapshot import.');
  }
}

/**
 * GET /api/projects
 * Access: Public
 * Browse approved public projects.
 * Only verified public projects appear in public lists.
 */
router.get('/projects', async (req, res, next) => {
  try {
    const query = {
      visibility: 'public',
      verificationStatus: 'verified',
    };

    const projects = await Project.find(query)
      .select('name slug description repoUrl visibility verificationStatus currentSnapshotId createdAt updatedAt')
      .sort({ createdAt: -1 })
      .lean();

    res.json({
      count: projects.length,
      projects,
    });
  } catch (err) {
    next(err);
  }
});

/**
 * GET /api/projects/:id
 * Access: Public for verified public projects; requires authorization for private projects.
 */
router.get('/projects/:id', optionalAuth, async (req, res, next) => {
  try {
    const project = await resolveProject(req.params.id);
    if (!project) {
      return res.status(404).json({
        error: {
          code: 'not_found',
          message: 'Project not found',
        },
      });
    }

    // Private project access control
    if (project.visibility === 'private') {
      if (!req.user) {
        return res.status(403).json({
          error: {
            code: 'forbidden',
            message: 'Project is private',
          },
        });
      }
      const isMaintainer = await isProjectMaintainer(req.user._id, project._id);
      if (!isMaintainer && req.user.role !== 'moderator') {
        return res.status(403).json({
          error: {
            code: 'forbidden',
            message: 'Access denied to private project',
          },
        });
      }
    } else if (project.verificationStatus !== 'verified') {
      // Unverified public project: only maintainers or moderators can view
      if (!req.user) {
        return res.status(404).json({
          error: {
            code: 'not_found',
            message: 'Project not found',
          },
        });
      }
      const isMaintainer = await isProjectMaintainer(req.user._id, project._id);
      if (!isMaintainer && req.user.role !== 'moderator') {
        return res.status(404).json({
          error: {
            code: 'not_found',
            message: 'Project not found',
          },
        });
      }
    }

    res.json({ project });
  } catch (err) {
    next(err);
  }
});

/**
 * GET /api/projects/:id/issues
 * Access: Public (for verified public projects; authorized for private)
 * Returns open issue summaries and contribution requirements.
 */
router.get('/projects/:id/issues', optionalAuth, async (req, res, next) => {
  try {
    const project = await resolveProject(req.params.id);
    if (!project) {
      return res.status(404).json({
        error: {
          code: 'not_found',
          message: 'Project not found',
        },
      });
    }

    // Access authorization check for private projects
    if (project.visibility === 'private') {
      if (!req.user) {
        return res.status(403).json({
          error: {
            code: 'forbidden',
            message: 'Access denied to private project',
          },
        });
      }
      const isMaintainer = await isProjectMaintainer(req.user._id, project._id);
      if (!isMaintainer && req.user.role !== 'moderator') {
        return res.status(403).json({
          error: {
            code: 'forbidden',
            message: 'Access denied to private project',
          },
        });
      }
    } else if (project.verificationStatus !== 'verified') {
      if (!req.user) {
        return res.status(404).json({
          error: {
            code: 'not_found',
            message: 'Project not found',
          },
        });
      }
      const isMaintainer = await isProjectMaintainer(req.user._id, project._id);
      if (!isMaintainer && req.user.role !== 'moderator') {
        return res.status(404).json({
          error: {
            code: 'not_found',
            message: 'Project not found',
          },
        });
      }
    }

    // Filter issues by status (default 'open', or as requested)
    const issueQuery = { projectId: project._id };
    if (req.query.status && req.query.status !== 'all') {
      issueQuery.status = req.query.status;
    } else if (!req.query.status) {
      issueQuery.status = 'open';
    }

    if (req.query.skill) {
      issueQuery.requiredSkills = { $in: [req.query.skill] };
    }

    const issues = await Issue.find(issueQuery)
      .select('projectId snapshotId title summary requiredSkills prerequisites status ownerId staleSetupFlag createdAt updatedAt')
      .populate('ownerId', 'name email')
      .sort({ createdAt: -1 })
      .lean();

    res.json({
      project: {
        _id: project._id,
        name: project.name,
        slug: project.slug,
        visibility: project.visibility,
        verificationStatus: project.verificationStatus,
      },
      count: issues.length,
      issues,
    });
  } catch (err) {
    next(err);
  }
});

/**
 * POST /api/projects/:id/imports
 * Access: Maintainer of that project
 * Import documents and issues as a new documentation snapshot.
 */
router.post('/projects/:id/imports', requireAuth, async (req, res, next) => {
  try {
    const project = await resolveProject(req.params.id);
    if (!project) {
      return res.status(404).json({
        error: {
          code: 'not_found',
          message: 'Project not found',
        },
      });
    }

    const isMaintainer = await isProjectMaintainer(req.user._id, project._id);
    if (!isMaintainer) {
      return res.status(403).json({
        error: {
          code: 'forbidden',
          message: 'Only maintainers of this project can import snapshots',
        },
      });
    }

    const validated = importSchema.parse(req.body);

    // Prepare IDs and embeddings before writing anything. If Ollama is
    // unavailable or returns invalid vectors, this import leaves MongoDB
    // unchanged and the project's current snapshot remains untouched.
    const snapshotId = new mongoose.Types.ObjectId();
    const docDocs = validated.documents.map((d) => ({
      _id: new mongoose.Types.ObjectId(),
      projectId: project._id,
      snapshotId,
      filePath: d.filePath,
      title: d.title,
      type: d.type,
      content: d.content,
    }));
    const chunkDocs = await prepareSnapshotChunks({
      projectId: project._id,
      snapshotId,
      visibility: project.visibility,
      documents: docDocs,
    });

    // 1. Persist the new snapshot, documents, chunks, and issues. If any write
    // fails, remove records for this generated snapshot ID before returning.
    let snapshot;
    let savedDocs;
    let savedIssues = [];
    try {
      snapshot = await Snapshot.create({
        _id: snapshotId,
        projectId: project._id,
        version: validated.version,
        source: validated.source,
        importedBy: req.user._id,
      });
      savedDocs = await Document.insertMany(docDocs);
      if (chunkDocs.length > 0) await Chunk.insertMany(chunkDocs);

      if (validated.issues && validated.issues.length > 0) {
        const issueDocs = validated.issues.map((iss) => ({
          projectId: project._id,
          snapshotId: snapshot._id,
          title: iss.title,
          summary: iss.summary,
          requiredSkills: iss.requiredSkills,
          prerequisites: iss.prerequisites,
          status: 'open',
        }));
        savedIssues = await Issue.insertMany(issueDocs);
      }
    } catch (err) {
      await cleanupIncompleteSnapshotImport(project._id, snapshotId);
      throw err;
    }

    // 3. Only make a fully ingested snapshot current.
    project.currentSnapshotId = snapshot._id;
    await project.save();

    res.status(201).json({
      message: 'Snapshot imported successfully',
      snapshotId: snapshot._id,
      version: snapshot.version,
      documentsCount: savedDocs.length,
      issuesCount: savedIssues.length,
    });
  } catch (err) {
    next(err);
  }
});

export default router;
