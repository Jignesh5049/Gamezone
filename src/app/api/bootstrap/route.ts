import { NextResponse } from 'next/server';
import { requireAuth } from '@/lib/auth';
import { buildBootstrapPayload } from '@/lib/queries';

export async function GET() {
  const auth = await requireAuth();
  if ('error' in auth) return auth.error;

  const payload = buildBootstrapPayload(auth.staff);
  return NextResponse.json(payload);
}
