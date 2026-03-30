'use client';

import { useState } from 'react';
import type { CostEstimationResult } from '@/lib/types';

interface ExportButtonsProps {
  result: CostEstimationResult;
  onReset: () => void;
}

async function downloadBlob(url: string, body: object, filename: string) {
  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  if (!res.ok) throw new Error(`Export failed: ${res.statusText}`);
  const blob = await res.blob();
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(a.href);
}

export default function ExportButtons({ result, onReset }: ExportButtonsProps) {
  const [pdfLoading, setPdfLoading] = useState(false);
  const [xlsxLoading, setXlsxLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handlePdf = async () => {
    setPdfLoading(true);
    setError(null);
    try {
      await downloadBlob('/api/export-pdf', { result }, 'biztalk-cost-estimate.pdf');
    } catch (e) {
      setError(e instanceof Error ? e.message : 'PDF export failed');
    } finally {
      setPdfLoading(false);
    }
  };

  const handleExcel = async () => {
    setXlsxLoading(true);
    setError(null);
    try {
      await downloadBlob('/api/export-excel', { result }, 'biztalk-cost-estimate.xlsx');
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Excel export failed');
    } finally {
      setXlsxLoading(false);
    }
  };

  return (
    <div className="space-y-2">
      <div className="flex flex-wrap items-center gap-3 p-4 bg-white rounded-xl border border-gray-200 shadow-sm">
        <span className="text-xs font-semibold text-gray-500 uppercase tracking-wider mr-1">Export</span>
        <button
          onClick={handlePdf}
          disabled={pdfLoading}
          className="flex items-center gap-2 text-sm font-medium text-white bg-red-600 hover:bg-red-700 disabled:opacity-50 px-4 py-2 rounded-lg transition-colors shadow-sm"
        >
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M7 21h10a2 2 0 002-2V9.414a1 1 0 00-.293-.707l-5.414-5.414A1 1 0 0012.586 3H7a2 2 0 00-2 2v14a2 2 0 002 2z" />
          </svg>
          {pdfLoading ? 'Generating…' : 'Export PDF'}
        </button>
        <button
          onClick={handleExcel}
          disabled={xlsxLoading}
          className="flex items-center gap-2 text-sm font-medium text-white bg-green-700 hover:bg-green-800 disabled:opacity-50 px-4 py-2 rounded-lg transition-colors shadow-sm"
        >
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M3 10h18M3 14h18m-9-4v8m-7 0h14a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z" />
          </svg>
          {xlsxLoading ? 'Generating…' : 'Export Excel'}
        </button>
        <button
          onClick={onReset}
          className="flex items-center gap-2 text-sm font-medium text-gray-600 hover:text-gray-900 bg-gray-100 hover:bg-gray-200 px-4 py-2 rounded-lg transition-colors"
        >
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
          </svg>
          New Calculation
        </button>
      </div>

      {error && (
        <p className="text-sm text-red-600 px-1">{error}</p>
      )}
    </div>
  );
}
