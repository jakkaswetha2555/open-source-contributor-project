
import { Router } from 'express';
import bcrypt from 'bcryptjs';
import { User } from '../models/index.js';
import { signupSchema } from '../schemas/auth.js';

const router = Router();

// POST /api/auth/signup
router.post('/auth/signup', async (req, res, next) => {
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

    const user = await User.create({
      name,
      email,
      passwordHash,
      role: 'contributor',
    });

    return res.status(201).json({
      message: 'Account created successfully',
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
