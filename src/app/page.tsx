"use client";

import React, { useState, useEffect } from "react";
import { InputForm, type InputFormPayload } from "@/components/InputForm";
import ReviewStep from "@/components/ReviewStep";
import ResultsView from "@/components/ResultsView";
import { SaveEstimatePanel } from "@/components/SaveEstimatePanel";
import type { AppStep, BizTalkAnalysis, CostEstimationResult, SupportedCurrency } from "@/lib/types";

const STEPS = [
  { id: "input", label: "Input", num: 1 },
  { id: "review", label: "Review", num: 2 },
  { id: "results", label: "Results", num: 3 },
] as const;

function StepIndicator({ current }: { current: AppStep }) {
  const activeIdx = current === "calculating" ? 2 : STEPS.findIndex(s => s.id === current);
  return (
    <div className="flex items-center gap-0">
      {STEPS.map((step, idx) => {
        const done = idx < activeIdx;
        const active = idx === activeIdx;
        return (
          <React.Fragment key={step.id}>
            <div className="flex items-center gap-2">
              <div className={[
                "w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold transition-colors",
                done ? "bg-[#0078D4] text-white" : active ? "bg-[#0078D4] text-white ring-4 ring-blue-100" : "bg-gray-200 text-gray-500"
              ].join(" ")}>
                {done ? (
                  <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                  </svg>
                ) : step.num}
              </div>
              <span className={[
                "text-sm font-medium hidden sm:block",
                active ? "text-gray-900" : done ? "text-[#0078D4]" : "text-gray-400"
              ].join(" ")}>{step.label}</span>
            </div>
            {idx < STEPS.length - 1 && (
              <div className={["h-px w-12 mx-3 transition-colors", idx < activeIdx ? "bg-[#0078D4]" : "bg-gray-200"].join(" ")} />
            )}
          </React.Fragment>
        );
      })}
    </div>
  );
}

