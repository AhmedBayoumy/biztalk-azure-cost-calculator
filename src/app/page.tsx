"use client";

import React, { useState, useEffect } from "react";
import { InputForm, type InputFormPayload } from "@/components/InputForm";
import ReviewStep from "@/components/ReviewStep";
import ResultsView from "@/components/ResultsView";
import { SaveEstimatePanel } from "@/components/SaveEstimatePanel";
import type { AppStep, BizTalkAnalysis, CostEstimationResult, SupportedCurrency } from "@/lib/types";

export default function Home() {
  const [step, setStep] = useState<AppStep>("input");
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | undefined>();
  const [analysis, setAnalysis] = useState<BizTalkAnalysis | null>(null);
  const [costResult, setCostResult] = useState<CostEstimationResult | null>(null);
  const [selectedRegion, setSelectedRegion] = useState("swedencentral");
  const [selectedCurrency, setSelectedCurrency] = useState<SupportedCurrency>("SEK");
  const [rawInput, setRawInput] = useState<Record<string, unknown>>({});

  // Restore estimate from sessionStorage (e.g. loaded from Clients page)
  useEffect(() => {
    const stored = sessionStorage.getItem('loadEstimate');
    if (stored) {
      try {
        const estimate = JSON.parse(stored);
        sessionStorage.removeItem('loadEstimate');
        if (estimate.analysis) setAnalysis(estimate.analysis);
        if (estimate.cost_result) setCostResult(estimate.cost_result);
        setStep('results');
      } catch { /* ignore */ }
    }
  }, []);

  // Step 1: Parse input -> show ReviewStep
  const handleSubmit = async (payload: InputFormPayload) => {
    setIsLoading(true);
    setError(undefined);
    setSelectedRegion(payload.region);
    setSelectedCurrency(payload.currency);
    setRawInput({ format: payload.format, content: payload.content });

    try {
      const parseRes = await fetch("/api/parse-input", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          format: payload.format,
          content: payload.content,
        }),
      });

      if (!parseRes.ok) {
        const body = await parseRes.json().catch(() => ({}));
        throw new Error(body.error || `Parse failed (${parseRes.status})`);
      }

      const parseData = await parseRes.json();
      setAnalysis(parseData.analysis);
      setStep("review");
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "An unexpected error occurred";
      setError(message);
      setStep("input");
    } finally {
      setIsLoading(false);
    }
  };

  // Step 2: User confirms (possibly edited) analysis -> calculate costs
  const handleConfirm = async (confirmedAnalysis: BizTalkAnalysis) => {
    setAnalysis(confirmedAnalysis);
    setStep("calculating");
    setError(undefined);

    try {
      const costRes = await fetch("/api/calculate-cost", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          analysis: confirmedAnalysis,
          region: selectedRegion,
          currency: selectedCurrency,
        }),
      });

      if (!costRes.ok) {
        const body = await costRes.json().catch(() => ({}));
        throw new Error(body.error || `Cost calculation failed (${costRes.status})`);
      }

      const costData = await costRes.json();
      setCostResult(costData.result);
      setStep("results");
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "An unexpected error occurred";
      setError(message);
      setStep("review");
    }
  };

  const handleReset = () => {
    setStep("input");
    setError(undefined);
    setAnalysis(null);
    setCostResult(null);
  };

  return (
    <div className="min-h-screen">
      {/* Header */}
      <header className="border-b border-gray-200 bg-white">
        <div className="mx-auto max-w-3xl px-4 py-8 sm:px-6 lg:px-8">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-[#0078D4]">
              <svg className="h-5 w-5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M9 7h6m0 10v-3m-3 3h.01M9 17h.01M9 14h.01M12 14h.01M15 11h.01M12 11h.01M9 11h.01M7 21h10a2 2 0 002-2V5a2 2 0 00-2-2H7a2 2 0 00-2 2v14a2 2 0 002 2z" />
              </svg>
            </div>
            <div>
              <h1 className="text-2xl font-bold tracking-tight text-gray-900">
                BizTalk Migration Cost Calculator
              </h1>
              <p className="text-sm text-gray-500">
                Estimate Azure costs for BizTalk Server migrations
              </p>
            </div>
          </div>
        </div>
      </header>

      {/* Main content */}
      <main className="mx-auto max-w-3xl px-4 py-8 sm:px-6 lg:px-8">
        {step === "input" && (
          <div className="space-y-6">
            <div className="rounded-lg border border-blue-100 bg-blue-50 p-4 text-sm text-blue-800">
              Upload a BizTalk analysis file, paste a description of your integrations, or enter numbers
              manually. The tool will map your BizTalk workloads to Azure services and estimate monthly costs.
            </div>
            <InputForm onSubmit={handleSubmit} isLoading={isLoading} error={error} />
          </div>
        )}

        {step === "review" && analysis && (
          <ReviewStep
            analysis={analysis}
            onConfirm={handleConfirm}
            onBack={() => setStep("input")}
          />
        )}

        {step === "calculating" && (
          <div className="flex flex-col items-center justify-center gap-4 py-24">
            <div className="h-10 w-10 animate-spin rounded-full border-4 border-gray-200 border-t-[#0078D4]" />
            <p className="text-sm font-medium text-gray-600">
              Calculating Azure costs...
            </p>
            <p className="text-xs text-gray-400">
              Fetching live pricing from the Azure Retail Prices API
            </p>
            {error && (
              <p className="text-sm text-red-600 mt-2">{error}</p>
            )}
          </div>
        )}

        {step === "results" && costResult && (
          <>
            <ResultsView result={costResult} onReset={handleReset} />
            <div className="max-w-4xl mx-auto px-4 mt-6">
              <SaveEstimatePanel
                analysis={analysis as unknown as Record<string, unknown>}
                mappings={((costResult as unknown as { mappings?: unknown[] }).mappings) ?? []}
                costResult={costResult as unknown as Record<string, unknown>}
                rawInput={rawInput}
                region={selectedRegion}
                currency={selectedCurrency}
              />
            </div>
          </>
        )}
      </main>
    </div>
  );
}