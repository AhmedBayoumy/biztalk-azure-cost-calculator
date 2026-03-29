import type { AzurePriceItem, AzurePricingResponse } from './types';

const API_BASE = 'https://prices.azure.com/api/retail/prices';

const DEFAULT_CURRENCY = 'SEK';
const DEFAULT_REGION = 'swedencentral';

// ── Service Name Mapping ──

const SERVICE_NAME_MAP: Record<string, string> = {
  'Virtual Machines': 'Virtual Machines',
  'App Service': 'Azure App Service',
  'SQL Database': 'SQL Database',
  'Azure Functions': 'Azure Functions',
  'Blob Storage': 'Storage',
  'Service Bus': 'Service Bus',
  'Event Hubs': 'Event Hubs',
  'Event Grid': 'Event Grid',
  'API Management': 'API Management',
  'Logic Apps': 'Logic Apps',
  'Logic Apps Standard': 'Logic Apps',
  'Logic Apps Consumption': 'Logic Apps',
  'Container Apps': 'Azure Container Apps',
  'Azure SQL': 'SQL Database',
  'Azure Data Factory': 'Azure Data Factory v2',
  'Redis Cache': 'Redis Cache',
  'Application Insights': 'Application Insights',
  'Log Analytics': 'Log Analytics',
  'Key Vault': 'Key Vault',
};

// ── SKU Normalization ──

function normalizeSkuForApi(
  serviceType: string,
  sku: string
): { skuFilter: string; extraFilters: string[] } {
  const extra: string[] = [];

  switch (serviceType) {
    case 'App Service': {
      // P2v3 → "P2 v3" (space before version suffix)
      const match = sku.match(/^([A-Z]\d+)(v\d+)$/i);
      if (match) {
        return { skuFilter: `${match[1]} ${match[2]}`, extraFilters: extra };
      }
      return { skuFilter: sku, extraFilters: extra };
    }
    case 'SQL Database': {
      // GP_Gen5_4 → 4 vCore, productName contains "General Purpose"
      const sqlMatch = sku.match(/^(GP|BC|HS)_Gen(\d+)_(\d+)$/i);
      if (sqlMatch) {
        const tierMap: Record<string, string> = {
          GP: 'General Purpose',
          BC: 'Business Critical',
          HS: 'Hyperscale',
        };
        const tier = tierMap[sqlMatch[1].toUpperCase()] ?? 'General Purpose';
        return {
          skuFilter: `${sqlMatch[3]} vCore`,
          extraFilters: [`contains(productName, '${tier}')`],
        };
      }
      return { skuFilter: sku, extraFilters: extra };
    }
    case 'Redis Cache': {
      // C1 → "C1 Cache Instance"
      if (/^[CP]\d+$/i.test(sku)) {
        return { skuFilter: `${sku} Cache Instance`, extraFilters: extra };
      }
      return { skuFilter: sku, extraFilters: extra };
    }
    case 'Blob Storage': {
      // Standard_LRS → LRS
      const storageMatch = sku.match(/^(?:Standard|Premium)_(.+)$/i);
      if (storageMatch) {
        return { skuFilter: storageMatch[1], extraFilters: extra };
      }
      return { skuFilter: sku, extraFilters: extra };
    }
    default:
      return { skuFilter: sku, extraFilters: extra };
  }
}

// ── OData Filter Builder ──

export interface ODataFilterParams {
  serviceName?: string;
  armSkuName?: string;
  armRegionName?: string;
  skuName?: string;
  contains?: { field: string; value: string };
  priceType?: string;
  extraFilters?: string[];
}

export function buildODataFilter(params: ODataFilterParams): string {
  const parts: string[] = [];

  if (params.serviceName) {
    parts.push(`serviceName eq '${params.serviceName}'`);
  }
  if (params.armSkuName) {
    parts.push(`armSkuName eq '${params.armSkuName}'`);
  }
  if (params.armRegionName) {
    parts.push(`armRegionName eq '${params.armRegionName}'`);
  }
  if (params.skuName) {
    parts.push(`skuName eq '${params.skuName}'`);
  }
  if (params.contains) {
    parts.push(`contains(${params.contains.field}, '${params.contains.value}')`);
  }
  if (params.priceType) {
    parts.push(`priceType eq '${params.priceType}'`);
  }
  if (params.extraFilters) {
    parts.push(...params.extraFilters);
  }

  return parts.join(' and ');
}

// ── Main Fetch Function ──

