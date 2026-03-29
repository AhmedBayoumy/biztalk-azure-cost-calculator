import type {
  BizTalkAnalysis,
  BizTalkIntegration,
  BizTalkAdapterType,
  IntegrationComplexity,
  AzureServiceMapping,
  AzureTargetService,
  AzureServiceType,
} from './types';

// ── Adapter → Azure service mapping table ──

interface AdapterMapping {
  simple: AzureServiceType[];
  mediumOrComplex: AzureServiceType[];
}

const ADAPTER_MAP: Record<BizTalkAdapterType, AdapterMapping> = {
  FILE:    { simple: ['Blob Storage', 'Azure Functions'],           mediumOrComplex: ['Logic Apps Standard'] },
  FTP:     { simple: ['Blob Storage', 'Azure Functions'],           mediumOrComplex: ['Logic Apps Standard'] },
  SFTP:    { simple: ['Blob Storage', 'Azure Functions'],           mediumOrComplex: ['Logic Apps Standard'] },
  HTTP:    { simple: ['Azure Functions', 'API Management'],         mediumOrComplex: ['Container Apps', 'API Management'] },
  REST:    { simple: ['Azure Functions', 'API Management'],         mediumOrComplex: ['Container Apps', 'API Management'] },
  SOAP:    { simple: ['Azure Functions', 'API Management'],         mediumOrComplex: ['Logic Apps Standard', 'API Management'] },
  WCF:     { simple: ['Azure Functions', 'API Management'],         mediumOrComplex: ['Logic Apps Standard', 'API Management'] },
  SQL:     { simple: ['Azure Functions'],                           mediumOrComplex: ['Logic Apps Standard'] },
  MQ:      { simple: ['Service Bus', 'Azure Functions'],            mediumOrComplex: ['Service Bus', 'Container Apps'] },
  MSMQ:    { simple: ['Service Bus', 'Azure Functions'],            mediumOrComplex: ['Service Bus', 'Container Apps'] },
  SAP:     { simple: ['Logic Apps Standard'],                       mediumOrComplex: ['Logic Apps Standard'] },
  SMTP:    { simple: ['Logic Apps Consumption'],                    mediumOrComplex: ['Logic Apps Standard'] },
  POP3:    { simple: ['Logic Apps Consumption'],                    mediumOrComplex: ['Logic Apps Standard'] },
  Oracle:  { simple: ['Azure Data Factory'],                        mediumOrComplex: ['Logic Apps Standard'] },
  EDI:     { simple: ['Logic Apps Standard'],                       mediumOrComplex: ['Logic Apps Standard'] },
  UNKNOWN: { simple: ['Logic Apps Standard'],                       mediumOrComplex: ['Logic Apps Standard'] },
};

// ── Default SKU lookup ──

function defaultSku(serviceType: AzureServiceType): { sku: string; displayName: string } {
  switch (serviceType) {
    case 'Logic Apps Standard':      return { sku: 'WS1',           displayName: 'Workflow Standard WS1' };
    case 'Logic Apps Consumption':   return { sku: 'Consumption',   displayName: 'Consumption (per-action)' };
    case 'Azure Functions':          return { sku: 'Y1',            displayName: 'Consumption (Y1)' };
    case 'Container Apps':           return { sku: 'Consumption',   displayName: 'Consumption plan' };
    case 'API Management':           return { sku: 'Developer',     displayName: 'Developer (1 Unit)' };
    case 'Service Bus':              return { sku: 'Standard',      displayName: 'Standard namespace' };
    case 'Blob Storage':             return { sku: 'Standard_LRS',  displayName: 'Standard LRS, Hot tier' };
    case 'Azure Data Factory':       return { sku: 'V2',            displayName: 'Data Factory V2' };
    case 'Application Insights':     return { sku: 'PerGB2018',     displayName: 'Per-GB ingestion' };
    case 'Log Analytics':            return { sku: 'PerGB2018',     displayName: 'Per-GB ingestion' };
    case 'Key Vault':                return { sku: 'Standard',      displayName: 'Standard vault' };
    default:                         return { sku: 'Standard',      displayName: 'Standard' };
  }
}

