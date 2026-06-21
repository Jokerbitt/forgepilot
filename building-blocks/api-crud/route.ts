// route.ts — Collection route handler (list + create) for a CRUD resource.
// Destination: src/app/api/[resource]/route.ts
import { NextResponse, type NextRequest } from 'next/server';
import { createSchema, type Resource } from './schema';

export const dynamic = 'force-dynamic';

export async function GET(): Promise<NextResponse> {
  // TODO: wire to your database repository
  const items: Resource[] = [];
  return NextResponse.json(items, { status: 200 });
}

export async function POST(request: NextRequest): Promise<NextResponse> {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
  }

  const parsed = createSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: 'Validation failed', issues: parsed.error.flatten() },
      { status: 400 },
    );
  }

  // TODO: wire to your database repository
  const created: Resource = { id: crypto.randomUUID(), ...parsed.data };
  return NextResponse.json(created, { status: 201 });
}
