"use client";

import { useState, useMemo } from "react";
import type {
  BizTalkAnalysis,
  BizTalkAdapterType,
  IntegrationComplexity,
} from "@/lib/types";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ChevronDown, ChevronUp, AlertTriangle } from "lucide-react";

interface ReviewStepProps {
  analysis: BizTalkAnalysis;
  onConfirm: (analysis: BizTalkAnalysis) => void;
  onBack: () => void;
}

// ── Colored horizontal bar chart ──

const ADAPTER_COLORS: Record<string, string> = {
  FILE: "bg-blue-500",
  FTP: "bg-sky-500",
  SFTP: "bg-cyan-500",
  HTTP: "bg-green-500",
  SOAP: "bg-emerald-500",
  WCF: "bg-teal-500",
  SQL: "bg-amber-500",
  MQ: "bg-orange-500",
  MSMQ: "bg-red-400",
  REST: "bg-indigo-500",
  SAP: "bg-purple-500",
  SMTP: "bg-pink-500",
  POP3: "bg-rose-400",
  Oracle: "bg-yellow-500",
  EDI: "bg-lime-500",
  UNKNOWN: "bg-gray-400",
};

const COMPLEXITY_COLORS: Record<IntegrationComplexity, string> = {
  simple: "bg-green-500",
  medium: "bg-amber-500",
  complex: "bg-red-500",
};

function HorizontalBar({
  items,
  colorMap,
  total,
}: {
  items: { label: string; count: number }[];
  colorMap: Record<string, string>;
  total: number;
}) {
  if (total === 0) return null;
  return (
    <div className="space-y-2">
      {/* Stacked bar */}
      <div className="flex h-6 rounded-md overflow-hidden">
        {items.map((item) => {
          const pct = (item.count / total) * 100;
          if (pct === 0) return null;
          return (
            <div
              key={item.label}
              className={cn(
                "flex items-center justify-center text-[10px] text-white font-medium transition-all",
                colorMap[item.label] ?? "bg-gray-400"
              )}
              style={{ width: `${pct}%` }}
              title={`${item.label}: ${item.count}`}
            >
              {pct > 8 && item.count}
            </div>
          );
        })}
      </div>

      {/* Legend */}
      <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-gray-600">
        {items.map((item) => (
          <span key={item.label} className="flex items-center gap-1">
            <span
              className={cn(
                "inline-block w-2.5 h-2.5 rounded-sm",
                colorMap[item.label] ?? "bg-gray-400"
              )}
            />
            {item.label} ({item.count})
          </span>
        ))}
      </div>
    </div>
  );
}

// ── Editable integration row ──

