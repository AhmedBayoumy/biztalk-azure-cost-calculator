import type {
  AzureServiceMapping,
  CostEstimationResult,
  CostBreakdownCategory,
  ServiceCostEstimate,
  AzureTargetService,
  AzureServiceType,
  AzurePriceItem,
} from './types';
import { fetchAzurePricing, getMonthlyEstimate } from './azure-pricing';

// ── Constants ──

const HOURS_PER_MONTH = 730;
const DEFAULT_MESSAGES_PER_DAY = 1_000;
const DEFAULT_AVG_MESSAGE_SIZE_KB = 5;

// ── Category Mapping ──

const SERVICE_CATEGORY_MAP: Record<AzureServiceType, string> = {
  'Logic Apps Standard': 'Integration Compute',
  'Logic Apps Consumption': 'Integration Compute',
  'Azure Functions': 'Integration Compute',
  'Container Apps': 'Integration Compute',
  'App Service': 'Integration Compute',
  'API Management': 'API Management',
  'Service Bus': 'Messaging',
  'Event Hubs': 'Messaging',
  'Event Grid': 'Messaging',
  'Blob Storage': 'Storage',
  'Azure SQL': 'Data',
  'Azure Data Factory': 'Data',
  'Application Insights': 'Monitoring',
  'Log Analytics': 'Monitoring',
  'Key Vault': 'Security',
};

/** Ordered list of category labels for display. */
const CATEGORY_ORDER = [
  'Integration Compute',
  'API Management',
  'Messaging',
  'Storage',
  'Data',
  'Monitoring',
  'Security',
];

/**
 * Services billed on an always-on hourly model (monthly = hourly × 730).
 * Service Bus Premium is detected at runtime via SKU name.
 */
const ALWAYS_ON_SERVICES: ReadonlySet<string> = new Set([
  'App Service',
  'API Management',
  'Logic Apps Standard',
]);

// ── Volume Context ──

export interface VolumeContext {
  messagesPerDay: number;
  avgMessageSizeKB: number;
}

export interface CostCalculationOptions {
  /** Override default volume assumptions. */
  volumeEstimate?: VolumeContext;
}

// ── Deduplication ──

interface DeduplicatedService extends AzureTargetService {
  /** Number of integrations that reference this service instance. */
  usageCount: number;
}

/**
 * Collapses shared services (same serviceType + sku) into a single entry
 * while accumulating quantity for non-shared services.
 */
export function deduplicateServices(
  mappings: AzureServiceMapping[],
): DeduplicatedService[] {
  const serviceMap = new Map<string, DeduplicatedService>();

  for (const mapping of mappings) {
    for (const svc of mapping.targetServices) {
      // Shared services get one entry regardless of how many integrations reference them
      const key = svc.isShared
        ? `shared:${svc.serviceType}:${svc.sku}`
        : `${mapping.biztalkIntegrationId}:${svc.serviceType}:${svc.sku}`;

      const existing = serviceMap.get(key);
      if (existing) {
        existing.usageCount += 1;
        // For non-shared services, aggregate quantity
        if (!existing.isShared) {
          existing.quantity += svc.quantity;
        }
      } else {
        serviceMap.set(key, { ...svc, usageCount: 1 });
      }
    }
  }

  return Array.from(serviceMap.values());
}

// ── Category Helpers ──

/** Returns the cost category for a given Azure service type. */
export function getServiceCategory(serviceType: AzureServiceType): string {
  return SERVICE_CATEGORY_MAP[serviceType] ?? 'Other';
}

