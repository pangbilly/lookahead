import { z } from 'zod';

const optionalDate = z
  .string()
  .optional()
  .transform((v) => (v === '' ? undefined : v))
  .refine((v) => v === undefined || /^\d{4}-\d{2}-\d{2}$/.test(v), {
    message: 'Use YYYY-MM-DD',
  });

export const createProjectSchema = z.object({
  name: z.string().trim().min(1, 'Name is required').max(160),
  client: z.string().trim().max(160).optional().transform((v) => (v === '' ? undefined : v)),
  description: z
    .string()
    .trim()
    .max(1000)
    .optional()
    .transform((v) => (v === '' ? undefined : v)),
  startDate: optionalDate,
  endDate: optionalDate,
});

export type CreateProjectInput = z.infer<typeof createProjectSchema>;
