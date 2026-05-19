// llm/chat.js — Unified LLM chat abstraction (Anthropic + Cohere)
// Normalizes the agentic tool-use loop across providers so analyze.js stays provider-agnostic.
'use strict';

const Anthropic = require('@anthropic-ai/sdk');
const { CohereClient } = require('cohere-ai');

// ─── Clients (lazy init) ──────────────────────────────────────────────────────

let _anthropic = null;
let _cohere = null;

function getAnthropic() {
  if (!_anthropic) _anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
  return _anthropic;
}

function getCohere() {
  if (!_cohere) _cohere = new CohereClient({ token: process.env.COHERE_API_KEY });
  return _cohere;
}

// ─── Tool definitions ─────────────────────────────────────────────────────────

const WEB_SEARCH_TOOL_ANTHROPIC = {
  name: 'web_search',
  description: 'Search the web for current information. MUST be used before making any factual claim about specific events, persons, or situations.',
  input_schema: {
    type: 'object',
    properties: {
      query: { type: 'string', description: 'The search query — be specific, include dates/locations/names' },
      lang: { type: 'string', enum: ['he', 'en', 'ar'], description: 'Query language' },
    },
    required: ['query'],
  },
};

const WEB_SEARCH_TOOL_COHERE = {
  type: 'function',
  function: {
    name: 'web_search',
    description: 'Search the web for current information. MUST be used before making any factual claim about specific events, persons, or situations.',
    parameters: {
      type: 'object',
      properties: {
        query: { type: 'string', description: 'The search query — be specific, include dates/locations/names' },
        lang: { type: 'string', enum: ['he', 'en', 'ar'], description: 'Query language: he=Hebrew, en=English, ar=Arabic' },
      },
      required: ['query'],
    },
  },
};

// ─── Normalized response shape ─────────────────────────────────────────────────
// {
//   stopReason: 'tool_use' | 'end_turn',
//   text:       string | null,
//   toolCalls:  Array<{ id: string, name: string, input: object }>,
//   raw:        any,   // provider-specific message object — push to history as-is
//   usage:      { inputTokens: number, outputTokens: number },
// }

// ─── Anthropic ────────────────────────────────────────────────────────────────

async function chatAnthropic(model, system, messages) {
  const response = await getAnthropic().messages.create({
    model,
    max_tokens: 16384,
    system,
    tools: [WEB_SEARCH_TOOL_ANTHROPIC],
    messages,
  });

  const isToolUse = response.stop_reason === 'tool_use';
  return {
    stopReason: isToolUse ? 'tool_use' : 'end_turn',
    text: response.content.find(b => b.type === 'text')?.text || null,
    toolCalls: isToolUse
      ? response.content.filter(b => b.type === 'tool_use').map(b => ({ id: b.id, name: b.name, input: b.input }))
      : [],
    raw: response.content,  // push as { role: 'assistant', content: raw }
    usage: {
      inputTokens:  response.usage?.input_tokens  || 0,
      outputTokens: response.usage?.output_tokens || 0,
    },
  };
}

// ─── Cohere ───────────────────────────────────────────────────────────────────

