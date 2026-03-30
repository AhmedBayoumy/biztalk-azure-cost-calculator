"use client";

import type { CostEstimationResult } from "@/lib/types";
import CostSummary from "@/components/CostSummary";
import CostBreakdown from "@/components/CostBreakdown";
import ExportButtons from "@/components/ExportButtons";
import ArchitectureDiagram from "@/components/ArchitectureDiagram";

interface ResultsViewProps {
  result: CostEstimationResult;
  onReset: () => void;
  diagramString?: string;
}

export default function ResultsView({ result, onReset, diagramString }: ResultsViewProps) {
  return (
    <div className="space-y-6">
      {/* Page header */}
      <div className="flex items-start justify-between">
        <div>
          <h2 className="text-xl font-bold text-gray-900">Cost Estimation Results</h2>
          <p className="text-sm text-gray-500 mt-0.5">
            Azure migration cost estimate · {result.categories.reduce((n, c) => n + c.services.length, 0)} services mapped
          </p>
        </div>
        <button
          onClick={onReset}
          className="text-sm text-gray-500 hover:text-gray-800 bg-white border border-gray-200 hover:border-gray-300 px-4 py-2 rounded-lg transition-colors shadow-sm"
        >
          ← New estimate
        </button>
      </div>

      {/* Summary cards */}
      <CostSummary result={result} />

      {/* Architecture Diagram */}
      {diagramString && <ArchitectureDiagram diagram={diagramString} />}

      {/* Export */}
      <ExportButtons result={result} onReset={onReset} />

      {/* Breakdown */}
      <div>
        <h3 className="text-base font-semibold text-gray-900 mb-3 flex items-center gap-2">
          <span className="w-5 h-5 rounded bg-[#0078D4]/10 flex items-center justify-center">
            <svg className="w-3 h-3 text-[#0078D4]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
            </svg>
          </span>
          Detailed Cost Breakdown
        </h3>
        <CostBreakdown result={result} />
      </div>
    </div>
  );
}