/** Groups a flat list of estimates into ordered category buckets. */
export function groupByCategory(
  estimates: ServiceCostEstimate[],
): CostBreakdownCategory[] {
  const categoryMap = new Map<string, ServiceCostEstimate[]>();

  for (const est of estimates) {
    const category = getServiceCategory(est.serviceType);
    let list = categoryMap.get(category);
    if (!list) {
      list = [];
      categoryMap.set(category, list);
    }
    list.push(est);
  }

  const result: CostBreakdownCategory[] = [];

  // Emit in defined order first
  for (const cat of CATEGORY_ORDER) {
    const services = categoryMap.get(cat);
    if (services && services.length > 0) {
      result.push({
        category: cat,
        services,
        monthlySubtotal: services.reduce((s, e) => s + e.monthlyCost, 0),
        annualSubtotal: services.reduce((s, e) => s + e.annualCost, 0),
      });
    }
  }

  // Append any unexpected categories that aren't in the predefined order
  for (const [cat, services] of categoryMap) {
    if (!CATEGORY_ORDER.includes(cat) && services.length > 0) {
      result.push({
        category: cat,
        services,
        monthlySubtotal: services.reduce((s, e) => s + e.monthlyCost, 0),
        annualSubtotal: services.reduce((s, e) => s + e.annualCost, 0),
      });
    }
  }

  return result;
}

// ── Per-Service Cost Formulas ──

function isAlwaysOn(serviceType: string, sku: string): boolean {
  return (
    ALWAYS_ON_SERVICES.has(serviceType) ||
    sku.toLowerCase().includes('premium')
  );
}

/** Always-on: hourlyPrice × 730 × quantity */
export function applyAlwaysOnFormula(
  priceItem: AzurePriceItem,
  quantity: number,
): number {
  return priceItem.retailPrice * HOURS_PER_MONTH * quantity;
}

/**
 * Azure Functions Consumption:
 *   executionCost + computeCost, minus free grants (1M executions, 400K GB-s).
 */
export function applyFunctionsConsumptionFormula(
  priceItems: AzurePriceItem[],
  monthlyInvocations: number,
  avgDurationMs: number = 500,
  memoryGB: number = 0.25,
): number {
  const FREE_EXECUTIONS = 1_000_000;
  const FREE_GB_SECONDS = 400_000;

  const billableExecutions = Math.max(0, monthlyInvocations - FREE_EXECUTIONS);
  const totalGBSeconds =
    monthlyInvocations * memoryGB * (avgDurationMs / 1000);
  const billableGBSeconds = Math.max(0, totalGBSeconds - FREE_GB_SECONDS);

  const execItem = priceItems.find(
    (p) =>
      p.meterName.toLowerCase().includes('total executions') ||
      p.meterName.toLowerCase().includes('execution'),
  );
  const computeItem = priceItems.find(
    (p) =>
      p.meterName.toLowerCase().includes('execution time') ||
      p.meterName.toLowerCase().includes('gb-s') ||
      p.meterName.toLowerCase().includes('duration'),
  );

  let cost = 0;

  if (execItem) {
    cost += scaleByUnit(execItem, billableExecutions);
  }
  if (computeItem) {
    cost += billableGBSeconds * computeItem.retailPrice;
  }

  return cost;
}

/**
 * Blob Storage: pricePerGB × estimatedGB + transaction cost.
 */
export function applyBlobStorageFormula(
  priceItems: AzurePriceItem[],
  estimatedGB: number,
  monthlyOperations: number = 100_000,
): number {
  const storageItem = priceItems.find(
    (p) =>
      p.meterName.toLowerCase().includes('data stored') ||
      p.meterName.toLowerCase().includes('lrs') ||
      p.meterName.toLowerCase().includes('capacity'),
  );
  const txItem = priceItems.find(
    (p) =>
      p.meterName.toLowerCase().includes('write operations') ||
      p.meterName.toLowerCase().includes('read operations') ||
      p.meterName.toLowerCase().includes('operations'),
  );

  let cost = 0;
  if (storageItem) {
    cost += storageItem.retailPrice * estimatedGB;
  }
  if (txItem) {
    cost += scaleByUnit(txItem, monthlyOperations);
  }
  return cost;
}

/**
 * Container Apps Consumption:
 *   vCPU-seconds + GiB-seconds + request costs (with free grants).
 */