// ── Helpers ──

function isSimple(complexity: IntegrationComplexity): boolean {
  return complexity === 'simple';
}

function buildService(
  serviceType: AzureServiceType,
  region: string,
  overrides?: Partial<AzureTargetService>,
): AzureTargetService {
  const { sku, displayName } = defaultSku(serviceType);
  return {
    serviceType,
    sku,
    skuDisplayName: displayName,
    quantity: 1,
    region,
    isShared: false,
    ...overrides,
  };
}

function buildRationale(integration: BizTalkIntegration, services: AzureServiceType[]): string {
  const parts: string[] = [
    `Adapter "${integration.adapterType}" (${integration.complexity}) → ${services.join(' + ')}`,
  ];
  if (integration.hasOrchestration) parts.push('Orchestration present → upgraded to workflow/container runtime');
  if (integration.hasMapping)       parts.push('Mapping present → transformation service added');
  return parts.join('. ');
}

// ── Per-integration mapping ──

function mapSingleIntegration(integration: BizTalkIntegration, region: string): AzureServiceMapping {
  const adapterEntry = ADAPTER_MAP[integration.adapterType] ?? ADAPTER_MAP.UNKNOWN;
  const serviceTypes: AzureServiceType[] = isSimple(integration.complexity)
    ? [...adapterEntry.simple]
    : [...adapterEntry.mediumOrComplex];

  // Orchestration upgrade: ensure a workflow/container runtime is present
  if (integration.hasOrchestration) {
    const hasWorkflowRuntime =
      serviceTypes.includes('Logic Apps Standard') ||
      serviceTypes.includes('Logic Apps Consumption') ||
      serviceTypes.includes('Container Apps');

    if (!hasWorkflowRuntime) {
      if (integration.complexity === 'complex') {
        serviceTypes.push('Container Apps');
      } else {
        serviceTypes.push('Logic Apps Standard');
      }
    }
    // Upgrade Consumption → Standard when orchestration is present
    const consumptionIdx = serviceTypes.indexOf('Logic Apps Consumption');
    if (consumptionIdx !== -1) {
      serviceTypes[consumptionIdx] = 'Logic Apps Standard';
    }
  }

  // Mapping upgrade: add transformation capability if missing
  if (integration.hasMapping) {
    const hasTransform =
      serviceTypes.includes('Azure Functions') ||
      serviceTypes.includes('Logic Apps Standard');

    if (!hasTransform) {
      serviceTypes.push('Azure Functions');
    }
  }

  // Deduplicate
  const unique = [...new Set(serviceTypes)];

  const targetServices = unique.map((svc) => buildService(svc, region));

  return {
    biztalkIntegrationId: integration.id,
    biztalkIntegrationName: integration.name,
    targetServices,
    rationale: buildRationale(integration, unique),
  };
}

// ── Shared infrastructure ──

