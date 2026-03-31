import type {
  RawInput,
  BizTalkAnalysis,
  BizTalkIntegration,
  BizTalkAdapterType,
} from './types';

// ── Adapter name normalization map ──

const ADAPTER_MAP: Record<string, BizTalkAdapterType> = {
  file: 'FILE',
  ftp: 'FTP',
  sftp: 'SFTP',
  http: 'HTTP',
  'http/s': 'HTTP',
  https: 'HTTP',
  soap: 'SOAP',
  'wcf-basichttp': 'WCF',
  'wcf-wshttp': 'WCF',
  'wcf-nettcp': 'WCF',
  'wcf-custom': 'WCF',
  'wcf-customisolated': 'WCF',
  'wcf-sql': 'SQL',
  'wcf-oracle': 'Oracle',
  'wcf-oracledb': 'Oracle',
  'wcf-sap': 'SAP',
  'wcf-siebel': 'WCF',
  wcf: 'WCF',
  sql: 'SQL',
  mq: 'MQ',
  mqseries: 'MQ',
  'mqseries agent': 'MQ',
  msmq: 'MSMQ',
  rest: 'REST',
  'rest/api': 'REST',
  api: 'REST',
  sap: 'SAP',
  smtp: 'SMTP',
  pop3: 'POP3',
  oracle: 'Oracle',
  oracledb: 'Oracle',
  edi: 'EDI',
  'edi/as2': 'EDI',
  as2: 'EDI',
};

/** Map raw adapter strings to the canonical BizTalkAdapterType */
export function normalizeAdapterType(raw: string): BizTalkAdapterType {
  const key = raw.trim().toLowerCase();
  if (ADAPTER_MAP[key]) return ADAPTER_MAP[key];

  // Prefix-based fallbacks
  if (key.startsWith('wcf-')) return 'WCF';
  if (key.startsWith('mq')) return 'MQ';
  if (key.startsWith('ftp')) return 'FTP';
  if (key.startsWith('oracle')) return 'Oracle';

  return 'UNKNOWN';
}

// ── Main entry point ──

/** Route to the correct parser based on input format */
export function parseInput(raw: RawInput): BizTalkAnalysis {
  switch (raw.format) {
    case 'json':
      return parseJsonInput(raw.content);
    case 'markdown':
      return parseMarkdownInput(raw.content);
    case 'xml-binding':
      return parseBindingXml(raw.content);
    case 'text':
      return parseMarkdownInput(raw.content); // best-effort text parsing
    default:
      throw new Error(`Unsupported input format: ${raw.format}`);
  }
}

// ── JSON Parser ──

/** Parse BizTalk analysis JSON (e.g. Bixray output) */
export function parseJsonInput(content: string): BizTalkAnalysis {
  const data = JSON.parse(content);

  // Support both { integrations: [...] } and a bare array
  const items: unknown[] = Array.isArray(data)
    ? data
    : Array.isArray(data.integrations)
      ? data.integrations
      : [];

  const integrations: BizTalkIntegration[] = items.map(
    (item: unknown, idx: number) => {
      const rec = item as Record<string, unknown>;
      return {
        id: String(rec.id ?? `int-${idx + 1}`),
        name: String(rec.name ?? `Integration ${idx + 1}`),
        adapterType: normalizeAdapterType(String(rec.adapter ?? rec.adapterType ?? 'UNKNOWN')),
        direction: normalizeDirection(rec.direction),
        complexity: normalizeComplexity(rec.complexity),
        hasOrchestration: Boolean(rec.hasOrchestration ?? false),
        hasMapping: Boolean(rec.hasMapping ?? false),
        description: rec.description ? String(rec.description) : undefined,
        messagesPerDay: typeof rec.messagesPerDay === 'number' ? rec.messagesPerDay : undefined,
        avgMessageSizeKB: typeof rec.avgMessageSizeKB === 'number' ? rec.avgMessageSizeKB : undefined,
      };
    },
  );

  // Pull top-level metadata when available
  const analysis: BizTalkAnalysis = {
    totalIntegrations: integrations.length,
    integrations,
  };

  if (!Array.isArray(data) && data.volumeEstimate) {
    analysis.volumeEstimate = data.volumeEstimate;
  }
  if (!Array.isArray(data) && Array.isArray(data.existingAzureServices)) {
    analysis.existingAzureServices = data.existingAzureServices.map(String);
  }
  if (!Array.isArray(data) && Array.isArray(data.notes)) {
    analysis.notes = data.notes.map(String);
  }

  return analysis;
}

