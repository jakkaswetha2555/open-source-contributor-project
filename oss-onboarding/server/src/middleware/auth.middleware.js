
import { createHash } from 'node:crypto';

import { Session } from '../models/index.js';

export async function requireAuth(req, res, next) {
  try {
    const sessionToken = req.cookies?.sid;

    if (!sessionToken) {
      return res.status(401).json({
        error: {
          code: 'unauthorized',
          message: 'Please log in to continue',
        },
      });
    }

    const tokenHash = createHash('sha256')
      .update(sessionToken)
      .digest('hex');

    const session = await Session.findOne({
      tokenHash,
      expiresAt: { $gt: new Date() },
    });

    if (!session) {
      return res.status(401).json({
        error: {
          code: 'invalid_session',
          message: 'Your session is invalid or has expired',
        },
      });
    }

    req.userId = session.userId;
    req.session = session;

    return next();
  } catch (error) {
    return next(error);
  }
}
