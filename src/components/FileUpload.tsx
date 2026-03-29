"use client";

import React, { useCallback, useRef, useState } from "react";
import { Upload, FileText, X } from "lucide-react";
import { cn } from "@/lib/utils";

interface FileUploadProps {
  onFileLoaded: (content: string, fileName: string) => void;
}

const ACCEPTED_TYPES = [".json", ".md", ".txt", ".xml"];
const MAX_SIZE_MB = 10;
const MAX_SIZE_BYTES = MAX_SIZE_MB * 1024 * 1024;

export function FileUpload({ onFileLoaded }: FileUploadProps) {
  const [isDragOver, setIsDragOver] = useState(false);
  const [fileName, setFileName] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const processFile = useCallback(
    (file: File) => {
      setError(null);

      const ext = "." + file.name.split(".").pop()?.toLowerCase();
      if (!ACCEPTED_TYPES.includes(ext)) {
        setError(`Unsupported file type. Accepted: ${ACCEPTED_TYPES.join(", ")}`);
        return;
      }
      if (file.size > MAX_SIZE_BYTES) {
        setError(`File too large. Maximum size: ${MAX_SIZE_MB}MB`);
        return;
      }

      const reader = new FileReader();
      reader.onload = (e) => {
        const content = e.target?.result as string;
        setFileName(file.name);
        onFileLoaded(content, file.name);
      };
      reader.onerror = () => setError("Failed to read file");
      reader.readAsText(file);
    },
    [onFileLoaded]
  );

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      setIsDragOver(false);
      const file = e.dataTransfer.files[0];
      if (file) processFile(file);
    },
    [processFile]
  );

  const handleChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (file) processFile(file);
    },
    [processFile]
  );

  const clearFile = () => {
    setFileName(null);
    setError(null);
    if (inputRef.current) inputRef.current.value = "";
  };

  return (
    <div className="space-y-2">
      <div
        onDragOver={(e) => {
          e.preventDefault();
          setIsDragOver(true);
        }}
        onDragLeave={() => setIsDragOver(false)}
        onDrop={handleDrop}
        onClick={() => inputRef.current?.click()}
        className={cn(
          "flex flex-col items-center justify-center gap-3 rounded-lg border-2 border-dashed p-8 cursor-pointer transition-colors",
          isDragOver
            ? "border-[#0078D4] bg-blue-50"
            : "border-gray-300 hover:border-gray-400 bg-gray-50"
        )}
      >
        {fileName ? (
          <div className="flex items-center gap-2 text-sm text-gray-700">
            <FileText className="h-5 w-5 text-[#0078D4]" />
            <span className="font-medium">{fileName}</span>
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                clearFile();
              }}
              className="ml-1 rounded-full p-0.5 hover:bg-gray-200"
            >
              <X className="h-4 w-4 text-gray-500" />
            </button>
          </div>
        ) : (
          <>
            <Upload className="h-8 w-8 text-gray-400" />
            <div className="text-center">
              <p className="text-sm font-medium text-gray-700">
                Drop a file here or click to browse
              </p>
              <p className="mt-1 text-xs text-gray-500">
                Supports {ACCEPTED_TYPES.join(", ")} — max {MAX_SIZE_MB}MB
              </p>
            </div>
          </>
        )}
      </div>

      <input
        ref={inputRef}
        type="file"
        accept={ACCEPTED_TYPES.join(",")}
        onChange={handleChange}
        className="hidden"
      />

      {error && <p className="text-sm text-red-600">{error}</p>}
    </div>
  );
}
