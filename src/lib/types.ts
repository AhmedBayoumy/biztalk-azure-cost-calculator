// ── Input Types ──

export type InputFormat = 'json' | 'markdown' | 'text' | 'xml-binding';

export interface RawInput {
  format: InputFormat;
  content: string;
  fileName?: string;
}

// ── BizTalk Integration Types ──

export type BizTalkAdapterType =
  | 'FILE'
  | 'FTP'
  | 'SFTP'
  | 'HTTP'
  | 'SOAP'
  | 'WCF'
  | 'SQL'
  | 'MQ'
  | 'MSMQ'
  | 'REST'
  | 'SAP'
  | 'SMTP'
  | 'POP3'
  | 'Oracle'
  | 'EDI'
  | 'UNKNOWN';

export type IntegrationComplexity = 'simple' | 'medium' | 'complex';

export interface BizTalkIntegration {
  id: string;
  name: string;
  adapterType: BizTalkAdapterType;
  direction: 'send' | 'receive' | 'both';
  complexity: IntegrationComplexity;
  hasOrchestration: boolean;
  hasMapping: boolean;
  description?: string;
  messagesPerDay?: number;
  avgMessageSizeKB?: number;
}

export interface BizTalkAnalysis {
  totalIntegrations: number;
  integrations: BizTalkIntegration[];
  volumeEstimate?: VolumeEstimate;
  existingAzureServices?: string[];
  notes?: string[];
}

export interface VolumeEstimate {
  messagesPerDayLow: number;
  messagesPerDayAvg: number;
  messagesPerDayPeak: number;
  avgMessageSizeKB: number;
}

// ── Azure Target Mapping ──

export type AzureServiceType =
  | 'Logic Apps Standard'
  | 'Logic Apps Consumption'
  | 'Azure Functions'
  | 'Container Apps'
  | 'API Management'
  | 'Service Bus'
  | 'Event Hubs'
  | 'Event Grid'
  | 'Blob Storage'
  | 'Azure SQL'
  | 'App Service'
  | 'Azure Data Factory'
  | 'Key Vault'
  | 'Application Insights'
  | 'Log Analytics';

export interface AzureServiceMapping {
  biztalkIntegrationId: string;
  biztalkIntegrationName: string;
  targetServices: AzureTargetService[];
  rationale: string;
}

export interface AzureTargetService {
  serviceType: AzureServiceType;
  sku: string;
  skuDisplayName: string;
  quantity: number;
  region: string;
  isShared: boolean; // e.g., one APIM instance shared across integrations
  notes?: string;
}

// ── Pricing Types ──

export interface AzurePriceItem {
  currencyCode: string;
  retailPrice: number;
  unitOfMeasure: string;
  armRegionName: string;
  skuName: string;
  productName: string;
  serviceName: string;
  meterName: string;
  type: string; // 'Consumption' | 'Reservation'
  reservationTerm?: string;
}

export interface AzurePricingResponse {
  Items: AzurePriceItem[];
  NextPageLink: string | null;
  Count: number;
}

// ── Cost Calculation Types ──

export interface ServiceCostEstimate {
  serviceType: AzureServiceType;
  sku: string;
  skuDisplayName: string;
  region: string;
  quantity: number;
  unitPrice: number;
  unitOfMeasure: string;
  monthlyCost: number;
  annualCost: number;
  currency: string;
  isShared: boolean;
  pricingNotes?: string;
  reservedPrice1yr?: number;
  reservedPrice3yr?: number;
  monthlySaving1yr?: number;
  monthlySaving3yr?: number;
}

export interface CostBreakdownCategory {
  category: string;
  services: ServiceCostEstimate[];
  monthlySubtotal: number;
  annualSubtotal: number;
}

export interface CostEstimationResult {
  region: string;
  currency: string;
  categories: CostBreakdownCategory[];
  monthlyTotal: number;
  annualTotal: number;
  monthlyWithReservations1yr: number;
  monthlyWithReservations3yr: number;
  potentialSaving1yr: number;
  potentialSaving3yr: number;
  unmappedServices: string[];
  generatedAt: string;
  inputSummary: {
    totalIntegrations: number;
    simpleCount: number;
    mediumCount: number;
    complexCount: number;
    estimatedMessagesPerDay: number;
  };
}

// ── App State ──

export type AppStep = 'input' | 'review' | 'calculating' | 'results';

export interface AppState {
  step: AppStep;
  rawInput?: RawInput;
  analysis?: BizTalkAnalysis;
  mappings?: AzureServiceMapping[];
  costResult?: CostEstimationResult;
  selectedRegion: string;
  selectedCurrency: string;
  isLoading: boolean;
  error?: string;
}

// ── Config ──

export const SUPPORTED_CURRENCIES = ['SEK', 'EUR', 'USD', 'GBP', 'NOK', 'DKK'] as const;
export type SupportedCurrency = (typeof SUPPORTED_CURRENCIES)[number];

export const AZURE_REGIONS = [
  { value: 'swedencentral', label: 'Sweden Central' },
  { value: 'westeurope', label: 'West Europe' },
  { value: 'northeurope', label: 'North Europe' },
  { value: 'uksouth', label: 'UK South' },
  { value: 'eastus', label: 'East US' },
  { value: 'eastus2', label: 'East US 2' },
  { value: 'westus2', label: 'West US 2' },
  { value: 'germanywestcentral', label: 'Germany West Central' },
] as const;

export const DEFAULT_REGION = 'swedencentral';
export const DEFAULT_CURRENCY: SupportedCurrency = 'SEK';
