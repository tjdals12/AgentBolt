import { z } from 'zod';

export const InstalledItemSchema = z.object({
  label: z.string(),
  path: z.string(),
});

export const LockfileSchema = z.object({
  installedItems: z.record(z.string(), z.array(InstalledItemSchema)).default({}),
});

export type Lockfile = z.infer<typeof LockfileSchema>;
