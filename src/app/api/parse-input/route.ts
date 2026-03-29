import { NextRequest, NextResponse } from 'next/server';
import type { RawInput } from '@/lib/types';
import { parseInput } from '@/lib/input-parser';
import { parseWithAI } from '@/lib/ai-parser';

export async function POST(request: NextRequest) {
  try {
    const body = (await request.json()) as RawInput;

    if (!body.content || body.content.trim().length === 0) {
      return NextResponse.json(
        { success: false, error: 'Content is required and cannot be empty' },
        { status: 400 }
      );
    }

    if (!body.format) {
      return NextResponse.json(
        { success: false, error: 'Format is required (json | markdown | text | xml-binding)' },
        { status: 400 }
      );
    }

    let analysis;
    if (body.format === 'text') {
      const hasAIKey = !!(process.env.GH_TOKEN || process.env.GITHUB_TOKEN || process.env.OPENAI_API_KEY);
      if (hasAIKey) {
        // Use AI for richer extraction when a key is available
        analysis = await parseWithAI(body.content);
      } else {
        // Fallback: smart regex parser — works without any API key
        analysis = parseInput({ ...body, format: 'markdown' });
      }
    } else {
      analysis = parseInput(body);
    }

    return NextResponse.json({ success: true, analysis });
  } catch (error) {
    console.error('Parse input error:', error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to parse input',
      },
      { status: 500 }
    );
  }
}
