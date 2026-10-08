import { z } from 'zod';
import { skillList } from './common.js';

// .strict() rejects unknown fields, so a signup body containing "role" is refused:
// staff roles can never be self-assigned.
export const signupSchema = z
  .object({
    email: z.string().trim().toLowerCase().email().max(254),
    name: z.string().trim().min(1).max(80),
    password: z.string().min(10, 'password must be at least 10 characters').max(128),
  })
  .strict();

export const loginSchema = z
  .object({
    email: z.string().trim().toLowerCase().email(),
    password: z.string().min(1).max(128),
  })
  .strict();

export const forgotPasswordSchema = z.object({ email: z.string().trim().toLowerCase().email() }).strict();

export const resetPasswordSchema = z
  .object({
    token: z.string().min(20).max(200),
    password: z.string().min(10).max(128),
  })
  .strict();

export const profileSchema = z
  .object({
    skills: skillList.optional(),
    interests: skillList.optional(),
    availabilityHoursPerWeek: z.number().min(0).max(80).optional(),
  })
  .strict();
