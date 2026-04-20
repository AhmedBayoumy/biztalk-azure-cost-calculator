"use client";

import React, { useEffect, useRef, useState, useId } from "react";

interface ArchitectureDiagramProps {
  diagram: string;
}

export default function ArchitectureDiagram({ diagram }: ArchitectureDiagramProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [svgContent, setSvgContent] = useState<string | null>(null);
  const [renderError, setRenderError] = useState(false);
  const [copied, setCopied] = useState(false);
  const uniqueId = useId().replace(/:/g, "");

  useEffect(() => {
    let cancelled = false;

    async function renderDiagram() {
      try {
        const mermaid = (await import("mermaid")).default;
        mermaid.initialize({
          startOnLoad: false,
          theme: "default",
          securityLevel: "loose",
        });

        const { svg } = await mermaid.render(`mermaid-${uniqueId}`, diagram);
        if (!cancelled) {
          setSvgContent(svg);
          setRenderError(false);
        }
      } catch {
        if (!cancelled) {
          setRenderError(true);
          setSvgContent(null);
        }
      }
    }

    renderDiagram();
    return () => { cancelled = true; };
  }, [diagram, uniqueId]);

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(diagram);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // Fallback for insecure contexts
      const textarea = document.createElement("textarea");
      textarea.value = diagram;
      document.body.appendChild(textarea);
      textarea.select();
      document.execCommand("copy");
      document.body.removeChild(textarea);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  return (
    <div className="rounded-lg border border-gray-200 bg-white">
      {/* Header */}
      <div className="flex items-center justify-between border-b border-gray-200 px-5 py-3">
        <h3 className="text-lg font-semibold text-gray-800">
          Target Architecture
        </h3>
        <button
          onClick={handleCopy}
          className="inline-flex items-center gap-1.5 rounded-md border border-gray-300 bg-white px-3 py-1.5 text-xs font-medium text-gray-700 shadow-sm hover:bg-gray-50 transition-colors"
        >
          {copied ? (
            <>
              <svg className="h-3.5 w-3.5 text-green-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
              </svg>
              Copied!
            </>
          ) : (
            <>
              <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
              </svg>
              Copy Mermaid
            </>
          )}
        </button>
      </div>

      {/* Diagram */}
      <div className="p-5">
        {renderError ? (
          <div className="space-y-3">
            <p className="text-sm text-amber-600">
              Diagram could not be rendered. Showing raw Mermaid markup:
            </p>
            <pre className="overflow-x-auto rounded-md bg-gray-50 p-4 text-xs text-gray-700 leading-relaxed">
              {diagram}
            </pre>
          </div>
        ) : svgContent ? (
          <div
            ref={containerRef}
            className="flex justify-center overflow-x-auto"
            dangerouslySetInnerHTML={{ __html: svgContent }}
          />
        ) : (
          <div className="flex items-center justify-center py-12">
            <div className="h-6 w-6 animate-spin rounded-full border-2 border-gray-200 border-t-[#0078D4]" />
            <span className="ml-2 text-sm text-gray-500">Rendering diagram…</span>
          </div>
        )}
      </div>
    </div>
  );
}