// ── Markdown / Text Parser ──

/** Parse BizTalk analysis Markdown reports or free-form text */
export function parseMarkdownInput(content: string): BizTalkAnalysis {
  const integrations: BizTalkIntegration[] = [];
  const notes: string[] = [];
  let totalCount = 0;

  // 1. Try to extract total integration count from prose
  const countPatterns = [
    /(\d+)\s*(?:biztalk[- ]?burna\s+)?integrat(?:ion|ioner)/i,
    /(?:ca|circa|approximately|about|~)\s*(\d+)\s*integrat/i,
    /totalt?\s*[:\-]?\s*(\d+)/i,
    /(\d+)\s*(?:total|totalt)/i,
  ];
  for (const pat of countPatterns) {
    const m = content.match(pat);
    if (m) {
      totalCount = parseInt(m[1], 10);
      break;
    }
  }

  // 2. Extract adapter breakdowns ("25-30% file transfers", "40 HTTP integrations")
  const breakdownPatterns: { pattern: RegExp; adapter: BizTalkAdapterType; complexity?: 'simple' | 'medium' | 'complex' }[] = [
    { pattern: /(\d+)[\s-]*(?:\d+)?%?\s*(?:of\s+)?(?:these\s+)?(?:are\s+)?(?:enkla\s+)?file\s+transfers?/i, adapter: 'FILE', complexity: 'simple' },
    { pattern: /(\d+)[\s-]*(?:\d+)?%?\s*(?:of\s+)?(?:these\s+)?(?:are\s+)?(?:http|api|rest)/i, adapter: 'HTTP' },
    { pattern: /(\d+)[\s-]*(?:\d+)?%?\s*(?:of\s+)?(?:these\s+)?(?:are\s+)?(?:ftp|sftp)/i, adapter: 'FTP' },
    { pattern: /(\d+)[\s-]*(?:\d+)?%?\s*(?:of\s+)?(?:these\s+)?(?:are\s+)?(?:sql|databas)/i, adapter: 'SQL' },
    { pattern: /(\d+)[\s-]*(?:\d+)?%?\s*(?:of\s+)?(?:these\s+)?(?:are\s+)?(?:mq|message\s*queue|messaging)/i, adapter: 'MQ' },
    { pattern: /(\d+)[\s-]*(?:\d+)?%?\s*(?:of\s+)?(?:these\s+)?(?:are\s+)?(?:soap|wcf)/i, adapter: 'SOAP' },
    { pattern: /(\d+)[\s-]*(?:\d+)?%?\s*(?:of\s+)?(?:these\s+)?(?:are\s+)?(?:sap)/i, adapter: 'SAP' },
    { pattern: /(\d+)[\s-]*(?:\d+)?%?\s*(?:of\s+)?(?:these\s+)?(?:are\s+)?(?:edi|as2)/i, adapter: 'EDI' },
  ];

  let idCounter = 1;
  for (const { pattern, adapter, complexity } of breakdownPatterns) {
    const m = content.match(pattern);
    if (m) {
      const value = parseInt(m[1], 10);
      // If the number looks like a percentage and we have a total, convert
      const count = value <= 100 && totalCount > 0
        ? Math.round((value / 100) * totalCount)
        : value;

      for (let i = 0; i < count; i++) {
        integrations.push({
          id: `md-${idCounter++}`,
          name: `${adapter} Integration ${i + 1}`,
          adapterType: adapter,
          direction: 'both',
          complexity: complexity ?? 'medium',
          hasOrchestration: (complexity ?? 'medium') !== 'simple',
          hasMapping: (complexity ?? 'medium') !== 'simple',
        });
      }
    }
  }

  // 3. Parse Markdown tables (| Name | Adapter | Direction | Complexity | ...)
  const tableRowRegex = /^\|([^|]+)\|([^|]+)\|([^|]+)\|([^|]+)\|/gm;
  let tableMatch: RegExpExecArray | null;
  let headerSkipped = false;
  while ((tableMatch = tableRowRegex.exec(content)) !== null) {
    const cells = [tableMatch[1], tableMatch[2], tableMatch[3], tableMatch[4]].map(c => c.trim());
    // Skip header and separator rows
    if (cells[0].startsWith('---') || cells[0].startsWith('Name') || cells[0].startsWith('Integration')) {
      headerSkipped = true;
      continue;
    }
    if (!headerSkipped) {
      headerSkipped = true;
      continue;
    }
    integrations.push({
      id: `md-${idCounter++}`,
      name: cells[0],
      adapterType: normalizeAdapterType(cells[1]),
      direction: normalizeDirection(cells[2]),
      complexity: normalizeComplexity(cells[3]),
      hasOrchestration: false,
      hasMapping: false,
    });
  }

  // 4. Parse bullet-list items ("- OrderImport (FILE, simple)")
  const bulletRegex = /^[-*]\s+(.+?)\s*\(([^,)]+)(?:,\s*([^)]+))?\)/gm;
  let bulletMatch: RegExpExecArray | null;
  while ((bulletMatch = bulletRegex.exec(content)) !== null) {
    integrations.push({
      id: `md-${idCounter++}`,
      name: bulletMatch[1].trim(),
      adapterType: normalizeAdapterType(bulletMatch[2]),
      direction: 'both',
      complexity: normalizeComplexity(bulletMatch[3]),
      hasOrchestration: false,
      hasMapping: false,
    });
  }

  // 5. Parse heading-based sections ("## OrderImport\n- Adapter: FILE")
  const headingRegex = /^#{1,4}\s+(.+)$/gm;
  let headingMatch: RegExpExecArray | null;
  const headings: { name: string; startIndex: number }[] = [];
  while ((headingMatch = headingRegex.exec(content)) !== null) {
    headings.push({ name: headingMatch[1].trim(), startIndex: headingMatch.index });
  }
  for (let i = 0; i < headings.length; i++) {
    const section = content.slice(
      headings[i].startIndex,
      i + 1 < headings.length ? headings[i + 1].startIndex : content.length,
    );
    const adapterMatch = section.match(/adapter[:\s]+(\S+)/i);
    const complexityMatch = section.match(/complexity[:\s]+(simple|medium|complex)/i);
    const directionMatch = section.match(/direction[:\s]+(send|receive|both)/i);
    if (adapterMatch) {
      integrations.push({
        id: `md-${idCounter++}`,
        name: headings[i].name,
        adapterType: normalizeAdapterType(adapterMatch[1]),
        direction: normalizeDirection(directionMatch?.[1]),
        complexity: normalizeComplexity(complexityMatch?.[1]),
        hasOrchestration: /orchestration/i.test(section),
        hasMapping: /map(?:ping)?/i.test(section),
      });
    }
  }

  // 6. Extract existing Azure services
  const azureServices: string[] = [];
  const servicePatterns = [
    'Logic Apps', 'Container Apps', 'Azure Functions', 'APIM',
    'API Management', 'Blob Storage', 'Event Hubs', 'Service Bus',
    'Event Grid', 'Azure SQL', 'App Service', 'Data Factory',
    'Key Vault', 'Application Insights', 'Log Analytics',
  ];
  for (const svc of servicePatterns) {
    if (new RegExp(svc.replace(/\s+/g, '\\s+'), 'i').test(content)) {
      azureServices.push(svc);
    }
  }

  // If we found a total but no specific integrations from breakdown, back-fill
  if (totalCount > 0 && integrations.length === 0) {
    for (let i = 0; i < totalCount; i++) {
      integrations.push({
        id: `md-${idCounter++}`,
        name: `Integration ${i + 1}`,
        adapterType: 'UNKNOWN',
        direction: 'both',
        complexity: 'medium',
        hasOrchestration: false,
        hasMapping: false,
      });
    }
  }

  const finalTotal = totalCount > 0 ? Math.max(totalCount, integrations.length) : integrations.length;

  // Fill remaining if total exceeds specific breakdown
  while (integrations.length < finalTotal) {
    integrations.push({
      id: `md-${idCounter++}`,
      name: `Integration ${integrations.length + 1}`,
      adapterType: 'UNKNOWN',
      direction: 'both',
      complexity: 'medium',
      hasOrchestration: false,
      hasMapping: false,
    });
  }

  return {
    totalIntegrations: finalTotal,
    integrations,
    existingAzureServices: azureServices.length > 0 ? azureServices : undefined,
    notes: notes.length > 0 ? notes : undefined,
  };
}

