'use client';

import { useCallback, useState } from 'react';
import { cn } from '@/lib/utils';

interface FileUploadProps {
  onFileLoaded: (content: string, fileName: string) => void;
}

export function FileUpload({ onFileLoaded }: FileUploadProps) {
  const [isDragging, setIsDragging] = useState(false);
  const [fileName, setFileName] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const processFile = useCallback((file: File) => {
    setError(null);
    const maxMb = 10;
    if (file.size > maxMb * 1024 * 1024) {
      setError(`File too large. Maximum size is ${maxMb} MB.`);
      return;
    }
    const reader = new FileReader();
    reader.onload = (e) => {
      const content = e.target?.result as string;
      setFileName(file.name);
      onFileLoaded(content, file.name);
    };
    reader.onerror = () => setError('Failed to read file.');
    reader.readAsText(file);
  }, [onFileLoaded]);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    const file = e.dataTransfer.files[0];
    if (file) processFile(file);
  }, [processFile]);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) processFile(file);
  };

  return (
    <label
      className={cn(
        'relative flex flex-col items-center justify-center gap-3 rounded-xl border-2 border-dashed px-6 py-10 cursor-pointer transition-all',
        isDragging
          ? 'border-[#0078D4] bg-blue-50'
          : fileName
          ? 'border-green-400 bg-green-50'
          : 'border-gray-300 bg-white hover:border-[#0078D4] hover:bg-blue-50/30'
      )}
      onDragOver={(e) => { e.preventDefault(); setIsDragging(true); }}
      onDragLeave={() => setIsDragging(false)}
      onDrop={handleDrop}
    >
      <input type="file" className="sr-only" accept=".json,.md,.xml,.txt" onChange={handleChange} />

      {fileName ? (
        <>
          <div className="w-10 h-10 rounded-full bg-green-100 flex items-center justify-center">
            <svg className="w-5 h-5 text-green-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
            </svg>
          </div>
          <div className="text-center">
            <p className="text-sm font-semibold text-green-700">{fileName}</p>
            <p className="text-xs text-green-600 mt-0.5">File loaded — click to replace</p>
          </div>
        </>
      ) : (
        <>
          <div className="w-10 h-10 rounded-full bg-gray-100 flex items-center justify-center group-hover:bg-blue-100 transition-colors">
            <svg className="w-5 h-5 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M3 16.5v2.25A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75V16.5m-13.5-9L12 3m0 0l4.5 4.5M12 3v13.5" />
            </svg>
          </div>
          <div className="text-center">
            <p className="text-sm font-semibold text-gray-700">
              {isDragging ? 'Drop file here' : 'Drop file or click to browse'}
            </p>
            <p className="text-xs text-gray-400 mt-1">JSON · Markdown · XML binding · TXT — up to 10 MB</p>
          </div>
        </>
      )}

      {error && (
        <p className="text-xs text-red-600 bg-red-50 rounded px-3 py-1.5">{error}</p>
      )}
    </label>
  );
}
