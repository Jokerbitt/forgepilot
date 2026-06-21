// Next.js route handler for reading/updating app settings (API keys masked on GET).
// Destination: src/app/api/settings/route.ts

import { NextResponse } from 'next/server';
import { z } from 'zod';

import {
  defaultSettings,
  settingsPatchSchema,
  type Settings,
} from '@/lib/settings/settings-schema';
import { defineSettings } from '@/lib/settings/settings-store';

// Settings must always reflect the latest on-disk/DB state, never a cached build.
export const dynamic = 'force-dynamic';

const SETTINGS_PATH = process.env.SETTINGS_PATH ?? '.data/settings.json';
const store = defineSettings<Settings>(defaultSettings, SETTINGS_PATH);

/** Masks every API key so secrets never leave the server in plaintext. */
function maskApiKeys(apiKeys: Settings['apiKeys']): Record<string, string> {
  const masked: Record<string, string> = {};
  for (const [provider, key] of Object.entries(apiKeys)) {
    if (key.length === 0) {
      masked[provider] = '';
      continue;
    }
    const prefix = key.slice(0, 3);
    masked[provider] = `${prefix}-***`;
  }
  return masked;
}

export function GET(): NextResponse {
  const settings = store.get();
  return NextResponse.json(
    { ...settings, apiKeys: maskApiKeys(settings.apiKeys) },
    { status: 200 },
  );
}

export async function PATCH(request: Request): Promise<NextResponse> {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json(
      { error: 'Invalid JSON body' },
      { status: 400 },
    );
  }

  const parsed = settingsPatchSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: 'Validation failed', issues: z.treeifyError(parsed.error) },
      { status: 422 },
    );
  }

  const updated = store.update(parsed.data);
  return NextResponse.json(
    { ...updated, apiKeys: maskApiKeys(updated.apiKeys) },
    { status: 200 },
  );
}