export default function Home() {
  const [step, setStep] = useState<AppStep>("input");
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | undefined>();
  const [analysis, setAnalysis] = useState<BizTalkAnalysis | null>(null);
  const [costResult, setCostResult] = useState<CostEstimationResult | null>(null);
  const [selectedRegion, setSelectedRegion] = useState("swedencentral");
  const [selectedCurrency, setSelectedCurrency] = useState<SupportedCurrency>("SEK");
  const [rawInput, setRawInput] = useState<Record<string, unknown>>({});

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
        body: JSON.stringify({ format: payload.format, content: payload.content }),
      });
      if (!parseRes.ok) {
        const body = await parseRes.json().catch(() => ({}));
        throw new Error(body.error || `Parse failed (${parseRes.status})`);
      }
      const parseData = await parseRes.json();
      setAnalysis(parseData.analysis);
      setStep("review");
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "An unexpected error occurred");
      setStep("input");
    } finally {
      setIsLoading(false);
    }
  };

  const handleConfirm = async (confirmedAnalysis: BizTalkAnalysis) => {
    setAnalysis(confirmedAnalysis);
    setStep("calculating");
    setError(undefined);

    try {
      const costRes = await fetch("/api/calculate-cost", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ analysis: confirmedAnalysis, region: selectedRegion, currency: selectedCurrency }),
      });
      if (!costRes.ok) {
        const body = await costRes.json().catch(() => ({}));
        throw new Error(body.error || `Cost calculation failed (${costRes.status})`);
      }
      const costData = await costRes.json();
      setCostResult(costData.result);
      setStep("results");
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "An unexpected error occurred");
      setStep("review");
    }
  };

  const handleReset = () => {
    setStep("input");
    setError(undefined);
    setAnalysis(null);
    setCostResult(null);
  };

  const showWideLayout = step === "results";

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Hero banner — only on input step */}
      {step === "input" && (
        <div className="bg-gradient-to-br from-[#1a1f2e] to-[#0d1117] text-white">
          <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
            <div className="flex items-start gap-4">
              <div className="shrink-0 w-12 h-12 rounded-xl bg-[#0078D4] flex items-center justify-center shadow-lg shadow-blue-900/40">
                <svg className="w-6 h-6 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M9 7h6m0 10v-3m-3 3h.01M9 17h.01M9 14h.01M12 14h.01M15 11h.01M12 11h.01M9 11h.01M7 21h10a2 2 0 002-2V5a2 2 0 00-2-2H7a2 2 0 00-2 2v14a2 2 0 002 2z" />
                </svg>
              </div>
              <div>
                <h1 className="text-2xl font-bold tracking-tight">
                  BizTalk → Azure Cost Calculator
                </h1>
                <p className="mt-1.5 text-gray-400 text-sm max-w-xl">
                  Upload a BizTalk analysis file, paste a description, or enter numbers manually.
                  Get a live Azure cost estimate mapped to real services and current pricing.
                </p>
                <div className="mt-4 flex flex-wrap gap-2">
                  {["Live Azure pricing API", "Sweden Central", "Reservations savings", "PDF + Excel export"].map(tag => (
                    <span key={tag} className="text-xs bg-white/10 text-gray-300 px-2.5 py-1 rounded-full border border-white/10">
                      {tag}
                    </span>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Step indicator bar */}
      {step !== "input" && (
        <div className="bg-white border-b border-gray-200 shadow-sm">
          <div className={`mx-auto px-4 sm:px-6 lg:px-8 py-3 flex items-center justify-between ${showWideLayout ? 'max-w-7xl' : 'max-w-4xl'}`}>
            <StepIndicator current={step} />
            {step !== "results" && (
              <button
                onClick={handleReset}
                className="text-sm text-gray-400 hover:text-gray-600 transition-colors"
              >
                ← Start over
              </button>
            )}
          </div>
        </div>
      )}

      {/* Main content */}
      <div className={`mx-auto px-4 sm:px-6 lg:px-8 py-8 ${showWideLayout ? 'max-w-7xl' : 'max-w-4xl'}`}>
        {step === "input" && (
          <div className="space-y-5">
            <div className="bg-blue-50 border border-blue-200 rounded-xl px-4 py-3 text-sm text-blue-800 flex items-start gap-3">
              <svg className="w-4 h-4 mt-0.5 shrink-0 text-blue-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              <span>Supports BizTalk analysis JSON/Markdown, binding XML, or plain text (Swedish and English). AI parsing is used automatically when you have a GitHub connection.</span>
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
          <div className="flex flex-col items-center justify-center gap-5 py-32">
            <div className="relative">
              <div className="w-14 h-14 rounded-full border-4 border-gray-200 border-t-[#0078D4] animate-spin" />
              <div className="absolute inset-0 flex items-center justify-center">
                <div className="w-6 h-6 rounded-full bg-[#0078D4]/10" />
              </div>
            </div>
            <div className="text-center">
              <p className="font-semibold text-gray-800">Calculating Azure costs…</p>
              <p className="text-sm text-gray-500 mt-1">Fetching live pricing from the Azure Retail Prices API</p>
            </div>
            {error && (
              <div className="bg-red-50 border border-red-200 rounded-lg px-4 py-3 text-sm text-red-700 max-w-md">
                {error}
              </div>
            )}
          </div>
        )}

        {step === "results" && costResult && (
          <div className="space-y-6">
            <ResultsView result={costResult} onReset={handleReset} />
            <SaveEstimatePanel
              analysis={analysis as unknown as Record<string, unknown>}
              mappings={((costResult as unknown as { mappings?: unknown[] }).mappings) ?? []}
              costResult={costResult as unknown as Record<string, unknown>}
              rawInput={rawInput}
              region={selectedRegion}
              currency={selectedCurrency}
            />
          </div>
        )}
      </div>
    </div>
  );
}