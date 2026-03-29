import { NextRequest, NextResponse } from 'next/server';
import type { BizTalkAnalysis } from '@/lib/types';
import { mapIntegrationsToAzure } from '@/lib/biztalk-mapper';
import { calculateCosts } from '@/lib/cost-calculator';

export async function POST(request: NextRequest) {
  try {
    const body = (await request.json()) as {
      analysis: BizTalkAnalysis;
      region: string;
      currency: string;
    };

    if (!body.analysis) {
      return NextResponse.json(
        { success: false, error: 'Analysis data is required' },
        { status: 400 }
      );
    }

    if (!body.region) {
      return NextResponse.json(
        { success: false, error: 'Region is required' },
        { status: 400 }
      );
    }

    if (!body.currency) {
      return NextResponse.json(
        { success: false, error: 'Currency is required' },
        { status: 400 }
      );
    }

    const mappings = mapIntegrationsToAzure(body.analysis, body.region);
    const result = await calculateCosts(mappings, body.region, body.currency);

    return NextResponse.json({ success: true, result });
  } catch (error) {
    console.error('Calculate cost error:', error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to calculate costs',
      },
      { status: 500 }
    );
  }
}
