import { Router } from 'express';
import bcrypt from 'bcryptjs';
import { User, Session } from '../models/index.js';
import {
  forgotPasswordSchema,
  resetPasswordSchema,
  verifyEmailQuerySchema,
  profileSchema,
} from '../schemas/auth.js';
import { requireAuth } from '../middleware/auth.js';
import { accountEmailLimiter } from '../middleware/rateLimit.js';
import { createToken, hashToken, RESET_TTL_MS } from '../services/account/tokens.js';
import { sendMail, resetLink } from '../services/account/mailer.js';

const router = Router();

const publicUser = (u) => ({
  id: u._id,
  name: u.name,
  email: u.email,
  role: u.role,
  emailVerified: u.emailVerified,
  skills: u.skills,
  interests: u.interests,
  availabilityHoursPerWeek: u.availabilityHoursPerWeek,
});

const invalidToken = (res) =>
  res.status(400).json({ error: { code: 'invalid_token', message: 'This link is invalid or has expired.' } });

// GET /api/auth/verify-email?token=...   (single use, expiring)
router.get('/auth/verify-email', async (req, res, next) => {
  try {
    const { token } = verifyEmailQuerySchema.parse(req.query);
    const user = await User.findOne({
      emailVerifyTokenHash: hashToken(token),
      emailVerifyExpires: { $gt: new Date() },
    }).select('+emailVerifyTokenHash +emailVerifyExpires');
    if (!user) return invalidToken(res);

    user.emailVerified = true;
    user.emailVerifyTokenHash = undefined;
    user.emailVerifyExpires = undefined;
    await user.save();
    return res.json({ message: 'Email verified. You can now log in.' });
  } catch (err) {
    return next(err);
  }
});

// POST /api/auth/forgot-password
// Always answers the same way so the endpoint cannot be used to discover which emails have accounts.
router.post('/auth/forgot-password', accountEmailLimiter, async (req, res, next) => {
  try {
    const { email } = forgotPasswordSchema.parse(req.body);
    const user = await User.findOne({ email });
    if (user) {
      const reset = createToken(RESET_TTL_MS);
      user.passwordResetTokenHash = reset.tokenHash;
      user.passwordResetExpires = reset.expires;
      await user.save();
      try {
        await sendMail({
          to: user.email,
          subject: 'Reset your password',
          text: `Reset your password: ${resetLink(reset.token)}\nThis link expires in 1 hour. If you did not ask for it, ignore this email.`,
        });
      } catch (mailError) {
        console.error('Could not send reset email:', mailError.message);
      }
    }
    return res.json({ message: 'If an account exists for that email, a reset link has been sent.' });
  } catch (err) {
    return next(err);
  }
});

// POST /api/auth/reset-password   (single use; signs the user out everywhere)
router.post('/auth/reset-password', accountEmailLimiter, async (req, res, next) => {
  try {
    const { token, password } = resetPasswordSchema.parse(req.body);
    const user = await User.findOne({
      passwordResetTokenHash: hashToken(token),
      passwordResetExpires: { $gt: new Date() },
    }).select('+passwordResetTokenHash +passwordResetExpires');
    if (!user) return invalidToken(res);

    user.passwordHash = await bcrypt.hash(password, 12);
    user.passwordResetTokenHash = undefined;
    user.passwordResetExpires = undefined;
    await user.save();
    await Session.deleteMany({ userId: user._id });
    return res.json({ message: 'Password updated. Log in with your new password.' });
  } catch (err) {
    return next(err);
  }
});

// GET /api/me   (same data as /api/auth/me, at the path used in the project plan)
router.get('/me', requireAuth, (req, res) => res.json({ user: publicUser(req.user) }));

// PATCH /api/me/profile   (contributor skill profile used by issue matching)
router.patch('/me/profile', requireAuth, async (req, res, next) => {
  try {
    const updates = profileSchema.parse(req.body);
    Object.assign(req.user, updates);
    await req.user.save();
    return res.json({ user: publicUser(req.user) });
  } catch (err) {
    return next(err);
  }
});

export default router;
