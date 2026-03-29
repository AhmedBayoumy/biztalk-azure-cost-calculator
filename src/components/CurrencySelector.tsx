"use client";

import React from "react";
import { Select } from "@/components/ui/select";
import {
  SUPPORTED_CURRENCIES,
  AZURE_REGIONS,
  DEFAULT_REGION,
  DEFAULT_CURRENCY,
  type SupportedCurrency,
} from "@/lib/types";

interface CurrencySelectorProps {
  currency: SupportedCurrency;
  region: string;
  onCurrencyChange: (currency: SupportedCurrency) => void;
  onRegionChange: (region: string) => void;
}

const currencyOptions = SUPPORTED_CURRENCIES.map((c) => ({ value: c, label: c }));
const regionOptions = AZURE_REGIONS.map((r) => ({ value: r.value, label: r.label }));

export function CurrencySelector({
  currency = DEFAULT_CURRENCY,
  region = DEFAULT_REGION,
  onCurrencyChange,
  onRegionChange,
}: CurrencySelectorProps) {
  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
      <Select
        id="currency"
        label="Currency"
        options={currencyOptions}
        value={currency}
        onChange={(v) => onCurrencyChange(v as SupportedCurrency)}
      />
      <Select
        id="region"
        label="Azure Region"
        options={regionOptions}
        value={region}
        onChange={onRegionChange}
      />
    </div>
  );
}
