"use client";

import { AZURE_REGIONS, type CostEstimationResult } from "@/lib/types";

interface CostSummaryProps {
  result: CostEstimationResult;
}

function formatCurrency(value: number, currency: string): string {
  return new Intl.NumberFormat("sv-SE", {
    style: "currency",
    currency,
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(value);
}

function regionLabel(regionValue: string): string {
  const found = AZURE_REGIONS.find((r) => r.value === regionValue);
  return found ? found.label : regionValue;
}

export default function CostSummary({ result }: CostSummaryProps) {
  const savingPct = result.monthlyTotal > 0
    ? Math.round((result.potentialSaving1yr / result.monthlyTotal) * 100)
    : 0;

  return (
    <div className="space-y-4">
      {/* Top hero row */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        {/* Monthly — hero card */}
        <div className="sm:col-span-1 rounded-2xl bg-gradient-to-br from-[#0078D4] to-[#0063B1] text-white p-6 shadow-lg shadow-blue-900/20">
          <p className="text-blue-200 text-xs font-semibold uppercase tracking-wider mb-1">Monthly Estimate</p>
          <p className="text-4xl font-bold tracking-tight">
            {formatCurrency(result.monthlyTotal, result.currency)}
          </p>
          <p className="text-blue-200 text-sm mt-2">Pay-as-you-go</p>
          <div className="mt-4 pt-4 border-t border-white/20 flex items-center justify-between text-xs text-blue-200">
            <span>{regionLabel(result.region)}</span>
            <span>{result.currency}</span>
          </div>
        </div>

        {/* Annual + savings column */}
        <div className="sm:col-span-2 grid grid-cols-1 sm:grid-cols-2 gap-4">
          {/* Annual */}
          <div className="rounded-2xl bg-white border border-gray-200 shadow-sm p-5">
            <div className="flex items-center justify-between mb-3">
              <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider">Annual Total</p>
              <div className="w-8 h-8 rounded-lg bg-gray-100 flex items-center justify-center">
                <svg className="w-4 h-4 text-gray-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                </svg>
              </div>
            </div>
            <p className="text-2xl font-bold text-gray-900">{formatCurrency(result.annualTotal, result.currency)}</p>
            <p className="text-xs text-gray-400 mt-1">Projected yearly cost</p>
          </div>

          {/* With reservations */}
          <div className="rounded-2xl bg-white border border-gray-200 shadow-sm p-5">
            <div className="flex items-center justify-between mb-3">
              <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider">With Reservations</p>
              <div className="w-8 h-8 rounded-lg bg-green-50 flex items-center justify-center">
                <svg className="w-4 h-4 text-green-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6" />
                </svg>
              </div>
            </div>
            <p className="text-2xl font-bold text-gray-900">{formatCurrency(result.monthlyWithReservations1yr, result.currency)}</p>
            <p className="text-xs text-gray-400 mt-1">Per month with 1-year reservations</p>
          </div>

          {/* Total integrations */}
          <div className="rounded-2xl bg-white border border-gray-200 shadow-sm p-5">
            <div className="flex items-center justify-between mb-3">
              <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider">Integrations</p>
              <div className="w-8 h-8 rounded-lg bg-purple-50 flex items-center justify-center">
                <svg className="w-4 h-4 text-purple-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M4 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2V6zM14 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2V6zM4 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2v-2zM14 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2v-2z" />
                </svg>
              </div>
            </div>
            <p className="text-2xl font-bold text-gray-900">{result.inputSummary.totalIntegrations}</p>
            <p className="text-xs text-gray-400 mt-1">
              {result.inputSummary.simpleCount} simple · {result.inputSummary.mediumCount} medium · {result.inputSummary.complexCount} complex
            </p>
          </div>

          {/* Savings badge */}
          <div className="rounded-2xl bg-green-50 border border-green-200 p-5">
            <div className="flex items-center justify-between mb-3">
              <p className="text-xs font-semibold text-green-700 uppercase tracking-wider">Potential Savings</p>
              <span className="text-xs font-bold text-green-700 bg-green-100 rounded-full px-2 py-0.5">
                -{savingPct}%
              </span>
            </div>
            <p className="text-2xl font-bold text-green-800">{formatCurrency(result.potentialSaving1yr, result.currency)}</p>
            <p className="text-xs text-green-600 mt-1">Per month with 1-year reservations</p>
          </div>
        </div>
      </div>

      <p className="text-xs text-gray-400 px-1">
        Generated {new Date(result.generatedAt).toLocaleString("sv-SE")} · {regionLabel(result.region)} · {result.currency}
      </p>
    </div>
  );
}