export function applyContainerAppsFormula(
  priceItems: AzurePriceItem[],
  monthlyRequests: number,
  activeSecondsPerMonth: number = 100_000,
  vCPUCount: number = 0.5,
  memoryGiB: number = 1,
): number {
  const FREE_VCPU_SECONDS = 180_000;
  const FREE_GIB_SECONDS = 360_000;

  const vcpuItem = priceItems.find((p) =>
    p.meterName.toLowerCase().includes('vcpu'),
  );
  const memItem = priceItems.find(
    (p) =>
      p.meterName.toLowerCase().includes('memory') ||
      p.meterName.toLowerCase().includes('gib'),
  );
  const reqItem = priceItems.find((p) =>
    p.meterName.toLowerCase().includes('request'),
  );

  let cost = 0;

  if (vcpuItem) {
    const billable = Math.max(
      0,
      vCPUCount * activeSecondsPerMonth - FREE_VCPU_SECONDS,
    );
    cost += billable * vcpuItem.retailPrice;
  }
  if (memItem) {
    const billable = Math.max(
      0,
      memoryGiB * activeSecondsPerMonth - FREE_GIB_SECONDS,
    );
    cost += billable * memItem.retailPrice;
  }
  if (reqItem) {
    cost += scaleByUnit(reqItem, monthlyRequests);
  }

  return cost;
}

/**
 * Service Bus:
 *   - Premium → always-on hourly billing
 *   - Standard → base fee + per-operation cost
 */
export function applyServiceBusFormula(
  priceItems: AzurePriceItem[],
  sku: string,
  monthlyOperations: number,
): number {
  if (sku.toLowerCase().includes('premium')) {
    const hourlyItem = priceItems.find((p) =>
      p.unitOfMeasure.toLowerCase().includes('hour'),
    );
    if (hourlyItem) {
      return hourlyItem.retailPrice * HOURS_PER_MONTH;
    }
  }

  // Standard: base + operations
  const baseItem = priceItems.find(
    (p) =>
      p.meterName.toLowerCase().includes('base') ||
      p.meterName.toLowerCase().includes('unit'),
  );
  const opsItem = priceItems.find(
    (p) =>
      p.meterName.toLowerCase().includes('operations') ||
      p.meterName.toLowerCase().includes('messaging'),
  );

  let cost = 0;
  if (baseItem) {
    cost += getMonthlyEstimate(baseItem);
  }
  if (opsItem) {
    cost += scaleByUnit(opsItem, monthlyOperations);
  }
  return cost;
}

/** Key Vault: per-operation (minimal, ~$0.03/10K operations). */
export function applyKeyVaultFormula(
  priceItems: AzurePriceItem[],
  monthlyOperations: number = 10_000,
): number {
  const opsItem = priceItems.find(
    (p) =>
      p.meterName.toLowerCase().includes('operations') ||
      p.meterName.toLowerCase().includes('secret') ||
      p.meterName.toLowerCase().includes('key'),
  );

  if (opsItem) {
    return scaleByUnit(opsItem, monthlyOperations);
  }

  // Fallback: minimal cost
  return 0.03;
}

/**
 * Application Insights / Log Analytics fallback when API pricing
 * is unavailable.
 *   - Application Insights: $2.50/GB after 5 GB free
 *   - Log Analytics: $2.76/GB after free tier
 */
export function applyMonitoringFallback(
  serviceType: AzureServiceType,
  estimatedGBPerMonth: number = 2,
): number {
  const freeGB = 5;
  const billableGB = Math.max(0, estimatedGBPerMonth - freeGB);

  if (serviceType === 'Application Insights') {
    return billableGB * 2.5;
  }
  if (serviceType === 'Log Analytics') {
    return billableGB * 2.76;
  }
  return 0;
}

// ── Helpers ──

/**
 * Scales a price item by the given raw quantity, respecting the
 * unitOfMeasure denominator (e.g. "10K Transactions" → quantity / 10_000).
 */
function scaleByUnit(item: AzurePriceItem, rawQuantity: number): number {
  const unit = item.unitOfMeasure.toLowerCase();

  if (unit.includes('10k') || unit.includes('10,000')) {
    return (rawQuantity / 10_000) * item.retailPrice;
  }
  if (unit.includes('1m') || unit.includes('million') || unit.includes('1,000,000')) {
    return (rawQuantity / 1_000_000) * item.retailPrice;
  }

  return rawQuantity * item.retailPrice;
}

function findHourlyItem(items: AzurePriceItem[]): AzurePriceItem | undefined {
  return items.find((p) => p.unitOfMeasure.toLowerCase().includes('hour'));
}