function IntegrationEditor({
  analysis,
  onChange,
}: {
  analysis: BizTalkAnalysis;
  onChange: (updated: BizTalkAnalysis) => void;
}) {
  const [expanded, setExpanded] = useState(false);

  const updateIntegration = (
    id: string,
    field: string,
    value: string | number
  ) => {
    const updated = {
      ...analysis,
      integrations: analysis.integrations.map((intg) =>
        intg.id === id ? { ...intg, [field]: value } : intg
      ),
    };
    // Recount totals
    updated.totalIntegrations = updated.integrations.length;
    onChange(updated);
  };

  return (
    <div className="space-y-2">
      <button
        type="button"
        onClick={() => setExpanded(!expanded)}
        className="flex items-center gap-2 text-sm font-medium text-[#0078D4] hover:underline"
      >
        {expanded ? (
          <ChevronUp className="h-4 w-4" />
        ) : (
          <ChevronDown className="h-4 w-4" />
        )}
        {expanded ? "Hide details" : "Edit integrations"}
      </button>

      {expanded && (
        <div className="overflow-x-auto rounded-lg border border-gray-200">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-gray-50 text-gray-500 text-xs uppercase tracking-wider">
                <th className="text-left px-3 py-2 font-medium">Name</th>
                <th className="text-left px-3 py-2 font-medium">Adapter</th>
                <th className="text-left px-3 py-2 font-medium">Complexity</th>
                <th className="text-left px-3 py-2 font-medium">Direction</th>
                <th className="text-right px-3 py-2 font-medium">Msgs/day</th>
              </tr>
            </thead>
            <tbody>
              {analysis.integrations.map((intg) => (
                <tr
                  key={intg.id}
                  className="border-t border-gray-100 hover:bg-gray-50/50"
                >
                  <td className="px-3 py-2 text-gray-800 max-w-[200px] truncate">
                    {intg.name}
                  </td>
                  <td className="px-3 py-2">
                    <select
                      className="border border-gray-200 rounded px-2 py-1 text-xs bg-white"
                      value={intg.adapterType}
                      onChange={(e) =>
                        updateIntegration(
                          intg.id,
                          "adapterType",
                          e.target.value as BizTalkAdapterType
                        )
                      }
                    >
                      {(
                        [
                          "FILE", "FTP", "SFTP", "HTTP", "SOAP", "WCF",
                          "SQL", "MQ", "MSMQ", "REST", "SAP", "SMTP",
                          "POP3", "Oracle", "EDI", "UNKNOWN",
                        ] as BizTalkAdapterType[]
                      ).map((t) => (
                        <option key={t} value={t}>
                          {t}
                        </option>
                      ))}
                    </select>
                  </td>
                  <td className="px-3 py-2">
                    <select
                      className="border border-gray-200 rounded px-2 py-1 text-xs bg-white"
                      value={intg.complexity}
                      onChange={(e) =>
                        updateIntegration(
                          intg.id,
                          "complexity",
                          e.target.value as IntegrationComplexity
                        )
                      }
                    >
                      <option value="simple">Simple</option>
                      <option value="medium">Medium</option>
                      <option value="complex">Complex</option>
                    </select>
                  </td>
                  <td className="px-3 py-2">
                    <select
                      className="border border-gray-200 rounded px-2 py-1 text-xs bg-white"
                      value={intg.direction}
                      onChange={(e) =>
                        updateIntegration(intg.id, "direction", e.target.value)
                      }
                    >
                      <option value="send">Send</option>
                      <option value="receive">Receive</option>
                      <option value="both">Both</option>
                    </select>
                  </td>
                  <td className="px-3 py-2">
                    <input
                      type="number"
                      min={0}
                      className="w-20 border border-gray-200 rounded px-2 py-1 text-xs text-right bg-white"
                      value={intg.messagesPerDay ?? ""}
                      onChange={(e) =>
                        updateIntegration(
                          intg.id,
                          "messagesPerDay",
                          Number(e.target.value) || 0
                        )
                      }
                    />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

// ── Main Component ──

export default function ReviewStep({
  analysis: initialAnalysis,
  onConfirm,
  onBack,
}: ReviewStepProps) {
  const [analysis, setAnalysis] = useState<BizTalkAnalysis>(initialAnalysis);

  const adapterBreakdown = useMemo(() => {
    const counts: Record<string, number> = {};
    for (const intg of analysis.integrations) {
      counts[intg.adapterType] = (counts[intg.adapterType] || 0) + 1;
    }
    return Object.entries(counts)
      .map(([label, count]) => ({ label, count }))
      .sort((a, b) => b.count - a.count);
  }, [analysis]);

  const complexityBreakdown = useMemo(() => {
    const counts: Record<IntegrationComplexity, number> = {
      simple: 0,
      medium: 0,
      complex: 0,
    };
    for (const intg of analysis.integrations) {
      counts[intg.complexity]++;
    }
    return (["simple", "medium", "complex"] as IntegrationComplexity[]).map(
      (c) => ({ label: c, count: counts[c] })
    );
  }, [analysis]);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h2 className="text-xl font-bold text-gray-900">
          Review BizTalk Analysis
        </h2>
        <p className="text-sm text-gray-500 mt-1">
          Verify the parsed integrations before calculating costs. You can edit
          any values below.
        </p>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <Card>
          <CardContent className="p-5 text-center">
            <p className="text-3xl font-bold text-gray-900">
              {analysis.totalIntegrations}
            </p>
            <p className="text-sm text-gray-500 mt-1">Total Integrations</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2 pt-4 px-5">
            <CardTitle className="text-sm font-medium text-gray-500">
              By Adapter Type
            </CardTitle>
          </CardHeader>
          <CardContent className="px-5 pb-4">
            <HorizontalBar
              items={adapterBreakdown}
              colorMap={ADAPTER_COLORS}
              total={analysis.totalIntegrations}
            />
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2 pt-4 px-5">
            <CardTitle className="text-sm font-medium text-gray-500">
              By Complexity
            </CardTitle>
          </CardHeader>
          <CardContent className="px-5 pb-4">
            <HorizontalBar
              items={complexityBreakdown}
              colorMap={COMPLEXITY_COLORS}
              total={analysis.totalIntegrations}
            />
          </CardContent>
        </Card>
      </div>

      {/* Volume Estimate */}
      {analysis.volumeEstimate && (
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-gray-500">
              Volume Estimates
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 text-sm">
              <div>
                <p className="text-gray-400 text-xs">Low msgs/day</p>
                <p className="font-semibold text-gray-800">
                  {analysis.volumeEstimate.messagesPerDayLow.toLocaleString(
                    "sv-SE"
                  )}
                </p>
              </div>
              <div>
                <p className="text-gray-400 text-xs">Avg msgs/day</p>
                <p className="font-semibold text-gray-800">
                  {analysis.volumeEstimate.messagesPerDayAvg.toLocaleString(
                    "sv-SE"
                  )}
                </p>
              </div>
              <div>
                <p className="text-gray-400 text-xs">Peak msgs/day</p>
                <p className="font-semibold text-gray-800">
                  {analysis.volumeEstimate.messagesPerDayPeak.toLocaleString(
                    "sv-SE"
                  )}
                </p>
              </div>
              <div>
                <p className="text-gray-400 text-xs">Avg size (KB)</p>
                <p className="font-semibold text-gray-800">
                  {analysis.volumeEstimate.avgMessageSizeKB.toLocaleString(
                    "sv-SE"
                  )}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Existing Azure Services */}
      {analysis.existingAzureServices &&
        analysis.existingAzureServices.length > 0 && (
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-gray-500">
                Existing Azure Services Detected
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex flex-wrap gap-2">
                {analysis.existingAzureServices.map((svc) => (
                  <span
                    key={svc}
                    className="px-2.5 py-1 bg-blue-50 text-blue-700 text-xs rounded-full border border-blue-200"
                  >
                    {svc}
                  </span>
                ))}
              </div>
            </CardContent>
          </Card>
        )}

      {/* Notes */}
      {analysis.notes && analysis.notes.length > 0 && (
        <div className="flex items-start gap-3 rounded-lg border border-amber-200 bg-amber-50 p-4">
          <AlertTriangle className="h-5 w-5 text-amber-600 shrink-0 mt-0.5" />
          <div>
            <p className="font-medium text-amber-800 text-sm">Notes</p>
            <ul className="mt-1 list-disc list-inside text-sm text-amber-700 space-y-0.5">
              {analysis.notes.map((note, i) => (
                <li key={i}>{note}</li>
              ))}
            </ul>
          </div>
        </div>
      )}

      {/* Editable Table */}
      <IntegrationEditor analysis={analysis} onChange={setAnalysis} />

      {/* Actions */}
      <div className="flex items-center justify-between pt-2 border-t border-gray-200">
        <Button variant="outline" onClick={onBack}>
          ← Back to Input
        </Button>
        <Button onClick={() => onConfirm(analysis)}>
          Calculate Costs →
        </Button>
      </div>
    </div>
  );
}
