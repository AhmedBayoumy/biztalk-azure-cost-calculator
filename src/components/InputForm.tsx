"use client";

import React, { useState, useCallback } from "react";
import { Upload, ClipboardPaste, Settings2, Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { Textarea } from "@/components/ui/textarea";
import { FileUpload } from "@/components/FileUpload";
import { CurrencySelector } from "@/components/CurrencySelector";
import {
  DEFAULT_CURRENCY,
  DEFAULT_REGION,
  type InputFormat,
  type SupportedCurrency,
} from "@/lib/types";

type InputMode = "upload" | "paste" | "manual";

interface ManualData {
  totalIntegrations: number;
  pctFileTransfers: number;
  pctHttpApi: number;
  pctDatabase: number;
  pctMessaging: number;
  pctOther: number;
  messagesPerDay: number;
}

export interface InputFormPayload {
  format: InputFormat;
  content: string;
  region: string;
  currency: SupportedCurrency;
}

interface InputFormProps {
  onSubmit: (payload: InputFormPayload) => void;
  isLoading: boolean;
  error?: string;
}

const TABS: { id: InputMode; label: string; icon: React.ReactNode; desc: string }[] = [
  { id: "upload", label: "Upload File", icon: <Upload className="h-4 w-4" />, desc: "JSON, Markdown, XML, TXT" },
  { id: "paste", label: "Paste Text", icon: <ClipboardPaste className="h-4 w-4" />, desc: "Any language description" },
  { id: "manual", label: "Manual Entry", icon: <Settings2 className="h-4 w-4" />, desc: "Enter numbers directly" },
];

const defaultManual: ManualData = {
  totalIntegrations: 10,
  pctFileTransfers: 20,
  pctHttpApi: 30,
  pctDatabase: 20,
  pctMessaging: 20,
  pctOther: 10,
  messagesPerDay: 5000,
};

function detectFormat(fileName: string): InputFormat {
  const ext = fileName.split(".").pop()?.toLowerCase();
  switch (ext) {
    case "json": return "json";
    case "md": return "markdown";
    case "xml": return "xml-binding";
    default: return "text";
  }
}

export function InputForm({ onSubmit, isLoading, error }: InputFormProps) {
  const [mode, setMode] = useState<InputMode>("upload");
  const [currency, setCurrency] = useState<SupportedCurrency>(DEFAULT_CURRENCY);
  const [region, setRegion] = useState(DEFAULT_REGION);
  const [fileContent, setFileContent] = useState<string | null>(null);
  const [fileFormat, setFileFormat] = useState<InputFormat>("text");
  const [pasteContent, setPasteContent] = useState("");
  const [manual, setManual] = useState<ManualData>(defaultManual);

  const handleFileLoaded = useCallback((content: string, fileName: string) => {
    setFileContent(content);
    setFileFormat(detectFormat(fileName));
  }, []);

  const updateManual = (key: keyof ManualData, value: number) => {
    setManual((prev) => ({ ...prev, [key]: value }));
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    let format: InputFormat;
    let content: string;

    if (mode === "upload") {
      if (!fileContent) return;
      format = fileFormat;
      content = fileContent;
    } else if (mode === "paste") {
      if (!pasteContent.trim()) return;
      format = "text";
      content = pasteContent;
    } else {
      format = "text";
      content = [
        `Total integrations: ${manual.totalIntegrations}`,
        `File transfers: ${manual.pctFileTransfers}%`,
        `HTTP/API: ${manual.pctHttpApi}%`,
        `Database: ${manual.pctDatabase}%`,
        `Messaging: ${manual.pctMessaging}%`,
        `Other: ${manual.pctOther}%`,
        `Estimated messages per day: ${manual.messagesPerDay}`,
      ].join("\n");
    }

    onSubmit({ format, content, region, currency });
  };

  const canSubmit =
    !isLoading &&
    ((mode === "upload" && fileContent !== null) ||
      (mode === "paste" && pasteContent.trim().length > 0) ||
      mode === "manual");

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      {/* Tab bar */}
      <div className="grid grid-cols-3 gap-2">
        {TABS.map((tab) => (
          <button
            key={tab.id}
            type="button"
            onClick={() => setMode(tab.id)}
            className={cn(
              "flex flex-col items-center gap-1.5 rounded-xl border-2 px-3 py-3 text-center transition-all",
              mode === tab.id
                ? "border-[#0078D4] bg-[#0078D4]/5 text-[#0078D4]"
                : "border-gray-200 bg-white text-gray-500 hover:border-gray-300 hover:text-gray-700"
            )}
          >
            <span className={cn("p-1.5 rounded-lg", mode === tab.id ? "bg-[#0078D4]/10" : "bg-gray-100")}>
              {tab.icon}
            </span>
            <span className="text-xs font-semibold leading-tight">{tab.label}</span>
            <span className="text-[10px] text-gray-400 leading-tight hidden sm:block">{tab.desc}</span>
          </button>
        ))}
      </div>

      {/* Tab content */}
      <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-5">
        {mode === "upload" && (
          <div className="space-y-3">
            <p className="text-sm text-gray-500">
              Upload a BizTalk analysis export — JSON, markdown report, XML binding file, or any text description.
            </p>
            <FileUpload onFileLoaded={handleFileLoaded} />
          </div>
        )}

        {mode === "paste" && (
          <div className="space-y-3">
            <p className="text-sm text-gray-500">
              Paste a description of your BizTalk environment. Swedish and English are both supported.
            </p>
            <Textarea
              placeholder={`Example:\nVi har ca 120 Biztalkburna integrationer. Nånstans 25-30% är enkla file transfers.\nVolym: ca 2 miljoner events per 3 dagar vid peak.\nVi använder Logic Apps, Container Apps, Azure Functions, APIM, Service Bus...`}
              value={pasteContent}
              onChange={(e) => setPasteContent(e.target.value)}
              className="min-h-[200px] text-sm resize-none"
            />
          </div>
        )}

        {mode === "manual" && (
          <div className="space-y-5">
            <p className="text-sm text-gray-500">
              Enter high-level numbers about your BizTalk environment.
            </p>
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <NumberField label="Total Integrations" value={manual.totalIntegrations} onChange={(v) => updateManual("totalIntegrations", v)} min={1} max={500} />
              <NumberField label="Messages / Day" value={manual.messagesPerDay} onChange={(v) => updateManual("messagesPerDay", v)} min={0} step={100} />
            </div>
            <div>
              <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-3">Integration Mix</p>
              <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
                <NumberField label="File Transfers" value={manual.pctFileTransfers} onChange={(v) => updateManual("pctFileTransfers", v)} min={0} max={100} suffix="%" />
                <NumberField label="HTTP / API" value={manual.pctHttpApi} onChange={(v) => updateManual("pctHttpApi", v)} min={0} max={100} suffix="%" />
                <NumberField label="Database" value={manual.pctDatabase} onChange={(v) => updateManual("pctDatabase", v)} min={0} max={100} suffix="%" />
                <NumberField label="Messaging" value={manual.pctMessaging} onChange={(v) => updateManual("pctMessaging", v)} min={0} max={100} suffix="%" />
                <NumberField label="Other" value={manual.pctOther} onChange={(v) => updateManual("pctOther", v)} min={0} max={100} suffix="%" />
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Region & Currency */}
      <CurrencySelector currency={currency} region={region} onCurrencyChange={setCurrency} onRegionChange={setRegion} />

      {/* Error */}
      {error && (
        <div className="flex items-start gap-3 rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">
          <svg className="w-4 h-4 mt-0.5 shrink-0 text-red-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-2.694-.833-3.464 0L3.34 16.5c-.77.833.192 2.5 1.732 2.5z" />
          </svg>
          <span>{error}</span>
        </div>
      )}

      {/* Submit */}
      <button
        type="submit"
        disabled={!canSubmit}
        className="w-full h-12 rounded-xl bg-[#0078D4] hover:bg-[#106EBE] disabled:opacity-40 disabled:cursor-not-allowed text-white font-semibold text-sm transition-colors flex items-center justify-center gap-2 shadow-sm shadow-blue-900/20"
      >
        {isLoading ? (
          <>
            <Loader2 className="h-4 w-4 animate-spin" />
            Analysing…
          </>
        ) : (
          <>
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M13 10V3L4 14h7v7l9-11h-7z" />
            </svg>
            Calculate Azure Cost
          </>
        )}
      </button>
    </form>
  );
}

/* ── Inline helper ── */

interface NumberFieldProps {
  label: string;
  value: number;
  onChange: (v: number) => void;
  min?: number;
  max?: number;
  step?: number;
  suffix?: string;
}

function NumberField({ label, value, onChange, min, max, step = 1, suffix }: NumberFieldProps) {
  return (
    <div className="space-y-1">
      <label className="block text-xs font-semibold text-gray-600">{label}</label>
      <div className="relative">
        <input
          type="number"
          value={value}
          onChange={(e) => onChange(Number(e.target.value))}
          min={min}
          max={max}
          step={step}
          className="h-9 w-full rounded-lg border border-gray-300 bg-white px-3 text-sm focus:outline-none focus:ring-2 focus:ring-[#0078D4] focus:border-transparent"
        />
        {suffix && (
          <span className="absolute right-3 top-1/2 -translate-y-1/2 text-sm text-gray-400 pointer-events-none">
            {suffix}
          </span>
        )}
      </div>
    </div>
  );
}