async function chatCohere(model, system, messages) {
  // Cohere v2: system is prepended as first message in the array
  const cohereMessages = [{ role: 'system', content: system }, ...messages];

  // Force at least one tool call on the opening turn so the model doesn't skip searches.
  // After the first tool result is present in history, revert to "auto" — the model
  // can decide whether to search again or produce its final text.
  const hasPriorToolResults = messages.some(m => m.role === 'tool');
  const response = await getCohere().v2.chat({
    model,
    maxTokens: 16384,
    toolChoice: hasPriorToolResults ? undefined : 'REQUIRED',
    tools: [WEB_SEARCH_TOOL_COHERE],
    messages: cohereMessages,
  });

  const isApiToolUse = response.finishReason === 'TOOL_CALL';
  // SDK deserializes snake_case API fields to camelCase — use toolCalls, not tool_calls
  let toolCalls = isApiToolUse
    ? (response.message?.toolCalls || []).map(tc => ({
        id:    tc.id,
        name:  tc.function?.name,
        input: (() => { try { return JSON.parse(tc.function?.arguments || '{}'); } catch { return {}; } })(),
      }))
    : [];

  // Extract text from content array (standard v2 format)
  let text = !isApiToolUse
    ? ((response.message?.content || []).find(b => b.type === 'text')?.text || null)
    : null;

  // command-a-03-2025 sometimes outputs tool calls in the OLD Cohere v1 JSON format
  // as plain text content (e.g. [{"tool_call_id":"1","tool_name":"web_search","parameters":{...}}])
  // instead of using the v2 API tool_call mechanism. Detect and re-route as proper tool calls
  // so the agentic loop continues and produces actual text output.
  let syntheticRaw = null; // replacement raw message with proper v2 tool_calls for history
  if (!isApiToolUse && text) {
    const trimmed = text.trim();
    if (trimmed.startsWith('[') || trimmed.startsWith('{')) {
      try {
        const parsed = JSON.parse(trimmed);
        const calls = Array.isArray(parsed) ? parsed : [parsed];
        if (calls.length > 0 && (calls[0].tool_name || calls[0].tool_call_id)) {
          toolCalls = calls.map((tc, i) => ({
            id:    String(tc.tool_call_id || i + 1),
            name:  tc.tool_name || tc.name || 'web_search',
            input: tc.parameters || tc.input || {},
          }));
          text = null; // discard — real answer comes after executing these calls
          // Build a synthetic v2-format assistant message so conversation history is valid
          syntheticRaw = {
            role: 'assistant',
            toolCalls: toolCalls.map(tc => ({
              id: tc.id, type: 'function',
              function: { name: tc.name, arguments: JSON.stringify(tc.input) },
            })),
          };
          console.log('[Cohere] detected v1-style tool call in text — re-routing as tool_use');
        }
      } catch (_) {}
    }
  }

  const isToolUse = isApiToolUse || toolCalls.length > 0;

  if (!isToolUse && !text) {
    console.error('[Cohere] text extraction failed — finishReason:', response.finishReason,
      'content:', JSON.stringify(response.message?.content));
  }

  return {
    stopReason: isToolUse ? 'tool_use' : 'end_turn',
    text,
    toolCalls,
    raw: syntheticRaw || response.message, // use synthetic v2 message when re-routing v1 calls
    usage: {
      inputTokens:  response.usage?.billedUnits?.inputTokens  || 0,
      outputTokens: response.usage?.billedUnits?.outputTokens || 0,
    },
  };
}

// ─── Unified entry point ──────────────────────────────────────────────────────

/**
 * Make one LLM call (not the full agentic loop).
 * @param {string} provider  'anthropic' | 'cohere'
 * @param {string} model     Model ID
 * @param {string} system    System prompt
 * @param {Array}  messages  Message history (no system in array for Anthropic; Cohere prepends it)
 * @returns {Promise<NormalizedResponse>}
 */
async function chat(provider, model, system, messages) {
  if (provider === 'cohere') return chatCohere(model, system, messages);
  return chatAnthropic(model, system, messages);
}

// ─── Message history helpers ──────────────────────────────────────────────────

/**
 * Append the assistant's turn to the running message history.
 * Must be called before appendToolResults.
 */
function appendAssistant(provider, messages, raw) {
  if (provider === 'anthropic') {
    messages.push({ role: 'assistant', content: raw });
  } else {
    // Cohere: raw is already the full AssistantChatMessageV2 object
    messages.push(raw);
  }
}

/**
 * Append tool results to the running message history.
 * @param {Array<{id: string, content: string}>} results
 */
function appendToolResults(provider, messages, results) {
  if (provider === 'anthropic') {
    messages.push({
      role: 'user',
      content: results.map(r => ({ type: 'tool_result', tool_use_id: r.id, content: r.content })),
    });
  } else {
    // Cohere: SDK serializer expects camelCase toolCallId → serializes to tool_call_id for API
    for (const r of results) {
      messages.push({ role: 'tool', toolCallId: r.id, content: r.content });
    }
  }
}

// ─── Model registry ───────────────────────────────────────────────────────────

const MODELS = {
  'claude-sonnet-4-6': {
    provider:    'anthropic',
    label:       'Claude Sonnet 4.6',
    labelEn:     'Claude Sonnet',
    description: 'מודל מהיר ומדויק של Anthropic',
  },
  'command-a-03-2025': {
    provider:    'cohere',
    label:       'Cohere Command A',
    labelEn:     'Command A Reasoning',
    description: 'מודל הסקה של Cohere — חשיבה מעמיקה',
  },
};

const DEFAULT_MODEL = process.env.CLAUDE_MODEL || 'claude-sonnet-4-6';

function resolveModel(modelId) {
  const m = MODELS[modelId];
  if (!m) return { provider: 'anthropic', model: DEFAULT_MODEL };
  return { provider: m.provider, model: modelId };
}

module.exports = { chat, appendAssistant, appendToolResults, resolveModel, MODELS, DEFAULT_MODEL };
