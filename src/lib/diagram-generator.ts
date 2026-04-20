import type { AzureServiceMapping, AzureServiceType, CostEstimationResult } from './types';

// ── Layer definitions ──

type LayerKey = 'gateway' | 'compute' | 'messaging' | 'data' | 'monitoring';

interface LayerDef {
  key: LayerKey;
  label: string;
  subgraphId: string;
  serviceTypes: AzureServiceType[];
}

const LAYERS: LayerDef[] = [
  {
    key: 'gateway',
    label: 'API Management',
    subgraphId: 'Gateway',
    serviceTypes: ['API Management'],
  },
  {
    key: 'compute',
    label: 'Integration Compute',
    subgraphId: 'Compute',
    serviceTypes: ['Logic Apps Standard', 'Logic Apps Consumption', 'Azure Functions', 'Container Apps', 'App Service'],
  },
  {
    key: 'messaging',
    label: 'Messaging',
    subgraphId: 'Messaging',
    serviceTypes: ['Service Bus', 'Event Hubs', 'Event Grid'],
  },
  {
    key: 'data',
    label: 'Storage & Data',
    subgraphId: 'Data',
    serviceTypes: ['Blob Storage', 'Azure SQL', 'Azure Data Factory'],
  },
  {
    key: 'monitoring',
    label: 'Monitoring & Security',
    subgraphId: 'Monitor',
    serviceTypes: ['Application Insights', 'Log Analytics', 'Key Vault'],
  },
];

const STYLE_MAP: Record<LayerKey, { fill: string; stroke: string }> = {
  gateway: { fill: '#a5d8ff', stroke: '#1971c2' },
  compute: { fill: '#d0bfff', stroke: '#7048e8' },
  messaging: { fill: '#fff3bf', stroke: '#fab005' },
  data: { fill: '#b2f2bb', stroke: '#2f9e44' },
  monitoring: { fill: '#e9ecef', stroke: '#868e96' },
};

// ── Helpers ──

export function formatCostLabel(amount: number, currency: string): string {
  const formatted = amount.toLocaleString('en-US', {
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  });
  return `${formatted} ${currency}/mo`;
}

function sanitizeId(s: string): string {
  return s.replace(/[^a-zA-Z0-9]/g, '');
}

interface CollectedService {
  serviceType: AzureServiceType;
  sku: string;
  quantity: number;
  monthlyCost: number;
  currency: string;
}

// ── Main generator ──

