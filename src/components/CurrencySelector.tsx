'use client';

import { AZURE_REGIONS, SUPPORTED_CURRENCIES, type SupportedCurrency } from '@/lib/types';

interface CurrencySelectorProps {
  currency: SupportedCurrency;
  region: string;
  onCurrencyChange: (c: SupportedCurrency) => void;
  onRegionChange: (r: string) => void;
}

export function CurrencySelector({ currency, region, onCurrencyChange, onRegionChange }: CurrencySelectorProps) {
  return (
    <div className="flex flex-col sm:flex-row gap-3 p-4 bg-white rounded-xl border border-gray-200 shadow-sm">
      <div className="flex-1">
        <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1.5">
          Azure Region
        </label>
        <select
          value={region}
          onChange={e => onRegionChange(e.target.value)}
          className="w-full h-9 rounded-lg border border-gray-300 bg-white px-3 text-sm focus:outline-none focus:ring-2 focus:ring-[#0078D4] focus:border-transparent"
        >
          {AZURE_REGIONS.map(r => (
            <option key={r.value} value={r.value}>{r.label}</option>
          ))}
        </select>
      </div>
      <div className="sm:w-40">
        <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1.5">
          Currency
        </label>
        <select
          value={currency}
          onChange={e => onCurrencyChange(e.target.value as SupportedCurrency)}
          className="w-full h-9 rounded-lg border border-gray-300 bg-white px-3 text-sm focus:outline-none focus:ring-2 focus:ring-[#0078D4] focus:border-transparent"
        >
          {SUPPORTED_CURRENCIES.map(c => (
            <option key={c} value={c}>{c}</option>
          ))}
        </select>
      </div>
    </div>
  );
}
