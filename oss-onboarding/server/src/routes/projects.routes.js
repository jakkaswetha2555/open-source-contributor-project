import { Router } from 'express';
import mongoose from 'mongoose';
import { Project } from '../models/Project.js';
import { Issue } from '../models/Issue.js';
import { Snapshot } from '../models/Snapshot.js';
import { Document } from '../models/Document.js';
import { Chunk } from '../models/Chunk.js';
import { importSchema } from '../schemas/projects.js';
import { requireAuth, optionalAuth, isProjectMaintainer } from '../middleware/auth.js';
import { chunkDocuments, generateEmbeddings } from '../services/rag/ingestionService.js';

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

    // 1. Chunk documents and generate embeddings before any database writes
    const chunkDefs = chunkDocuments(validated.documents);
    const chunkTexts = chunkDefs.map((c) => c.text);
    const embeddings = await generateEmbeddings(chunkTexts);

    let snapshot;
    let savedDocs = [];
    let savedChunks = [];
    let savedIssues = [];

    try {
      // 2. Create Snapshot
      snapshot = await Snapshot.create({
        projectId: project._id,
        version: validated.version,
        source: validated.source,
        importedBy: req.user._id,
      });

      // 3. Create Documents
      const docDocs = validated.documents.map((d) => ({
        projectId: project._id,
        snapshotId: snapshot._id,
        filePath: d.filePath,
        title: d.title,
        type: d.type,
        content: d.content,
      }));
      savedDocs = await Document.insertMany(docDocs);

      // 4. Create Chunks with embeddings and metadata
      const docMap = new Map(savedDocs.map((d) => [d.filePath, d._id]));
      const chunkDocs = chunkDefs.map((c, i) => ({
        projectId: project._id,
        snapshotId: snapshot._id,
        documentId: docMap.get(c.filePath) || savedDocs[0]?._id,
        filePath: c.filePath,
        chunkIndex: c.chunkIndex,
        text: c.text,
        visibility: project.visibility,
        embedding: embeddings[i],
      }));
      savedChunks = await Chunk.insertMany(chunkDocs);

      // 5. Create Issues (if any)
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

      // 6. Update project's current snapshot only after all writes succeed
      project.currentSnapshotId = snapshot._id;
      await project.save();
    } catch (writeErr) {
      // Roll back partial writes so incomplete snapshot is never activated
      if (snapshot?._id) {
        await Promise.allSettled([
          Snapshot.deleteOne({ _id: snapshot._id }),
          Document.deleteMany({ snapshotId: snapshot._id }),
          Chunk.deleteMany({ snapshotId: snapshot._id }),
          Issue.deleteMany({ snapshotId: snapshot._id }),
        ]);
      }
      throw writeErr;
    }

    res.status(201).json({
      message: 'Snapshot imported successfully',
      snapshotId: snapshot._id,
      version: snapshot.version,
      documentsCount: savedDocs.length,
      issuesCount: savedIssues.length,
      chunksCount: savedChunks.length,
    });
  } catch (err) {
    next(err);
  }
});

export default router;
