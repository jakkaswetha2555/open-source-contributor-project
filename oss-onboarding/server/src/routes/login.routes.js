
import { Router } from 'express';
import bcrypt from 'bcryptjs';
import { createHash, randomBytes } from 'node:crypto';

import { User, Session } from '../models/index.js';
import { loginSchema } from '../schemas/auth.js';
import { env } from '../config/env.js';

const router = Router();

const SESSION_DURATION = 7 * 24 * 60 * 60 * 1000;

// POST /api/auth/login
router.post('/auth/login', async (req, res, next) => {
  try {
    // Validate the request body
    const result = loginSchema.safeParse(req.body);

    if (!result.success) {
      return res.status(422).json({
        error: {
          code: 'validation_error',
          message: 'Invalid login details',
          details: result.error.issues.map((issue) => ({
            path: issue.path.join('.'),
            message: issue.message,
          })),
        },
      });
    }

    const { email, password } = result.data;

    // Retrieve the user and explicitly include the password hash
    const user = await User.findOne({ email }).select('+passwordHash');

    // Reject invalid credentials without revealing which field was wrong
    if (!user || !(await bcrypt.compare(password, user.passwordHash))) {
      return res.status(401).json({
        error: {
          code: 'invalid_credentials',
          message: 'Invalid email or password',
        },
      });
    }

    // Generate a random session token and CSRF token
    const sessionToken = randomBytes(32).toString('hex');
    const csrfToken = randomBytes(32).toString('hex');

    // Store only the hash of the session token
    const tokenHash = createHash('sha256')
      .update(sessionToken)
      .digest('hex');

    const expiresAt = new Date(Date.now() + SESSION_DURATION);

    await Session.create({
      userId: user._id,
      tokenHash,
      csrfToken,
      expiresAt,
      ip: req.ip,
      userAgent: req.get('user-agent'),
    });

    // Set an HTTP-only session cookie
    res.cookie('sid', sessionToken, {
      httpOnly: true,
      secure: env.NODE_ENV === 'production',
      sameSite: 'lax',
      path: '/',
      maxAge: SESSION_DURATION,
    });

    // Return public user details only
    return res.status(200).json({
      message: 'Login successful',
      csrfToken,
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
