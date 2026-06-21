// id-route.ts — Single-item route handler (read + update + delete).
// Destination: src/app/api/[resource]/[id]/route.ts
import { NextResponse, type NextRequest } from 'next/server';
import { updateSchema, type Resource } from '../schema';

export const dynamic = 'force-dynamic';

// Next.js 15: dynamic route params are async and must be awaited.
type RouteContext = { params: Promise<{ id: string }> };

export async function GET(
  _request: NextRequest,
  context: RouteContext,
): Promise<NextResponse> {
  const { id } = await context.params;

  // TODO: wire to your database repository
  const item: Resource | null = null;
  if (!item) {
    return NextResponse.json({ error: 'Not found' }, { status: 404 });
  }
  return NextResponse.json(item, { status: 200 });
}

export async function PATCH(
  request: NextRequest,
  context: RouteContext,
): Promise<NextResponse> {
  const { id } = await context.params;

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
  }

  const parsed = updateSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: 'Validation failed', issues: parsed.error.flatten() },
      { status: 400 },
    );
  }

  // TODO: wire to your database repository
  const updated: Resource | null = null;
  if (!updated) {
    return NextResponse.json({ error: 'Not found' }, { status: 404 });
  }
  return NextResponse.json(updated, { status: 200 });
}

export async function DELETE(
  _request: NextRequest,
  context: RouteContext,
): Promise<NextResponse> {
  const { id } = await context.params;

  // TODO: wire to your database repository
  void id;
  return new NextResponse(null, { status: 204 });
}
