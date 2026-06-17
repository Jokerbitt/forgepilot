// schema.ts — Zod schemas + inferred types for a CRUD resource.
// Destination: src/app/api/[resource]/schema.ts  (rename [resource] to your noun)
import { z } from 'zod';

// --- Resource fields ---------------------------------------------------------
// Replace `title` and `done` below with your actual fields.
export const createSchema = z.object({
  title: z.string().min(1, 'Title is required'), // replace with your fields
  done: z.boolean().default(false), // replace with your fields
});

// Update = all fields optional (partial PATCH semantics).
export const updateSchema = createSchema.partial();

// Full resource as returned by the API (adds server-managed id).
export const resourceSchema = createSchema.extend({
  id: z.string().uuid(),
});

export type CreateInput = z.infer<typeof createSchema>;
export type UpdateInput = z.infer<typeof updateSchema>;
export type Resource = z.infer<typeof resourceSchema>;
