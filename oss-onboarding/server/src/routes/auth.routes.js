
import { Router } from 'express';
import bcrypt from 'bcryptjs';
import { User } from '../models/index.js';
import { signupSchema } from '../schemas/auth.js';
import { signupLimiter } from '../middleware/rateLimit.js';
import { createToken, VERIFY_TTL_MS } from '../services/account/tokens.js';
import { sendMail, verifyLink } from '../services/account/mailer.js';
import { env } from '../config/env.js';

const router = Router();

// POST /api/auth/signup
router.post('/auth/signup', signupLimiter, async (req, res, next) => {
  try {
    const result = signupSchema.safeParse(req.body);

    if (!result.success) {
      return res.status(422).json({
        error: {
          code: 'validation_error',
          message: 'Invalid signup details',
          details: result.error.issues.map((issue) => ({
            path: issue.path.join('.'),
            message: issue.message,
          })),
        },
      });
    }

    const { name, email, password } = result.data;

    const existingUser = await User.findOne({ email });

    if (existingUser) {
      return res.status(409).json({
        error: {
          code: 'email_already_exists',
          message: 'An account with this email already exists',
        },
      });
    }

    const passwordHash = await bcrypt.hash(password, 12);

    const verification = createToken(VERIFY_TTL_MS);

    const user = await User.create({
      name,
      email,
      passwordHash,
      role: 'contributor',
      emailVerified: false,
      emailVerifyTokenHash: verification.tokenHash,
      emailVerifyExpires: verification.expires,
    });

    // A mail failure must not lose the account; the user can request a new link by signing up again later or via support.
    try {
      await sendMail({
        to: user.email,
        subject: 'Verify your email address',
        text: `Welcome, ${user.name}. Confirm your email: ${verifyLink(verification.token)}\nThis link expires in 24 hours.`,
      });
    } catch (mailError) {
      console.error('Could not send verification email:', mailError.message);
    }

    return res.status(201).json({
      message: 'Account created successfully. Check your email to verify your address.',
      emailVerificationRequired: env.REQUIRE_EMAIL_VERIFICATION,
      user: {
        id: user._id,
        name: user.name,
        email: user.email,
        role: user.role,
      },
    });
  } catch (error) {
    if (error.code === 11000) {
      return res.status(409).json({
        error: {
          code: 'email_already_exists',
          message: 'An account with this email already exists',
        },
      });
    }

    next(error);
  }
});

export default router;
