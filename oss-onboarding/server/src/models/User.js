import mongoose from 'mongoose';
import { ROLES } from '../constants.js';

const userSchema = new mongoose.Schema(
  {
    email: { type: String, required: true, unique: true, lowercase: true, trim: true },
    name: { type: String, required: true, trim: true, maxlength: 80 },
    // Required for email/password accounts; absent for accounts created via Google OAuth only
    // (required is a function so a Google-only signup, which has no password, still validates).
    passwordHash: {
      type: String,
      select: false,
      required: [function requiresPasswordUnlessGoogleLinked() { return !this.googleId; }, 'A user needs a password or a linked Google account'],
    },
    // Set when the account was created (or linked) via "Sign in with Google". Sparse so
    // multiple email/password-only users (googleId: undefined) don't collide on the unique index.
    googleId: { type: String, select: false, sparse: true, unique: true },
    // Staff roles are never self-assigned: signup always creates a contributor.
    role: { type: String, enum: ROLES, default: 'contributor' },
    // Google already verifies the email address before issuing an id_token.
    emailVerified: { type: Boolean, default: false },
    emailVerifyTokenHash: { type: String, select: false },
    emailVerifyExpires: { type: Date, select: false },
    passwordResetTokenHash: { type: String, select: false },
    passwordResetExpires: { type: Date, select: false },
    skills: { type: [String], default: [] },
    interests: { type: [String], default: [] },
    availabilityHoursPerWeek: { type: Number, min: 0, max: 80, default: 0 },
  },
  { timestamps: true },
);

export const User = mongoose.models.User || mongoose.model('User', userSchema);
