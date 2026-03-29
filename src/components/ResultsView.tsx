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
    <div className="space-y-8">
      {/* Header */}
      <div>
        <h2 className="text-xl font-bold text-gray-900">
          Cost Estimation Results
        </h2>
        <p className="text-sm text-gray-500 mt-1">
          Azure migration cost estimate for your BizTalk integrations.
        </p>
      </div>

      {/* Summary Cards */}
      <CostSummary result={result} />

      {/* Architecture Diagram */}
      {diagramString && <ArchitectureDiagram diagram={diagramString} />}

      {/* Export Actions */}
      <ExportButtons result={result} onReset={onReset} />

      {/* Detailed Breakdown */}
      <div>
        <h3 className="text-lg font-semibold text-gray-800 mb-3">
          Detailed Breakdown
        </h3>
        <CostBreakdown result={result} />
      </div>
    </div>
  );
}
