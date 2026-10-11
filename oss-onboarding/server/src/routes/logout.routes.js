
import { Router } from 'express';
import { createHash } from 'node:crypto';

import { Session } from '../models/index.js';

const router = Router();

// POST /api/auth/logout
router.post('/auth/logout', async (req, res, next) => {
  try {
    const sessionToken = req.cookies?.sid;

    // Clear the session cookie even if no session exists
    res.clearCookie('sid', {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      path: '/',
    });

    if (!sessionToken) {
      return res.status(200).json({
        message: 'Logged out successfully',
      });
    }

    const tokenHash = createHash('sha256')
      .update(sessionToken)
      .digest('hex');

    await Session.deleteOne({ tokenHash });

    return res.status(200).json({
      message: 'Logged out successfully',
    });
  } catch (error) {
    return next(error);
  }
});

export default router;
