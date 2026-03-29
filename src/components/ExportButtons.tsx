"use client";

import { useState } from "react";
import type { CostEstimationResult } from "@/lib/types";
import { Button } from "@/components/ui/button";
import { Download, FileSpreadsheet, RefreshCw } from "lucide-react";

interface ExportButtonsProps {
  result: CostEstimationResult;
  onReset: () => void;
}

async function downloadBlob(url: string, body: object, filename: string) {
  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  if (!res.ok) throw new Error(`Export failed: ${res.statusText}`);
  const blob = await res.blob();
  const a = document.createElement("a");
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
      await downloadBlob("/api/export-pdf", { result }, "biztalk-cost-estimate.pdf");
    } catch (e) {
      setError(e instanceof Error ? e.message : "PDF export failed");
    } finally {
      setPdfLoading(false);
    }
  };

  const handleExcel = async () => {
    setXlsxLoading(true);
    setError(null);
    try {
      await downloadBlob(
        "/api/export-excel",
        { result },
        "biztalk-cost-estimate.xlsx"
      );
    } catch (e) {
      setError(e instanceof Error ? e.message : "Excel export failed");
    } finally {
      setXlsxLoading(false);
    }
  };

  return (
    <div className="space-y-2">
      <div className="flex flex-wrap items-center gap-3">
        <Button onClick={handlePdf} disabled={pdfLoading} variant="outline">
          <Download className="h-4 w-4 mr-2" />
          {pdfLoading ? "Exporting…" : "Export PDF"}
        </Button>

        <Button onClick={handleExcel} disabled={xlsxLoading} variant="outline">
          <FileSpreadsheet className="h-4 w-4 mr-2" />
          {xlsxLoading ? "Exporting…" : "Export Excel"}
        </Button>

        <Button onClick={onReset} variant="ghost">
          <RefreshCw className="h-4 w-4 mr-2" />
          New Calculation
        </Button>
      </div>

      {error && (
        <p className="text-sm text-red-600">{error}</p>
      )}
    </div>
  );
}
