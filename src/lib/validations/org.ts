import { z } from 'zod';

export const createOrgSchema = z.object({
  name: z.string().trim().min(1, 'Name is required').max(120, 'Keep it under 120 characters'),
});

export type CreateOrgInput = z.infer<typeof createOrgSchema>;

export const renameOrgSchema = z.object({
  name: z.string().trim().min(1, 'Name is required').max(120),
});

export type RenameOrgInput = z.infer<typeof renameOrgSchema>;
