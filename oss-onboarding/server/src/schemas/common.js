import { z } from 'zod';

export const objectId = z.string().regex(/^[0-9a-fA-F]{24}$/, 'must be a valid id');
export const skillList = z.array(z.string().trim().min(1).max(40)).max(30);
