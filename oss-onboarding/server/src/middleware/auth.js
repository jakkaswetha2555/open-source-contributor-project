import crypto from 'node:crypto';
import { Session } from '../models/Session.js';
import { User } from '../models/User.js';

export async function requireAuth(req, res, next) {
  try {
    // 1. If user is already attached (e.g. injected in test or upstream middleware)
    if (req.user && (req.user._id || req.user.id)) {
      req.userId = req.user._id || req.user.id;
      return next();
    }

    // 2. Extract token from cookie or Authorization header
    let token = req.cookies?.sessionToken || req.cookies?.session;
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
    return next();
  } catch (err) {
    return next(err);
  }
}