function buildSharedInfrastructure(
  analysis: BizTalkAnalysis,
  region: string,
): AzureServiceMapping[] {
  const integrations = analysis.integrations;
  const total = integrations.length;
  const shared: AzureTargetService[] = [];

  // Detect adapter families present
  const httpSoapRest = new Set<BizTalkAdapterType>(['HTTP', 'REST', 'SOAP', 'WCF']);
  const queueBased   = new Set<BizTalkAdapterType>(['MQ', 'MSMQ']);

  const hasHttpTypes  = integrations.some((i) => httpSoapRest.has(i.adapterType));
  const queueCount    = integrations.filter((i) => queueBased.has(i.adapterType)).length;
  const hasQueueTypes = queueCount > 0;

  // API Management
  if (hasHttpTypes) {
    let apimSku: string;
    let apimDisplay: string;
    if (total > 50) {
      apimSku = 'Premium';
      apimDisplay = 'Premium (1 Unit)';
    } else if (total > 15) {
      apimSku = 'Standard';
      apimDisplay = 'Standard (1 Unit)';
    } else {
      apimSku = 'Developer';
      apimDisplay = 'Developer (1 Unit)';
    }
    shared.push(buildService('API Management', region, {
      sku: apimSku,
      skuDisplayName: apimDisplay,
      isShared: true,
      notes: `Shared gateway for ${total} integrations`,
    }));
  }

  // Service Bus namespace
  if (hasQueueTypes) {
    const premium = queueCount > 20;
    shared.push(buildService('Service Bus', region, {
      sku: premium ? 'Premium' : 'Standard',
      skuDisplayName: premium ? 'Premium namespace' : 'Standard namespace',
      isShared: true,
      notes: `Shared namespace for ${queueCount} queue-based integrations`,
    }));
  }

  // Application Insights – always
  shared.push(buildService('Application Insights', region, {
    isShared: true,
    notes: 'Shared monitoring for all integration workloads',
  }));

  // Log Analytics – always
  shared.push(buildService('Log Analytics', region, {
    isShared: true,
    notes: 'Central log workspace for diagnostics and alerting',
  }));

  // Key Vault – always
  shared.push(buildService('Key Vault', region, {
    isShared: true,
    notes: 'Centralized secrets and certificate management',
  }));

  return [
    {
      biztalkIntegrationId: '__shared_infrastructure__',
      biztalkIntegrationName: 'Shared Infrastructure',
      targetServices: shared,
      rationale: 'Common platform services shared across all integrations',
    },
  ];
}

// ── Post-processing: consolidate quantities ──

function consolidateQuantities(mappings: AzureServiceMapping[]): void {
  // Count how many times each non-shared service type appears
  const serviceCounts = new Map<AzureServiceType, number>();
  for (const m of mappings) {
    if (m.biztalkIntegrationId === '__shared_infrastructure__') continue;
    for (const svc of m.targetServices) {
      serviceCounts.set(svc.serviceType, (serviceCounts.get(svc.serviceType) ?? 0) + 1);
    }
  }

  // Azure Functions: switch to EP1 if >10 function-backed integrations
  const fnCount = serviceCounts.get('Azure Functions') ?? 0;
  if (fnCount > 10) {
    for (const m of mappings) {
      for (const svc of m.targetServices) {
        if (svc.serviceType === 'Azure Functions') {
          svc.sku = 'EP1';
          svc.skuDisplayName = 'Elastic Premium EP1';
        }
      }
    }
  }

  // Logic Apps Standard: 1 instance per 15-20 workflows → annotate quantity on shared infra
  const laCount = serviceCounts.get('Logic Apps Standard') ?? 0;
  if (laCount > 0) {
    const instances = Math.max(1, Math.ceil(laCount / 17)); // midpoint of 15-20
    for (const m of mappings) {
      if (m.biztalkIntegrationId !== '__shared_infrastructure__') continue;
      // Inject a consolidated Logic Apps Standard plan entry
      const { sku, displayName } = defaultSku('Logic Apps Standard');
      m.targetServices.push({
        serviceType: 'Logic Apps Standard',
        sku,
        skuDisplayName: displayName,
        quantity: instances,
        region: m.targetServices[0]?.region ?? 'swedencentral',
        isShared: true,
        notes: `${instances} WS1 plan(s) hosting ~${laCount} workflows`,
      });
    }
  }
}

// ── Public API ──

/**
 * Maps every BizTalk integration to recommended Azure target services
 * and appends shared infrastructure entries.
 */
export function mapIntegrationsToAzure(
  analysis: BizTalkAnalysis,
  region: string,
): AzureServiceMapping[] {
  const perIntegration = analysis.integrations.map((i) => mapSingleIntegration(i, region));
  const sharedInfra    = buildSharedInfrastructure(analysis, region);
  const all            = [...perIntegration, ...sharedInfra];

  consolidateQuantities(all);

  return all;
}
