// Zod schema + inferred type for app settings (theme, AI mode, notifications, API keys).
// Destination: src/lib/settings/settings-schema.ts

import { z } from 'zod';

export const themeSchema = z.enum(['light', 'dark', 'system']);
export const aiModeSchema = z.enum(['auto', 'local', 'cloud']);

/**
 * Free-form map of provider name -> API key. Stored server-side only and never
 * sent to the client unmasked (see the settings route handler).
 */
export const apiKeysSchema = z.record(z.string(), z.string());

export const settingsSchema = z.object({
  theme: themeSchema,
  aiMode: aiModeSchema,
  notificationsEnabled: z.boolean(),
  apiKeys: apiKeysSchema,
});

/**
 * Partial schema for PATCH requests — every field is optional so callers can
 * update a single setting without round-tripping the whole object.
 */
export const settingsPatchSchema = settingsSchema.partial();

export type Theme = z.infer<typeof themeSchema>;
export type AiMode = z.infer<typeof aiModeSchema>;
export type Settings = z.infer<typeof settingsSchema>;
export type SettingsPatch = z.infer<typeof settingsPatchSchema>;

export const defaultSettings: Settings = {
  theme: 'system',
  aiMode: 'auto',
  notificationsEnabled: true,
  apiKeys: {},
};
