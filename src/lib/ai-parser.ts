import OpenAI from 'openai';
import type {
  BizTalkAnalysis,
  BizTalkIntegration,
  BizTalkAdapterType,
  VolumeEstimate,
} from './types';
import { normalizeAdapterType } from './input-parser';

// ── AI client (lazy singleton) ──
// Tries GitHub Models first (GITHUB_TOKEN), falls back to OpenAI (OPENAI_API_KEY)

let _openai: OpenAI | null = null;

function getClient(): OpenAI {
  if (!_openai) {
    const githubToken = process.env.GITHUB_TOKEN;
    const openaiKey = process.env.OPENAI_API_KEY;

    if (githubToken) {
      // GitHub Models API — OpenAI-SDK compatible, no extra cost for Copilot users
      _openai = new OpenAI({
        baseURL: 'https://models.inference.ai.azure.com',
        apiKey: githubToken,
      });
    } else if (openaiKey) {
      _openai = new OpenAI({ apiKey: openaiKey });
    } else {
      throw new Error(
        'No AI API key found. Set either GITHUB_TOKEN (recommended, free with GitHub Copilot) ' +
        'or OPENAI_API_KEY in your .env.local file.',
      );
    }
  }
  return _openai;
}

// GitHub Models uses different model names than OpenAI
function getModelName(): string {
  return process.env.GITHUB_TOKEN ? 'gpt-4o' : 'gpt-4o';
}

// ── Public API ──

/** Use OpenAI to parse free-text client descriptions into structured BizTalk analysis */
export async function parseWithAI(text: string): Promise<BizTalkAnalysis> {
  const client = getClient();
  const prompt = buildExtractionPrompt(text);

  const response = await client.chat.completions.create({
    model: getModelName(),
    temperature: 0.1,
    response_format: { type: 'json_object' },
    messages: [
      { role: 'system', content: prompt },
      { role: 'user', content: text },
    ],
  });

  const raw = response.choices[0]?.message?.content;
  if (!raw) {
    throw new Error('OpenAI returned an empty response');
  }

  return normalizeAIResponse(JSON.parse(raw));
}

// ── Prompt Construction ──

/** Build the system prompt that instructs the model to extract BizTalk analysis data */
export function buildExtractionPrompt(_text: string): string {
  return `You are a BizTalk integration analysis expert. Your task is to extract structured information from a client description of their BizTalk environment.

The input may be in English or Swedish. Interpret both languages accurately.

Extract the following and return valid JSON (no markdown fences):

{
  "totalIntegrations": <number>,
  "integrations": [
    {
      "name": "<descriptive name>",
      "adapterType": "<FILE|FTP|SFTP|HTTP|SOAP|WCF|SQL|MQ|MSMQ|REST|SAP|SMTP|POP3|Oracle|EDI|UNKNOWN>",
      "direction": "<send|receive|both>",
      "complexity": "<simple|medium|complex>",
      "hasOrchestration": <boolean>,
      "hasMapping": <boolean>,
      "messagesPerDay": <number or null>,
      "avgMessageSizeKB": <number or null>,
      "description": "<optional note>"
    }
  ],
  "volumeEstimate": {
    "messagesPerDayLow": <number>,
    "messagesPerDayAvg": <number>,
    "messagesPerDayPeak": <number>,
    "avgMessageSizeKB": <number>
  },
  "existingAzureServices": ["<service names already in use>"],
  "notes": ["<any additional observations, seasonal patterns, etc.>"]
}

Rules:
1. "totalIntegrations" must match the total described (e.g. "ca 120" → 120).
2. Break integrations into groups by type when the description gives percentages or counts.
   - For example "25-30% file transfers" with 120 total → create ~33 FILE integrations (use upper bound).
   - Distribute the rest across likely types based on context.
3. For each group, create representative integration entries. If there are too many to list individually, create one entry per group with a name like "File Transfer Integrations (33)" and set messagesPerDay proportionally.
4. Map adapter types to the canonical values listed above.
5. Complexity mapping:
   - "enkla" / "simple" / "file transfers" → simple
   - Standard integrations without orchestration → medium
   - Integrations with orchestration, complex mapping, or multiple steps → complex
6. If the client mentions Azure services they already use (Logic Apps, Container Apps, Azure Functions, APIM, Service Bus, Event Hubs, Blob Storage, etc.), list them in "existingAzureServices".
7. For volume estimates, use reasonable defaults if not stated:
   - Low: 50% of average, Peak: 3x average
   - Default avg message size: 50 KB unless stated otherwise
8. Include any notes about seasonal patterns, migration timeline, or special requirements.
9. Return ONLY the JSON object. No explanation or markdown.`;
}