export interface FetchAzurePricingParams {
  sku?: string;
  service?: string;
  region?: string;
  currency?: string;
  filter?: string;
  priceType?: string;
}

export async function fetchAzurePricing(
  params: FetchAzurePricingParams
): Promise<AzurePriceItem[]> {
  const currency = params.currency ?? DEFAULT_CURRENCY;
  const region = params.region ?? DEFAULT_REGION;
  const allItems: AzurePriceItem[] = [];

  // Build the filter
  let filter = params.filter;
  if (!filter) {
    const filterParams: ODataFilterParams = {
      armRegionName: region,
      priceType: params.priceType ?? 'Consumption',
    };

    if (params.service) {
      const mapped = SERVICE_NAME_MAP[params.service];
      if (mapped) {
        filterParams.serviceName = mapped;
      } else {
        filterParams.serviceName = params.service;
      }
    }

    if (params.sku) {
      filterParams.armSkuName = params.sku;
    }

    filter = buildODataFilter(filterParams);
  }

  let url: string | null = `${API_BASE}?currencyCode='${currency}'`;
  if (filter) {
    url += `&$filter=${encodeURIComponent(filter)}`;
  }

  // Paginate through all results
  while (url) {
    const res = await fetch(url);
    if (!res.ok) {
      throw new Error(
        `Azure Pricing API error: ${res.status} ${res.statusText}`
      );
    }

    const data: AzurePricingResponse = await res.json();
    allItems.push(...data.Items);
    url = data.NextPageLink;
  }

  return allItems;
}

// ── Convenience: Get a Specific Service Price ──

export async function getServicePrice(
  serviceType: string,
  sku?: string,
  region?: string,
  currency?: string
): Promise<AzurePriceItem | null> {
  const resolvedRegion = region ?? DEFAULT_REGION;
  const resolvedCurrency = currency ?? DEFAULT_CURRENCY;

  // Container Apps requires a raw OData filter
  if (serviceType === 'Container Apps') {
    const filter = buildODataFilter({
      serviceName: 'Azure Container Apps',
      armRegionName: resolvedRegion,
      priceType: 'Consumption',
    });

    const items = await fetchAzurePricing({
      filter,
      currency: resolvedCurrency,
    });

    if (sku) {
      const skuLower = sku.toLowerCase();
      const match = items.find(
        (i) =>
          i.skuName.toLowerCase().includes(skuLower) ||
          i.meterName.toLowerCase().includes(skuLower)
      );
      if (match) return match;
    }

    return items[0] ?? null;
  }

  // For other services, normalize the SKU and build the query
  const { skuFilter, extraFilters } = sku
    ? normalizeSkuForApi(serviceType, sku)
    : { skuFilter: undefined, extraFilters: [] as string[] };

  const mappedService = SERVICE_NAME_MAP[serviceType] ?? serviceType;

  const filterParams: ODataFilterParams = {
    serviceName: mappedService,
    armRegionName: resolvedRegion,
    priceType: 'Consumption',
    extraFilters,
  };

  if (skuFilter) {
    // Use skuName for normalized names that contain spaces or descriptive text
    if (skuFilter.includes(' ') || skuFilter.includes('vCore')) {
      filterParams.skuName = skuFilter;
    } else {
      filterParams.armSkuName = skuFilter;
    }
  }

  const filter = buildODataFilter(filterParams);

  const items = await fetchAzurePricing({
    filter,
    currency: resolvedCurrency,
  });

  if (items.length === 0) return null;

  // Prefer items whose type is 'Consumption' (not reservations)
  const consumption = items.filter((i) => i.type === 'Consumption');
  if (consumption.length > 0) return consumption[0];

  return items[0];
}

// ── Monthly Cost Estimator ──

const HOURS_PER_MONTH = 730;

export function getMonthlyEstimate(
  priceItem: AzurePriceItem,
  hours?: number
): number {
  const unit = priceItem.unitOfMeasure.toLowerCase();
  const price = priceItem.retailPrice;

  if (unit.includes('1 hour') || unit === '1 hour') {
    return price * (hours ?? HOURS_PER_MONTH);
  }

  if (unit.includes('1/month') || unit.includes('1 month')) {
    return price;
  }

  if (unit.includes('1 day') || unit.includes('1/day')) {
    return price * 30;
  }

  // Per-unit pricing (e.g., "10K Transactions", "1 GB", "1M Executions")
  if (unit.includes('gb')) {
    return price; // already per GB – caller multiplies by volume
  }

  // Default: treat as hourly for always-on services
  return price * (hours ?? HOURS_PER_MONTH);
}
