import mongoose from 'mongoose';
import { ROLES } from '../constants.js';

const userSchema = new mongoose.Schema(
  {
    email: { type: String, required: true, unique: true, lowercase: true, trim: true },
    name: { type: String, required: true, trim: true, maxlength: 80 },
    passwordHash: { type: String, required: true, select: false },
    // Staff roles are never self-assigned: signup always creates a contributor.
    role: { type: String, enum: ROLES, default: 'contributor' },
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
