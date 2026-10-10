import crypto from 'node:crypto';
import { Session } from '../models/Session.js';
import { User } from '../models/User.js';
import { MaintainerGrant } from '../models/MaintainerGrant.js';
import { Project } from '../models/Project.js';

/**
 * Authentication middleware.
 * Verifies server-side sessions using SHA-256 hashed tokens.
 * Checks CSRF header for state-changing requests using cookie sessions.
 */
export async function requireAuth(req, res, next) {
  try {
    // 1. If user is already attached (e.g. mocked in tests)
    if (req.user && (req.user._id || req.user.id)) {
      req.userId = req.user._id || req.user.id;
      return next();
    }

    // 2. Extract token from cookie or Authorization header
    let isCookieAuth = false;
    let token = req.cookies?.sessionToken || req.cookies?.session;
    if (token) {
      isCookieAuth = true;
    }

    const authHeader = req.headers?.authorization;
    if (!token && authHeader && authHeader.startsWith('Bearer ')) {
      token = authHeader.slice(7).trim();
    }

    if (!token) {
      return res.status(401).json({
        error: {
          code: 'unauthorized',
          message: 'Authentication required',
        },
      });
    }

    // 3. Lookup active session
    const tokenHash = crypto.createHash('sha256').update(token).digest('hex');
    const session = await Session.findOne({
      tokenHash,
      expiresAt: { $gt: new Date() },
    });

    if (!session) {
      return res.status(401).json({
        error: {
          code: 'unauthorized',
          message: 'Invalid or expired session',
        },
      });
    }

    // 4. CSRF protection on state-changing requests when using cookies
    const stateChangingMethods = ['POST', 'PUT', 'PATCH', 'DELETE'];
    if (stateChangingMethods.includes(req.method)) {
      const csrfHeader = req.headers['x-csrf-token'] || req.headers['csrf-token'];
      if (isCookieAuth) {
        if (!csrfHeader || csrfHeader !== session.csrfToken) {
          return res.status(403).json({
            error: {
              code: 'csrf_error',
              message: 'Invalid or missing CSRF token',
            },
          });
        }
      } else if (csrfHeader && csrfHeader !== session.csrfToken) {
        return res.status(403).json({
          error: {
            code: 'csrf_error',
            message: 'Invalid CSRF token',
          },
        });
      }
    }

    // 5. Lookup user
    const user = await User.findById(session.userId);
    if (!user) {
      return res.status(401).json({
        error: {
          code: 'unauthorized',
          message: 'User not found',
        },
      });
    }

    req.user = user;
    req.userId = user._id;
    req.session = session;
    return next();
  } catch (err) {
    return next(err);
  }
}

/**
 * Optional authentication middleware:
 * Attaches user if a valid session is present, but does not reject unauthenticated requests.
 */
export async function optionalAuth(req, res, next) {
  try {
    if (req.user && (req.user._id || req.user.id)) {
      req.userId = req.user._id || req.user.id;
      return next();
    }

    let token = req.cookies?.sessionToken || req.cookies?.session;
    const authHeader = req.headers?.authorization;
    if (!token && authHeader && authHeader.startsWith('Bearer ')) {
      token = authHeader.slice(7).trim();
    }

    if (!token) {
      return next();
    }

    const tokenHash = crypto.createHash('sha256').update(token).digest('hex');
    const session = await Session.findOne({
      tokenHash,
      expiresAt: { $gt: new Date() },
    });

    if (!session) return next();

    const user = await User.findById(session.userId);
    if (user) {
      req.user = user;
      req.userId = user._id;
      req.session = session;
    }
    return next();
  } catch {
    return next();
  }
}

/**
 * Role-based authorization middleware
 */
export function requireRole(...roles) {
  return (req, res, next) => {
    if (!req.user || !roles.includes(req.user.role)) {
      return res.status(403).json({
        error: {
          code: 'forbidden',
          message: 'Insufficient permissions for this action',
        },
      });
    }
    return next();
  };
}

/**
 * Checks if a user is an active maintainer of a specific project.
 */
export async function isProjectMaintainer(userId, projectId) {
  if (!userId || !projectId) return false;

  // 1. Check if user is the project creator
  const project = await Project.findById(projectId);
  if (project?.createdBy && project.createdBy.toString() === userId.toString()) {
    return true;
  }

  // 2. Check active maintainer grant
  const grant = await MaintainerGrant.findOne({
    userId,
    projectId,
    status: 'active',
  });

  return Boolean(grant);
}
