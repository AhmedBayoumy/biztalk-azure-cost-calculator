"use client";

import { AZURE_REGIONS, type CostEstimationResult } from "@/lib/types";
import { cn } from "@/lib/utils";
import { Card, CardContent } from "@/components/ui/card";
import {
  DollarSign,
  CalendarDays,
  Layers,
  TrendingDown,
} from "lucide-react";

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
  const generatedDate = new Date(result.generatedAt).toLocaleString("sv-SE");

  const cards = [
    {
      title: "Monthly Total",
      value: formatCurrency(result.monthlyTotal, result.currency),
      icon: DollarSign,
      accent: true,
      subtitle: `Pay-as-you-go estimate`,
    },
    {
      title: "Annual Total",
      value: formatCurrency(result.annualTotal, result.currency),
      icon: CalendarDays,
      accent: false,
      subtitle: "Projected yearly cost",
    },
    {
      title: "Total Integrations",
      value: String(result.inputSummary.totalIntegrations),
      icon: Layers,
      accent: false,
      subtitle: `${result.inputSummary.simpleCount} simple · ${result.inputSummary.mediumCount} medium · ${result.inputSummary.complexCount} complex`,
    },
    {
      title: "Potential Savings (1yr)",
      value: formatCurrency(result.potentialSaving1yr, result.currency),
      icon: TrendingDown,
      accent: false,
      subtitle: `Monthly with reservations: ${formatCurrency(result.monthlyWithReservations1yr, result.currency)}`,
    },
  ];

  return (
    <div className="space-y-3">
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {cards.map((card) => {
          const Icon = card.icon;
          return (
            <Card
              key={card.title}
              className={cn(
                "relative overflow-hidden",
                card.accent && "border-[#0078D4] bg-[#0078D4]"
              )}
            >
              <CardContent className="p-5">
                <div className="flex items-start justify-between">
                  <div className="space-y-1">
                    <p
                      className={cn(
                        "text-sm font-medium",
                        card.accent ? "text-blue-100" : "text-gray-500"
                      )}
                    >
                      {card.title}
                    </p>
                    <p
                      className={cn(
                        "text-2xl font-bold tracking-tight",
                        card.accent ? "text-white" : "text-gray-900"
                      )}
                    >
                      {card.value}
                    </p>
                    <p
                      className={cn(
                        "text-xs",
                        card.accent ? "text-blue-200" : "text-gray-400"
                      )}
                    >
                      {card.subtitle}
                    </p>
                  </div>
                  <div
                    className={cn(
                      "rounded-lg p-2",
                      card.accent
                        ? "bg-white/20 text-white"
                        : "bg-gray-100 text-gray-500"
                    )}
                  >
                    <Icon className="h-5 w-5" />
                  </div>
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>

      <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-gray-400 px-1">
        <span>Region: {regionLabel(result.region)}</span>
        <span>·</span>
        <span>Currency: {result.currency}</span>
        <span>·</span>
        <span>Generated: {generatedDate}</span>
      </div>
    </div>
  );
}