// ── Single-Service Cost Estimation ──

async function estimateServiceCost(
  service: DeduplicatedService,
  region: string,
  currency: string,
  volume: VolumeContext,
): Promise<{ estimate: ServiceCostEstimate | null; error?: string }> {
  try {
    const priceItems = await fetchAzurePricing({
      service: service.serviceType,
      region,
      currency,
      priceType: 'Consumption',
    });

    if (priceItems.length === 0) {
      return {
        estimate: null,
        error: `No pricing data for ${service.serviceType} (${service.sku}) in ${region}`,
      };
    }

    const monthlyMessages = volume.messagesPerDay * 30;
    const primaryItem = priceItems[0];

    let monthlyCost = 0;
    let unitPrice = primaryItem.retailPrice;
    let unitOfMeasure = primaryItem.unitOfMeasure;
    let pricingNotes = '';

    // ── Always-on formula ──
    if (isAlwaysOn(service.serviceType, service.sku)) {
      const hourlyItem = findHourlyItem(priceItems) ?? primaryItem;
      monthlyCost = applyAlwaysOnFormula(hourlyItem, service.quantity);
      unitPrice = hourlyItem.retailPrice;
      unitOfMeasure = hourlyItem.unitOfMeasure;
      pricingNotes = `Always-on: ${unitPrice}/hr × ${HOURS_PER_MONTH} hrs × ${service.quantity}`;
    } else {
      // ── Consumption formulas per service type ──
      switch (service.serviceType) {
        case 'Azure Functions': {
          monthlyCost = applyFunctionsConsumptionFormula(
            priceItems,
            monthlyMessages,
          );
          pricingNotes =
            `Consumption: ~${monthlyMessages.toLocaleString()} invocations/mo ` +
            `(free grant: 1M executions, 400K GB-s)`;
          break;
        }

        case 'Logic Apps Consumption': {
          const actionItem = priceItems.find(
            (p) =>
              p.meterName.toLowerCase().includes('action') ||
              p.meterName.toLowerCase().includes('execution'),
          );
          if (actionItem) {
            // ~5 actions per workflow run
            monthlyCost = monthlyMessages * 5 * actionItem.retailPrice;
            unitPrice = actionItem.retailPrice;
            pricingNotes = `~${monthlyMessages.toLocaleString()} runs/mo × 5 actions`;
          }
          break;
        }

        case 'Container Apps': {
          monthlyCost = applyContainerAppsFormula(
            priceItems,
            monthlyMessages,
            monthlyMessages * 0.5,
          );
          pricingNotes =
            'Consumption plan (free grant: 180K vCPU-s, 360K GiB-s)';
          break;
        }

        case 'Service Bus': {
          monthlyCost = applyServiceBusFormula(
            priceItems,
            service.sku,
            monthlyMessages,
          );
          pricingNotes = service.sku.toLowerCase().includes('premium')
            ? 'Premium: always-on hourly billing'
            : `Standard: base fee + ~${monthlyMessages.toLocaleString()} ops/mo`;
          break;
        }

        case 'Event Hubs': {
          const tpuItem = findHourlyItem(priceItems);
          if (tpuItem) {
            monthlyCost =
              tpuItem.retailPrice * HOURS_PER_MONTH * service.quantity;
            unitPrice = tpuItem.retailPrice;
            pricingNotes = `${service.quantity} throughput unit(s) × ${HOURS_PER_MONTH} hrs`;
          }
          break;
        }

        case 'Event Grid': {
          const opsItem = priceItems.find((p) =>
            p.meterName.toLowerCase().includes('operations'),
          );
          if (opsItem) {
            monthlyCost = scaleByUnit(opsItem, monthlyMessages);
            pricingNotes = `~${monthlyMessages.toLocaleString()} events/mo`;
          }
          break;
        }

        case 'Blob Storage': {
          const estimatedGB =
            (volume.messagesPerDay * 30 * volume.avgMessageSizeKB) /
            (1024 * 1024);
          const safeGB = Math.max(estimatedGB, 1);
          monthlyCost = applyBlobStorageFormula(
            priceItems,
            safeGB,
            monthlyMessages,
          );
          pricingNotes = `~${safeGB.toFixed(1)} GB storage + ${monthlyMessages.toLocaleString()} operations`;
          break;
        }

        case 'Azure SQL': {
          const computeItem = priceItems.find(
            (p) =>
              p.unitOfMeasure.toLowerCase().includes('hour') &&
              (p.meterName.toLowerCase().includes('vcore') ||
                p.meterName.toLowerCase().includes('compute')),
          );
          const storageItem = priceItems.find(
            (p) =>
              p.meterName.toLowerCase().includes('storage') ||
              p.meterName.toLowerCase().includes('data stored'),
          );
          const defaultStorageGB = 32;
          if (computeItem) {
            monthlyCost += computeItem.retailPrice * HOURS_PER_MONTH;
          }
          if (storageItem) {
            monthlyCost += storageItem.retailPrice * defaultStorageGB;
          }
          pricingNotes = `Compute (${HOURS_PER_MONTH} hrs) + ${defaultStorageGB} GB storage`;
          break;
        }

        case 'Azure Data Factory': {
          const pipelineItem = priceItems.find(
            (p) =>
              p.meterName.toLowerCase().includes('pipeline') ||
              p.meterName.toLowerCase().includes('orchestration'),
          );
          if (pipelineItem) {
            monthlyCost = monthlyMessages * pipelineItem.retailPrice;
            pricingNotes = `~${monthlyMessages.toLocaleString()} activity runs/mo`;
          }
          break;
        }

        case 'Key Vault': {
          monthlyCost = applyKeyVaultFormula(priceItems, monthlyMessages);
          pricingNotes = `~${monthlyMessages.toLocaleString()} operations/mo`;
          break;
        }

        case 'Application Insights':
        case 'Log Analytics': {
          const gbItem = priceItems.find(
            (p) =>
              p.meterName.toLowerCase().includes('data ingestion') ||
              p.meterName.toLowerCase().includes('data stored') ||
              p.unitOfMeasure.toLowerCase().includes('gb'),
          );

          const estimatedGB = 2;
          const freeGB = 5;

          if (gbItem) {
            const billableGB = Math.max(0, estimatedGB - freeGB);
            monthlyCost = billableGB * gbItem.retailPrice;
            pricingNotes = `~${estimatedGB} GB/mo (${freeGB} GB free)`;
          } else {
            monthlyCost = applyMonitoringFallback(
              service.serviceType,
              estimatedGB,
            );
            pricingNotes =
              service.serviceType === 'Application Insights'
                ? `~${estimatedGB} GB/mo ($2.50/GB after ${freeGB} GB free)`
                : `~${estimatedGB} GB/mo ($2.76/GB after ${freeGB} GB free)`;
          }
          break;
        }

        default: {
          monthlyCost = getMonthlyEstimate(primaryItem) * service.quantity;
          pricingNotes = `${service.quantity} unit(s) — generic estimate`;
        }
      }
    }

    // ── Reservation savings (always-on services only) ──
    let reservedPrice1yr: number | undefined;
    let reservedPrice3yr: number | undefined;
    let monthlySaving1yr: number | undefined;
    let monthlySaving3yr: number | undefined;

    if (isAlwaysOn(service.serviceType, service.sku)) {
      try {
        const reservationItems = await fetchAzurePricing({
          service: service.serviceType,
          region,
          currency,
          priceType: 'Reservation',
        });

        const oneYrItem = reservationItems.find(
          (p) => p.reservationTerm === '1 Year',
        );
        const threeYrItem = reservationItems.find(
          (p) => p.reservationTerm === '3 Years',
        );

        // Reservation retailPrice is a lump-sum for the full term
        if (oneYrItem) {
          reservedPrice1yr =
            (oneYrItem.retailPrice / 12) * service.quantity;
          monthlySaving1yr = monthlyCost - reservedPrice1yr;
        }
        if (threeYrItem) {
          reservedPrice3yr =
            (threeYrItem.retailPrice / 36) * service.quantity;
          monthlySaving3yr = monthlyCost - reservedPrice3yr;
        }
      } catch {
        // Reservation lookup failed — non-critical, continue without
      }
    }

    const estimate: ServiceCostEstimate = {
      serviceType: service.serviceType,
      sku: service.sku,
      skuDisplayName: service.skuDisplayName,
      region,
      quantity: service.quantity,
      unitPrice,
      unitOfMeasure,
      monthlyCost: Math.max(0, monthlyCost),
      annualCost: Math.max(0, monthlyCost) * 12,
      currency,
      isShared: service.isShared,
      pricingNotes,
      reservedPrice1yr,
      reservedPrice3yr,
      monthlySaving1yr:
        monthlySaving1yr != null && monthlySaving1yr > 0
          ? monthlySaving1yr
          : undefined,
      monthlySaving3yr:
        monthlySaving3yr != null && monthlySaving3yr > 0
          ? monthlySaving3yr
          : undefined,
    };

    return { estimate };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return {
      estimate: null,
      error: `${service.serviceType} (${service.sku}): ${message}`,
    };
  }
}

