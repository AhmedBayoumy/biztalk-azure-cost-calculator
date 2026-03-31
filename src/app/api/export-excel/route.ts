import { NextRequest } from 'next/server';
import * as XLSX from 'xlsx';
import type { CostEstimationResult } from '@/lib/types';

export async function POST(request: NextRequest) {
  try {
    const body = (await request.json()) as { result: CostEstimationResult };

    if (!body.result) {
      return new Response(JSON.stringify({ success: false, error: 'Result data is required' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    const { result } = body;
    const wb = XLSX.utils.book_new();

    // ── Sheet 1: Summary ──
    const summaryData = [
      ['BizTalk Migration - Azure Cost Estimate'],
      [],
      ['Generated', result.generatedAt],
      ['Region', result.region],
      ['Currency', result.currency],
      [],
      ['Integration Summary'],
      ['Total Integrations', result.inputSummary.totalIntegrations],
      ['Simple', result.inputSummary.simpleCount],
      ['Medium', result.inputSummary.mediumCount],
      ['Complex', result.inputSummary.complexCount],
      ['Estimated Messages/Day', result.inputSummary.estimatedMessagesPerDay],
      [],
      ['Cost Summary'],
      ['Monthly Total (Pay-as-you-go)', result.monthlyTotal],
      ['Annual Total (Pay-as-you-go)', result.annualTotal],
      ['Monthly with 1-Year Reservations', result.monthlyWithReservations1yr],
      ['Monthly with 3-Year Reservations', result.monthlyWithReservations3yr],
      ['Potential Monthly Saving (1yr)', result.potentialSaving1yr],
      ['Potential Monthly Saving (3yr)', result.potentialSaving3yr],
    ];

    const summarySheet = XLSX.utils.aoa_to_sheet(summaryData);
    applyColumnWidths(summarySheet, [40, 30]);
    // Bold title row
    summarySheet['A1'] = { v: summaryData[0][0], t: 's', s: { font: { bold: true, sz: 14 } } };
    XLSX.utils.book_append_sheet(wb, summarySheet, 'Summary');

    // ── Sheet 2: Cost Breakdown ──
    const breakdownHeader = [
      'Category',
      'Service',
      'SKU',
      'Quantity',
      'Unit Price',
      'Unit of Measure',
      'Monthly Cost',
      'Annual Cost',
      'Shared',
      'Notes',
    ];

    const breakdownRows: (string | number | boolean)[][] = [breakdownHeader];
    for (const category of result.categories) {
      for (const svc of category.services) {
        breakdownRows.push([
          category.category,
          svc.serviceType,
          svc.skuDisplayName,
          svc.quantity,
          svc.unitPrice,
          svc.unitOfMeasure,
          svc.monthlyCost,
          svc.annualCost,
          svc.isShared ? 'Yes' : 'No',
          svc.pricingNotes ?? '',
        ]);
      }
    }

    // Category subtotal rows
    breakdownRows.push([]);
    breakdownRows.push(['Category Subtotals', '', '', '', '', '', 'Monthly', 'Annual', '', '']);
    for (const cat of result.categories) {
      breakdownRows.push([
        cat.category,
        '',
        '',
        '',
        '',
        '',
        cat.monthlySubtotal,
        cat.annualSubtotal,
        '',
        '',
      ]);
    }
    breakdownRows.push(['TOTAL', '', '', '', '', '', result.monthlyTotal, result.annualTotal, '', '']);

    const breakdownSheet = XLSX.utils.aoa_to_sheet(breakdownRows);
    applyColumnWidths(breakdownSheet, [22, 22, 20, 10, 14, 18, 16, 16, 10, 30]);
    XLSX.utils.book_append_sheet(wb, breakdownSheet, 'Cost Breakdown');

    // ── Sheet 3: Reservation Savings ──
    const reservationHeader = ['Plan', 'Monthly Cost', 'Annual Cost', 'Monthly Saving'];
    const reservationRows: (string | number)[][] = [
      reservationHeader,
      ['Pay-as-you-go', result.monthlyTotal, result.annualTotal, 0],
      [
        '1-Year Reserved',
        result.monthlyWithReservations1yr,
        result.monthlyWithReservations1yr * 12,
        result.potentialSaving1yr,
      ],
      [
        '3-Year Reserved',
        result.monthlyWithReservations3yr,
        result.monthlyWithReservations3yr * 12,
        result.potentialSaving3yr,
      ],
    ];

    // Per-service reservation details
    reservationRows.push([]);
    reservationRows.push(['Service Detail', 'SKU', '1yr Reserved Price', '3yr Reserved Price']);
    for (const category of result.categories) {
      for (const svc of category.services) {
        if (svc.reservedPrice1yr || svc.reservedPrice3yr) {
          reservationRows.push([
            svc.serviceType,
            svc.skuDisplayName,
            svc.reservedPrice1yr ?? 0,
            svc.reservedPrice3yr ?? 0,
          ]);
        }
      }
    }

    const reservationSheet = XLSX.utils.aoa_to_sheet(reservationRows);
    applyColumnWidths(reservationSheet, [24, 20, 20, 20]);
    XLSX.utils.book_append_sheet(wb, reservationSheet, 'Reservation Savings');

    // ── Sheet 4: Unmapped Services ──
    const unmappedRows: string[][] = [['Unmapped Service']];
    if (result.unmappedServices.length > 0) {
      for (const svc of result.unmappedServices) {
        unmappedRows.push([svc]);
      }
    } else {
      unmappedRows.push(['(none — all services were successfully mapped)']);
    }

    const unmappedSheet = XLSX.utils.aoa_to_sheet(unmappedRows);
    applyColumnWidths(unmappedSheet, [50]);
    XLSX.utils.book_append_sheet(wb, unmappedSheet, 'Unmapped Services');

    // ── Write workbook ──
    const buffer = XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' });

    return new Response(buffer, {
      headers: {
        'Content-Type':
          'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        'Content-Disposition':
          'attachment; filename="biztalk-migration-cost-estimate.xlsx"',
      },
    });
  } catch (error) {
    console.error('Export Excel error:', error);
    return new Response(
      JSON.stringify({
        success: false,
        error: error instanceof Error ? error.message : 'Failed to generate Excel file',
      }),
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    );
  }
}

function applyColumnWidths(sheet: XLSX.WorkSheet, widths: number[]) {
  sheet['!cols'] = widths.map((w) => ({ wch: w }));
}