// ── Binding XML Parser ──

/** Parse BizTalk binding XML exports */
export function parseBindingXml(content: string): BizTalkAnalysis {
  const integrations: BizTalkIntegration[] = [];
  let idCounter = 1;

  // Extract ReceivePorts
  const receivePortRegex = /<ReceivePort\s[^>]*Name="([^"]*)"[^>]*>([\s\S]*?)<\/ReceivePort>/gi;
  let rpMatch: RegExpExecArray | null;
  while ((rpMatch = receivePortRegex.exec(content)) !== null) {
    const portName = rpMatch[1];
    const portBody = rpMatch[2];

    // Each ReceivePort may contain ReceiveLocations with TransportType
    const locRegex = /<ReceiveLocation\s[^>]*Name="([^"]*)"[^>]*>([\s\S]*?)<\/ReceiveLocation>/gi;
    let locMatch: RegExpExecArray | null;
    let foundLocation = false;
    while ((locMatch = locRegex.exec(portBody)) !== null) {
      foundLocation = true;
      const locBody = locMatch[2];
      const adapterType = extractTransportType(locBody);
      const hasOrch = /Orchestration/i.test(portBody);

      integrations.push({
        id: `xml-${idCounter++}`,
        name: locMatch[1] || portName,
        adapterType: normalizeAdapterType(adapterType),
        direction: 'receive',
        complexity: hasOrch ? 'complex' : 'medium',
        hasOrchestration: hasOrch,
        hasMapping: /<Transform/i.test(portBody) || /<Map/i.test(portBody),
      });
    }

    if (!foundLocation) {
      const adapterType = extractTransportType(portBody);
      integrations.push({
        id: `xml-${idCounter++}`,
        name: portName,
        adapterType: normalizeAdapterType(adapterType),
        direction: 'receive',
        complexity: 'medium',
        hasOrchestration: false,
        hasMapping: false,
      });
    }
  }

  // Extract SendPorts
  const sendPortRegex = /<SendPort\s[^>]*Name="([^"]*)"[^>]*>([\s\S]*?)<\/SendPort>/gi;
  let spMatch: RegExpExecArray | null;
  while ((spMatch = sendPortRegex.exec(content)) !== null) {
    const portName = spMatch[1];
    const portBody = spMatch[2];
    const adapterType = extractTransportType(portBody);
    const hasOrch = /Orchestration/i.test(portBody);

    integrations.push({
      id: `xml-${idCounter++}`,
      name: portName,
      adapterType: normalizeAdapterType(adapterType),
      direction: 'send',
      complexity: hasOrch ? 'complex' : inferXmlComplexity(portBody),
      hasOrchestration: hasOrch,
      hasMapping: /<Transform/i.test(portBody) || /<Map/i.test(portBody),
    });
  }

  return {
    totalIntegrations: integrations.length,
    integrations,
  };
}

