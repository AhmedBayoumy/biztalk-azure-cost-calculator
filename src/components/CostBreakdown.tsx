"use client";

import { useState } from "react";
import type { CostEstimationResult, ServiceCostEstimate } from "@/lib/types";
import { cn } from "@/lib/utils";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ChevronDown, ChevronUp, AlertTriangle } from "lucide-react";

interface CostBreakdownProps {
  result: CostEstimationResult;
}

const CATEGORY_COLORS: Record<string, string> = {
  "Integration Compute": "border-l-blue-500",
  "API Management": "border-l-purple-500",
  Messaging: "border-l-green-500",
  Storage: "border-l-amber-500",
  Monitoring: "border-l-cyan-500",
  Security: "border-l-rose-500",
};

function fallbackColor(index: number): string {
  const colors = [
    "border-l-indigo-500",
    "border-l-teal-500",
    "border-l-orange-500",
    "border-l-pink-500",
    "border-l-lime-500",
    "border-l-sky-500",
  ];
  return colors[index % colors.length];
}

function fmt(value: number, currency: string): string {
  return new Intl.NumberFormat("sv-SE", {
    style: "currency",
    currency,
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
  }).format(value);
}

function fmtUnit(value: number, currency: string): string {
  return new Intl.NumberFormat("sv-SE", {
    style: "currency",
    currency,
    minimumFractionDigits: 2,
    maximumFractionDigits: 4,
  }).format(value);
}

// ── Collapsible Category Section ──