export function generateArchitectureDiagram(
  mappings: AzureServiceMapping[],
  result: CostEstimationResult,
): string {
  // 1. Collect unique services and aggregate costs
  const serviceMap = new Map<string, CollectedService>();

  for (const mapping of mappings) {
    for (const target of mapping.targetServices) {
      const key = `${target.serviceType}__${target.sku}`;
      if (!serviceMap.has(key)) {
        serviceMap.set(key, {
          serviceType: target.serviceType,
          sku: target.skuDisplayName || target.sku,
          quantity: target.quantity,
          monthlyCost: 0,
          currency: result.currency,
        });
      } else {
        const existing = serviceMap.get(key)!;
        if (!target.isShared) {
          existing.quantity += target.quantity;
        }
      }
    }
  }

  // Match costs from result categories
  for (const cat of result.categories) {
    for (const svc of cat.services) {
      const key = `${svc.serviceType}__${svc.sku}`;
      const entry = serviceMap.get(key);
      if (entry) {
        entry.monthlyCost = svc.monthlyCost;
      }
    }
  }

  const allServices = Array.from(serviceMap.values());

  // 2. Build source nodes from inputSummary
  const totalIntegrations = result.inputSummary.totalIntegrations;
  const sourceLines: string[] = [];
  const sourceNodeIds: string[] = [];

  // Gather adapter counts from mappings
  const adapterCounts = new Map<string, number>();
  for (const m of mappings) {
    const name = m.biztalkIntegrationName || 'Other';
    // Try to extract adapter type from the name
    const adapterMatch = name.match(/^(FILE|FTP|SFTP|HTTP|SOAP|WCF|SQL|MQ|MSMQ|REST|SAP|SMTP|POP3|Oracle|EDI)/i);
    const adapter = adapterMatch ? adapterMatch[1].toUpperCase() : 'Other';
    adapterCounts.set(adapter, (adapterCounts.get(adapter) || 0) + 1);
  }

  if (adapterCounts.size > 0) {
    let idx = 0;
    for (const [adapter, count] of adapterCounts) {
      idx++;
      const nodeId = `S${idx}`;
      sourceNodeIds.push(nodeId);
      sourceLines.push(`        ${nodeId}["${adapter} (${count})"]`);
    }
  }

  // 3. Group services into layers
  type PopulatedLayer = LayerDef & { services: CollectedService[]; nodeIds: string[] };
  const populatedLayers: PopulatedLayer[] = [];

  for (const layer of LAYERS) {
    const layerServices = allServices.filter((s) =>
      layer.serviceTypes.includes(s.serviceType),
    );
    if (layerServices.length > 0) {
      populatedLayers.push({ ...layer, services: layerServices, nodeIds: [] });
    }
  }

  // 4. Build Mermaid lines
  const lines: string[] = ['graph TD'];

  // Sources subgraph
  if (sourceLines.length > 0) {
    lines.push(`    subgraph Sources["BizTalk Integrations (${totalIntegrations})"]`);
    lines.push(...sourceLines);
    lines.push('    end');
    lines.push('');
  }

  // Service layer subgraphs
  const allNodeIds: string[] = [];

  for (const layer of populatedLayers) {
    lines.push(`    subgraph ${layer.subgraphId}["${layer.label}"]`);
    for (const svc of layer.services) {
      const nodeId = sanitizeId(svc.serviceType);
      layer.nodeIds.push(nodeId);
      allNodeIds.push(nodeId);

      const qtyLabel = svc.quantity > 1 ? ` × ${svc.quantity}` : '';
      const costLabel = svc.monthlyCost > 0
        ? ` · ${formatCostLabel(svc.monthlyCost, svc.currency)}`
        : '';
      const label = `${svc.serviceType}\\n${svc.sku}${qtyLabel}${costLabel}`;
      lines.push(`        ${nodeId}["${label}"]`);
    }
    lines.push('    end');
    lines.push('');
  }

  // 5. Arrows: Sources → Gateway → Compute → Messaging/Data, Compute -.-> Monitor
  const layerByKey = new Map(populatedLayers.map((l) => [l.key, l]));

  const hasSource = sourceNodeIds.length > 0;
  const gatewayLayer = layerByKey.get('gateway');
  const computeLayer = layerByKey.get('compute');
  const messagingLayer = layerByKey.get('messaging');
  const dataLayer = layerByKey.get('data');
  const monitorLayer = layerByKey.get('monitoring');

  // Determine first target after source
  const firstTarget = gatewayLayer || computeLayer;

  if (hasSource && firstTarget) {
    lines.push(`    Sources --> ${firstTarget.subgraphId}`);
  }

  if (gatewayLayer && computeLayer) {
    lines.push(`    ${gatewayLayer.subgraphId} --> ${computeLayer.subgraphId}`);
  }

  if (computeLayer && messagingLayer) {
    lines.push(`    ${computeLayer.subgraphId} --> ${messagingLayer.subgraphId}`);
  }

  if (computeLayer && dataLayer) {
    lines.push(`    ${computeLayer.subgraphId} --> ${dataLayer.subgraphId}`);
  }

  if (computeLayer && monitorLayer) {
    lines.push(`    ${computeLayer.subgraphId} -.-> ${monitorLayer.subgraphId}`);
  }

  // If no compute but gateway connects to messaging/data
  if (!computeLayer && gatewayLayer) {
    if (messagingLayer) lines.push(`    ${gatewayLayer.subgraphId} --> ${messagingLayer.subgraphId}`);
    if (dataLayer) lines.push(`    ${gatewayLayer.subgraphId} --> ${dataLayer.subgraphId}`);
  }

  lines.push('');

  // 6. Style classes
  const styleLines: string[] = [];
  for (const layer of populatedLayers) {
    const style = STYLE_MAP[layer.key];
    for (const nodeId of layer.nodeIds) {
      styleLines.push(`    style ${nodeId} fill:${style.fill},stroke:${style.stroke},stroke-width:2px`);
    }
  }
  // Style source nodes
  for (const sId of sourceNodeIds) {
    styleLines.push(`    style ${sId} fill:#ffc9c9,stroke:#e03131,stroke-width:2px`);
  }

  if (styleLines.length > 0) {
    lines.push(...styleLines);
  }

  return lines.join('\n');
}