// ── Helpers ──

function extractTransportType(xml: string): string {
  // <TransportType Name="FILE" />  or  <TransportType>FILE</TransportType>
  const attrMatch = xml.match(/<TransportType\s[^>]*Name="([^"]*)"[^/]*\/?>/i);
  if (attrMatch) return attrMatch[1];

  const tagMatch = xml.match(/<TransportType[^>]*>([^<]+)<\/TransportType>/i);
  if (tagMatch) return tagMatch[1].trim();

  // Fallback: look for TransportTypeData with adapter clues
  const adapterHint = xml.match(/adapterName="([^"]*)"/i);
  if (adapterHint) return adapterHint[1];

  return 'UNKNOWN';
}

function inferXmlComplexity(portBody: string): 'simple' | 'medium' | 'complex' {
  if (/<Transform/i.test(portBody) || /<Map/i.test(portBody)) return 'medium';
  if (/<Filter/i.test(portBody) && /<Map/i.test(portBody)) return 'complex';
  return 'simple';
}

function normalizeDirection(raw: unknown): 'send' | 'receive' | 'both' {
  if (typeof raw !== 'string') return 'both';
  const d = raw.trim().toLowerCase();
  if (d === 'send' || d === 'outbound') return 'send';
  if (d === 'receive' || d === 'inbound') return 'receive';
  return 'both';
}

function normalizeComplexity(raw: unknown): 'simple' | 'medium' | 'complex' {
  if (typeof raw !== 'string') return 'medium';
  const c = raw.trim().toLowerCase();
  if (c === 'simple' || c === 'low' || c === 'easy' || c === 'enkel') return 'simple';
  if (c === 'complex' || c === 'high' || c === 'hard' || c === 'komplex') return 'complex';
  return 'medium';
}
