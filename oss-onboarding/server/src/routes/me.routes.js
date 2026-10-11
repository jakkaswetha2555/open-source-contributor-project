
import { Router } from 'express';
import { createHash } from 'node:crypto';

import { User, Session } from '../models/index.js';

const router = Router();

// GET /api/auth/me
router.get('/auth/me', async (req, res, next) => {
  try {
    const sessionToken = req.cookies?.sid;

    if (!sessionToken) {
      return res.status(401).json({
        error: {
          code: 'unauthorized',
          message: 'Please log in first',
        },
      });
    }

    // Hash the session token before looking it up
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

    const user = await User.findById(session.userId);

    if (!user) {
      return res.status(401).json({
        error: {
          code: 'user_not_found',
          message: 'The account associated with this session was not found',
        },
      });
    }

    return res.status(200).json({
      user: {
        id: user._id,
        name: user.name,
        email: user.email,
        role: user.role,
      },
    });
  } catch (error) {
    return next(error);
  }
});

export default router;
