"use client";

import React, { useState, useCallback } from "react";
import { Upload, ClipboardPaste, Settings2, Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
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

const TABS: { id: InputMode; label: string; icon: React.ReactNode }[] = [
  { id: "upload", label: "Upload File", icon: <Upload className="h-4 w-4" /> },
  { id: "paste", label: "Paste Text", icon: <ClipboardPaste className="h-4 w-4" /> },
  { id: "manual", label: "Manual Entry", icon: <Settings2 className="h-4 w-4" /> },
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
    case "json":
      return "json";
    case "md":
      return "markdown";
    case "xml":
      return "xml-binding";
    default:
      return "text";
  }
}

export function InputForm({ onSubmit, isLoading, error }: InputFormProps) {
  const [mode, setMode] = useState<InputMode>("upload");
  const [currency, setCurrency] = useState<SupportedCurrency>(DEFAULT_CURRENCY);
  const [region, setRegion] = useState(DEFAULT_REGION);

  // Upload state
  const [fileContent, setFileContent] = useState<string | null>(null);
  const [fileFormat, setFileFormat] = useState<InputFormat>("text");

  // Paste state
  const [pasteContent, setPasteContent] = useState("");

  // Manual state
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
    <form onSubmit={handleSubmit} className="space-y-6">
      {/* Tab bar */}
      <div className="flex rounded-lg border border-gray-200 bg-gray-50 p-1">
        {TABS.map((tab) => (
          <button
            key={tab.id}
            type="button"
            onClick={() => setMode(tab.id)}
            className={cn(
              "flex flex-1 items-center justify-center gap-2 rounded-md px-3 py-2 text-sm font-medium transition-colors",
              mode === tab.id
                ? "bg-white text-[#0078D4] shadow-sm"
                : "text-gray-500 hover:text-gray-700"
            )}
          >
            {tab.icon}
            <span className="hidden sm:inline">{tab.label}</span>
          </button>
        ))}
      </div>

      {/* Tab content */}
      <Card>
        <CardContent className="pt-6">
          {mode === "upload" && (
            <div className="space-y-3">
              <p className="text-sm text-gray-600">
                Upload a BizTalk analysis file — JSON export, markdown report, XML binding, or plain text description.
              </p>
              <FileUpload onFileLoaded={handleFileLoaded} />
            </div>
          )}

          {mode === "paste" && (
            <div className="space-y-3">
              <p className="text-sm text-gray-600">
                Paste a description of your BizTalk integrations or an analysis output.
              </p>
              <Textarea
                placeholder={`Example:\nWe have 15 BizTalk integrations:\n- 5 file-based integrations (SFTP)\n- 4 REST API integrations\n- 3 database integrations (SQL Server)\n- 2 messaging integrations (MQ Series)\n- 1 SAP integration\nApproximately 10,000 messages per day.`}
                value={pasteContent}
                onChange={(e) => setPasteContent(e.target.value)}
                className="min-h-[200px]"
              />
            </div>
          )}

          {mode === "manual" && (
            <div className="space-y-4">
              <p className="text-sm text-gray-600">
                Enter high-level numbers about your BizTalk environment.
              </p>
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <NumberField
                  label="Total Integrations"
                  value={manual.totalIntegrations}
                  onChange={(v) => updateManual("totalIntegrations", v)}
                  min={1}
                  max={500}
                />
                <NumberField
                  label="Messages / Day"
                  value={manual.messagesPerDay}
                  onChange={(v) => updateManual("messagesPerDay", v)}
                  min={0}
                  step={100}
                />
              </div>
              <p className="text-xs font-medium text-gray-500 uppercase tracking-wide">
                Integration Mix (%)
              </p>
              <div className="grid grid-cols-2 gap-4 sm:grid-cols-3">
                <NumberField
                  label="File Transfers"
                  value={manual.pctFileTransfers}
                  onChange={(v) => updateManual("pctFileTransfers", v)}
                  min={0}
                  max={100}
                  suffix="%"
                />
                <NumberField
                  label="HTTP / API"
                  value={manual.pctHttpApi}
                  onChange={(v) => updateManual("pctHttpApi", v)}
                  min={0}
                  max={100}
                  suffix="%"
                />
                <NumberField
                  label="Database"
                  value={manual.pctDatabase}
                  onChange={(v) => updateManual("pctDatabase", v)}
                  min={0}
                  max={100}
                  suffix="%"
                />
                <NumberField
                  label="Messaging"
                  value={manual.pctMessaging}
                  onChange={(v) => updateManual("pctMessaging", v)}
                  min={0}
                  max={100}
                  suffix="%"
                />
                <NumberField
                  label="Other"
                  value={manual.pctOther}
                  onChange={(v) => updateManual("pctOther", v)}
                  min={0}
                  max={100}
                  suffix="%"
                />
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Currency & Region */}
      <CurrencySelector
        currency={currency}
        region={region}
        onCurrencyChange={setCurrency}
        onRegionChange={setRegion}
      />

      {/* Error */}
      {error && (
        <div className="rounded-md border border-red-200 bg-red-50 p-3 text-sm text-red-700">
          {error}
        </div>
      )}

      {/* Submit */}
      <Button type="submit" size="lg" className="w-full" disabled={!canSubmit}>
        {isLoading ? (
          <>
            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            Analyzing…
          </>
        ) : (
          "Calculate Cost"
        )}
      </Button>
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
      <label className="block text-sm font-medium text-gray-700">
        {label}
      </label>
      <div className="relative">
        <input
          type="number"
          value={value}
          onChange={(e) => onChange(Number(e.target.value))}
          min={min}
          max={max}
          step={step}
          className="h-10 w-full rounded-md border border-gray-300 bg-white px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#0078D4] focus-visible:ring-offset-1"
        />
        {suffix && (
          <span className="absolute right-3 top-1/2 -translate-y-1/2 text-sm text-gray-400">
            {suffix}
          </span>
        )}
      </div>
    </div>
  );
}