// ── Response Normalization ──

function normalizeAIResponse(data: Record<string, unknown>): BizTalkAnalysis {
  const rawIntegrations = Array.isArray(data.integrations) ? data.integrations : [];

  const integrations: BizTalkIntegration[] = rawIntegrations.map(
    (item: unknown, idx: number) => {
      const rec = item as Record<string, unknown>;
      return {
        id: `ai-${idx + 1}`,
        name: String(rec.name ?? `Integration ${idx + 1}`),
        adapterType: normalizeAdapterType(String(rec.adapterType ?? rec.adapter ?? 'UNKNOWN')),
        direction: normalizeDir(rec.direction),
        complexity: normalizeComp(rec.complexity),
        hasOrchestration: Boolean(rec.hasOrchestration ?? false),
        hasMapping: Boolean(rec.hasMapping ?? false),
        description: rec.description ? String(rec.description) : undefined,
        messagesPerDay: toOptionalNumber(rec.messagesPerDay),
        avgMessageSizeKB: toOptionalNumber(rec.avgMessageSizeKB),
      };
    },
  );

  const total =
    typeof data.totalIntegrations === 'number'
      ? data.totalIntegrations
      : integrations.length;

  const analysis: BizTalkAnalysis = {
    totalIntegrations: total as number,
    integrations,
  };

  // Volume estimate
  if (data.volumeEstimate && typeof data.volumeEstimate === 'object') {
    const ve = data.volumeEstimate as Record<string, unknown>;
    const avg = toOptionalNumber(ve.messagesPerDayAvg) ?? 1000;
    analysis.volumeEstimate = {
      messagesPerDayLow: toOptionalNumber(ve.messagesPerDayLow) ?? Math.round(avg * 0.5),
      messagesPerDayAvg: avg,
      messagesPerDayPeak: toOptionalNumber(ve.messagesPerDayPeak) ?? Math.round(avg * 3),
      avgMessageSizeKB: toOptionalNumber(ve.avgMessageSizeKB) ?? 50,
    } satisfies VolumeEstimate;
  }

  if (Array.isArray(data.existingAzureServices) && data.existingAzureServices.length > 0) {
    analysis.existingAzureServices = data.existingAzureServices.map(String);
  }

  if (Array.isArray(data.notes) && data.notes.length > 0) {
    analysis.notes = data.notes.map(String);
  }

  return analysis;
}

// ── Tiny helpers ──

function normalizeDir(raw: unknown): 'send' | 'receive' | 'both' {
  if (typeof raw !== 'string') return 'both';
  const d = raw.trim().toLowerCase();
  if (d === 'send' || d === 'outbound') return 'send';
  if (d === 'receive' || d === 'inbound') return 'receive';
  return 'both';
}

function normalizeComp(raw: unknown): 'simple' | 'medium' | 'complex' {
  if (typeof raw !== 'string') return 'medium';
  const c = raw.trim().toLowerCase();
  if (c === 'simple' || c === 'low') return 'simple';
  if (c === 'complex' || c === 'high') return 'complex';
  return 'medium';
}

function toOptionalNumber(val: unknown): number | undefined {
  if (typeof val === 'number' && !Number.isNaN(val)) return val;
  if (typeof val === 'string') {
    const n = parseFloat(val);
    if (!Number.isNaN(n)) return n;
  }
  return undefined;
}