// ── Volume Extraction ──

function extractVolume(options?: CostCalculationOptions): VolumeContext {
  if (options?.volumeEstimate) {
    return options.volumeEstimate;
  }
  return {
    messagesPerDay: DEFAULT_MESSAGES_PER_DAY,
    avgMessageSizeKB: DEFAULT_AVG_MESSAGE_SIZE_KB,
  };
}

function buildInputSummary(
  mappings: AzureServiceMapping[],
  volume: VolumeContext,
): CostEstimationResult['inputSummary'] {
  return {
    totalIntegrations: mappings.length,
    simpleCount: 0,
    mediumCount: 0,
    complexCount: 0,
    estimatedMessagesPerDay: volume.messagesPerDay,
  };
}

// ── Main Entry Point ──

/**
 * Calculates a full cost breakdown for a set of Azure service mappings.
 *
 * 1. Deduplicates shared services (e.g. one APIM instance across integrations)
 * 2. Fetches pricing from the Azure Retail Prices API for each unique service/SKU
 * 3. Applies service-specific cost formulas
 * 4. Groups results into categories
 * 5. Queries reservation pricing for always-on services and computes savings
 * 6. Gracefully handles pricing failures — failed services are listed in unmappedServices
 */
export async function calculateCosts(
  mappings: AzureServiceMapping[],
  region: string,
  currency: string,
  options?: CostCalculationOptions,
): Promise<CostEstimationResult> {
  const deduplicated = deduplicateServices(mappings);
  const volume = extractVolume(options);

  const estimates: ServiceCostEstimate[] = [];
  const unmappedServices: string[] = [];

  // Resolve all services concurrently
  const results = await Promise.allSettled(
    deduplicated.map((svc) =>
      estimateServiceCost(svc, region, currency, volume),
    ),
  );

  for (const result of results) {
    if (result.status === 'fulfilled') {
      const { estimate, error } = result.value;
      if (estimate) {
        estimates.push(estimate);
      }
      if (error) {
        unmappedServices.push(error);
      }
    } else {
      unmappedServices.push(result.reason?.message ?? 'Unknown pricing error');
    }
  }

  const categories = groupByCategory(estimates);

  const monthlyTotal = categories.reduce(
    (sum, c) => sum + c.monthlySubtotal,
    0,
  );
  const annualTotal = monthlyTotal * 12;

  const totalSaving1yr = estimates.reduce(
    (sum, e) => sum + (e.monthlySaving1yr ?? 0),
    0,
  );
  const totalSaving3yr = estimates.reduce(
    (sum, e) => sum + (e.monthlySaving3yr ?? 0),
    0,
  );

  return {
    region,
    currency,
    categories,
    monthlyTotal,
    annualTotal,
    monthlyWithReservations1yr: monthlyTotal - totalSaving1yr,
    monthlyWithReservations3yr: monthlyTotal - totalSaving3yr,
    potentialSaving1yr: totalSaving1yr,
    potentialSaving3yr: totalSaving3yr,
    unmappedServices,
    generatedAt: new Date().toISOString(),
    inputSummary: buildInputSummary(mappings, volume),
  };
}