function CategorySection({
  category,
  services,
  monthlySubtotal,
  annualSubtotal,
  currency,
  colorClass,
}: {
  category: string;
  services: ServiceCostEstimate[];
  monthlySubtotal: number;
  annualSubtotal: number;
  currency: string;
  colorClass: string;
}) {
  const [open, setOpen] = useState(true);

  return (
    <div
      className={cn(
        "border-l-4 rounded-lg border border-gray-200 bg-white overflow-hidden",
        colorClass
      )}
    >
      <button
        type="button"
        onClick={() => setOpen(!open)}
        className="w-full flex items-center justify-between px-4 py-3 hover:bg-gray-50 transition-colors text-left"
      >
        <div className="flex items-center gap-3">
          {open ? (
            <ChevronUp className="h-4 w-4 text-gray-400" />
          ) : (
            <ChevronDown className="h-4 w-4 text-gray-400" />
          )}
          <span className="font-semibold text-gray-800">{category}</span>
          <span className="text-xs text-gray-400">
            {services.length} service{services.length !== 1 && "s"}
          </span>
        </div>
        <div className="flex items-center gap-6 text-sm">
          <span className="font-semibold text-gray-900">
            {fmt(monthlySubtotal, currency)}/mo
          </span>
          <span className="text-gray-500 hidden sm:inline">
            {fmt(annualSubtotal, currency)}/yr
          </span>
        </div>
      </button>

      {open && (
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-t border-gray-100 bg-gray-50 text-gray-500 text-xs uppercase tracking-wider">
                <th className="text-left px-4 py-2 font-medium">Service</th>
                <th className="text-left px-4 py-2 font-medium">SKU</th>
                <th className="text-right px-4 py-2 font-medium">Qty</th>
                <th className="text-right px-4 py-2 font-medium">Unit Price</th>
                <th className="text-right px-4 py-2 font-medium">Monthly</th>
                <th className="text-right px-4 py-2 font-medium hidden sm:table-cell">
                  Annual
                </th>
              </tr>
            </thead>
            <tbody>
              {services.map((s, i) => (
                <tr
                  key={`${s.serviceType}-${s.sku}-${i}`}
                  className="border-t border-gray-50 hover:bg-gray-50/50"
                >
                  <td className="px-4 py-2 text-gray-800">
                    {s.serviceType}
                    {s.isShared && (
                      <span className="ml-1 text-[10px] text-gray-400 bg-gray-100 rounded px-1">
                        shared
                      </span>
                    )}
                  </td>
                  <td className="px-4 py-2 text-gray-600">{s.skuDisplayName}</td>
                  <td className="px-4 py-2 text-right text-gray-600">{s.quantity}</td>
                  <td className="px-4 py-2 text-right text-gray-600">
                    {fmtUnit(s.unitPrice, s.currency)}
                    <span className="text-[10px] text-gray-400 ml-1">
                      /{s.unitOfMeasure}
                    </span>
                  </td>
                  <td className="px-4 py-2 text-right font-medium text-gray-900">
                    {fmt(s.monthlyCost, s.currency)}
                  </td>
                  <td className="px-4 py-2 text-right text-gray-600 hidden sm:table-cell">
                    {fmt(s.annualCost, s.currency)}
                  </td>
                </tr>
              ))}
              <tr className="border-t-2 border-gray-200 bg-gray-50">
                <td
                  colSpan={4}
                  className="px-4 py-2 text-right font-bold text-gray-700"
                >
                  Subtotal
                </td>
                <td className="px-4 py-2 text-right font-bold text-gray-900">
                  {fmt(monthlySubtotal, currency)}
                </td>
                <td className="px-4 py-2 text-right font-bold text-gray-700 hidden sm:table-cell">
                  {fmt(annualSubtotal, currency)}
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

// ── Reservation Savings Table ──

function ReservationSavings({
  result,
}: {
  result: CostEstimationResult;
}) {
  const reservable = result.categories.flatMap((c) =>
    c.services.filter(
      (s) => s.reservedPrice1yr != null || s.reservedPrice3yr != null
    )
  );

  if (reservable.length === 0) return null;

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-base">Reservation Savings</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-200 text-gray-500 text-xs uppercase tracking-wider">
                <th className="text-left px-4 py-2 font-medium">Service</th>
                <th className="text-right px-4 py-2 font-medium">PAYG / mo</th>
                <th className="text-right px-4 py-2 font-medium">1-Year / mo</th>
                <th className="text-right px-4 py-2 font-medium">3-Year / mo</th>
                <th className="text-right px-4 py-2 font-medium">
                  Saving (1yr)
                </th>
              </tr>
            </thead>
            <tbody>
              {reservable.map((s, i) => (
                <tr
                  key={`res-${s.serviceType}-${i}`}
                  className="border-t border-gray-50 hover:bg-gray-50/50"
                >
                  <td className="px-4 py-2 text-gray-800">{s.serviceType}</td>
                  <td className="px-4 py-2 text-right text-gray-600">
                    {fmt(s.monthlyCost, s.currency)}
                  </td>
                  <td className="px-4 py-2 text-right text-gray-600">
                    {s.reservedPrice1yr != null
                      ? fmt(s.reservedPrice1yr, s.currency)
                      : "—"}
                  </td>
                  <td className="px-4 py-2 text-right text-gray-600">
                    {s.reservedPrice3yr != null
                      ? fmt(s.reservedPrice3yr, s.currency)
                      : "—"}
                  </td>
                  <td className="px-4 py-2 text-right font-medium text-green-600">
                    {s.monthlySaving1yr != null
                      ? fmt(s.monthlySaving1yr, s.currency)
                      : "—"}
                  </td>
                </tr>
              ))}
            </tbody>
            <tfoot>
              <tr className="border-t-2 border-gray-200 bg-gray-50 font-bold">
                <td className="px-4 py-2 text-gray-700">Total</td>
                <td className="px-4 py-2 text-right text-gray-900">
                  {fmt(result.monthlyTotal, result.currency)}
                </td>
                <td className="px-4 py-2 text-right text-gray-900">
                  {fmt(result.monthlyWithReservations1yr, result.currency)}
                </td>
                <td className="px-4 py-2 text-right text-gray-900">
                  {fmt(result.monthlyWithReservations3yr, result.currency)}
                </td>
                <td className="px-4 py-2 text-right text-green-600">
                  {fmt(result.potentialSaving1yr, result.currency)}
                </td>
              </tr>
            </tfoot>
          </table>
        </div>
      </CardContent>
    </Card>
  );
}

// ── Main Component ──

export default function CostBreakdown({ result }: CostBreakdownProps) {
  return (
    <div className="space-y-4">
      {/* Unmapped Services Warning */}
      {result.unmappedServices.length > 0 && (
        <div className="flex items-start gap-3 rounded-lg border border-yellow-300 bg-yellow-50 p-4">
          <AlertTriangle className="h-5 w-5 text-yellow-600 shrink-0 mt-0.5" />
          <div>
            <p className="font-medium text-yellow-800">Unmapped Services</p>
            <p className="text-sm text-yellow-700 mt-1">
              The following services could not be mapped to Azure pricing and
              are not included in the estimate:
            </p>
            <ul className="mt-2 list-disc list-inside text-sm text-yellow-700">
              {result.unmappedServices.map((s) => (
                <li key={s}>{s}</li>
              ))}
            </ul>
          </div>
        </div>
      )}

      {/* Category Breakdown Sections */}
      <div className="space-y-3">
        {result.categories.map((cat, idx) => (
          <CategorySection
            key={cat.category}
            category={cat.category}
            services={cat.services}
            monthlySubtotal={cat.monthlySubtotal}
            annualSubtotal={cat.annualSubtotal}
            currency={result.currency}
            colorClass={
              CATEGORY_COLORS[cat.category] ?? fallbackColor(idx)
            }
          />
        ))}
      </div>

      {/* Grand Total */}
      <div className="rounded-lg border-2 border-gray-900 bg-gray-900 text-white px-6 py-4 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
        <span className="text-lg font-bold">Grand Total</span>
        <div className="flex items-center gap-6">
          <div className="text-right">
            <p className="text-xs text-gray-400 uppercase tracking-wider">
              Monthly
            </p>
            <p className="text-xl font-bold">
              {fmt(result.monthlyTotal, result.currency)}
            </p>
          </div>
          <div className="text-right">
            <p className="text-xs text-gray-400 uppercase tracking-wider">
              Annual
            </p>
            <p className="text-xl font-bold">
              {fmt(result.annualTotal, result.currency)}
            </p>
          </div>
        </div>
      </div>

      {/* Reservation Savings */}
      <ReservationSavings result={result} />
    </div>
  );
}
