import { NextRequest } from 'next/server';
import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';
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
    const doc = new jsPDF();
    const pageWidth = doc.internal.pageSize.getWidth();
    let yPos = 20;

    // ── Title ──
    doc.setFontSize(18);
    doc.setFont('helvetica', 'bold');
    doc.text('BizTalk Migration - Azure Cost Estimate', pageWidth / 2, yPos, {
      align: 'center',
    });
    yPos += 10;

    doc.setFontSize(9);
    doc.setFont('helvetica', 'normal');
    doc.text(`Generated: ${result.generatedAt}  |  Region: ${result.region}  |  Currency: ${result.currency}`, pageWidth / 2, yPos, {
      align: 'center',
    });
    yPos += 12;

    // ── Executive Summary ──
    doc.setFontSize(14);
    doc.setFont('helvetica', 'bold');
    doc.text('Executive Summary', 14, yPos);
    yPos += 8;

    doc.setFontSize(10);
    doc.setFont('helvetica', 'normal');

    const summaryLines = [
      `Total Integrations: ${result.inputSummary.totalIntegrations} (Simple: ${result.inputSummary.simpleCount}, Medium: ${result.inputSummary.mediumCount}, Complex: ${result.inputSummary.complexCount})`,
      `Estimated Messages/Day: ${result.inputSummary.estimatedMessagesPerDay.toLocaleString()}`,
      `Monthly Cost (Pay-as-you-go): ${formatCurrency(result.monthlyTotal, result.currency)}`,
      `Annual Cost (Pay-as-you-go): ${formatCurrency(result.annualTotal, result.currency)}`,
      `Monthly with 1-Year Reservations: ${formatCurrency(result.monthlyWithReservations1yr, result.currency)}`,
      `Monthly with 3-Year Reservations: ${formatCurrency(result.monthlyWithReservations3yr, result.currency)}`,
    ];

    for (const line of summaryLines) {
      doc.text(line, 14, yPos);
      yPos += 6;
    }
    yPos += 6;

    // ── Cost Breakdown Table ──
    doc.setFontSize(14);
    doc.setFont('helvetica', 'bold');
    doc.text('Cost Breakdown', 14, yPos);
    yPos += 4;

    const tableRows: string[][] = [];
    for (const category of result.categories) {
      for (const svc of category.services) {
        tableRows.push([
          svc.serviceType,
          svc.skuDisplayName,
          String(svc.quantity),
          formatCurrency(svc.unitPrice, result.currency),
          formatCurrency(svc.monthlyCost, result.currency),
          formatCurrency(svc.annualCost, result.currency),
        ]);
      }
    }

    autoTable(doc, {
      startY: yPos,
      head: [['Service', 'SKU', 'Qty', 'Unit Price', 'Monthly', 'Annual']],
      body: tableRows,
      styles: { fontSize: 8 },
      headStyles: { fillColor: [0, 120, 212] },
      alternateRowStyles: { fillColor: [240, 245, 255] },
    });

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    yPos = (doc as any).lastAutoTable.finalY + 10;

    // ── Reservation Savings ──
    doc.setFontSize(14);
    doc.setFont('helvetica', 'bold');
    doc.text('Reservation Savings', 14, yPos);
    yPos += 4;

    autoTable(doc, {
      startY: yPos,
      head: [['Plan', 'Monthly Cost', 'Annual Cost', 'Monthly Saving']],
      body: [
        [
          'Pay-as-you-go',
          formatCurrency(result.monthlyTotal, result.currency),
          formatCurrency(result.annualTotal, result.currency),
          '—',
        ],
        [
          '1-Year Reserved',
          formatCurrency(result.monthlyWithReservations1yr, result.currency),
          formatCurrency(result.monthlyWithReservations1yr * 12, result.currency),
          formatCurrency(result.potentialSaving1yr, result.currency),
        ],
        [
          '3-Year Reserved',
          formatCurrency(result.monthlyWithReservations3yr, result.currency),
          formatCurrency(result.monthlyWithReservations3yr * 12, result.currency),
          formatCurrency(result.potentialSaving3yr, result.currency),
        ],
      ],
      styles: { fontSize: 9 },
      headStyles: { fillColor: [0, 120, 212] },
    });

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    yPos = (doc as any).lastAutoTable.finalY + 10;

    // ── Category Subtotals ──
    doc.setFontSize(14);
    doc.setFont('helvetica', 'bold');
    doc.text('Category Subtotals', 14, yPos);
    yPos += 4;

    autoTable(doc, {
      startY: yPos,
      head: [['Category', 'Monthly', 'Annual']],
      body: result.categories.map((cat) => [
        cat.category,
        formatCurrency(cat.monthlySubtotal, result.currency),
        formatCurrency(cat.annualSubtotal, result.currency),
      ]),
      styles: { fontSize: 9 },
      headStyles: { fillColor: [0, 120, 212] },
    });

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    yPos = (doc as any).lastAutoTable.finalY + 10;

    // ── Notes / Assumptions ──
    if (yPos > doc.internal.pageSize.getHeight() - 40) {
      doc.addPage();
      yPos = 20;
    }

    doc.setFontSize(14);
    doc.setFont('helvetica', 'bold');
    doc.text('Notes & Assumptions', 14, yPos);
    yPos += 8;

    doc.setFontSize(9);
    doc.setFont('helvetica', 'normal');

    const notes = [
      'Prices are based on Azure retail pricing and may vary with Enterprise Agreements or CSP discounts.',
      'Reservation savings assume full commitment for the selected term.',
      'Message volumes are estimated; actual costs depend on real-world usage patterns.',
      'Shared services (e.g., API Management) are counted once even if used by multiple integrations.',
    ];

    if (result.unmappedServices.length > 0) {
      notes.push(`Unmapped services (not priced): ${result.unmappedServices.join(', ')}`);
    }

    for (const note of notes) {
      const splitLines = doc.splitTextToSize(`• ${note}`, pageWidth - 28);
      doc.text(splitLines, 14, yPos);
      yPos += splitLines.length * 5 + 2;
    }

    const pdfBuffer = doc.output('arraybuffer');

    return new Response(pdfBuffer, {
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': 'attachment; filename="biztalk-migration-cost-estimate.pdf"',
      },
    });
  } catch (error) {
    console.error('Export PDF error:', error);
    return new Response(
      JSON.stringify({
        success: false,
        error: error instanceof Error ? error.message : 'Failed to generate PDF',
      }),
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    );
  }
}

function formatCurrency(amount: number, currency: string): string {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency,
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(amount);
}
