import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth/next';
import { authOptions } from '@/app/api/auth/[...nextauth]/route';
import { getClients, createClient } from '@/lib/db';
import { nanoid } from 'nanoid';

export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.login) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const clients = getClients(session.user.login);
  return NextResponse.json(clients);
}

export async function POST(request: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.login) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const body = await request.json();
  const { name, description } = body;

  if (!name?.trim()) {
    return NextResponse.json({ error: 'Name is required' }, { status: 400 });
  }

  const client = createClient({
    id: nanoid(),
    name: name.trim(),
    description: description?.trim() ?? '',
    created_by: session.user.login,
  });

  return NextResponse.json(client, { status: 201 });
}
