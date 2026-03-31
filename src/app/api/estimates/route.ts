import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth/next';
import { authOptions } from '@/app/api/auth/[...nextauth]/route';
import { getEstimates, createEstimate } from '@/lib/db';
import { nanoid } from 'nanoid';

export async function GET(request: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.login) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const clientId = request.nextUrl.searchParams.get('clientId');
  if (!clientId) {
    return NextResponse.json({ error: 'clientId required' }, { status: 400 });
  }

  const estimates = getEstimates(clientId, session.user.login);
  return NextResponse.json(estimates);
}

export async function POST(request: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.login) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const body = await request.json();
  const { client_id, title, region, currency, raw_input, analysis, mappings, cost_result } = body;

  if (!client_id || !title?.trim()) {
    return NextResponse.json({ error: 'client_id and title are required' }, { status: 400 });
  }

  const estimate = createEstimate({
    id: nanoid(),
    client_id,
    title: title.trim(),
    region: region ?? 'swedencentral',
    currency: currency ?? 'SEK',
    raw_input: raw_input ?? {},
    analysis: analysis ?? {},
    mappings: mappings ?? [],
    cost_result: cost_result ?? {},
    created_by: session.user.login,
  });

  return NextResponse.json(estimate, { status: 201 });
}
