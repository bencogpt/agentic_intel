// chat.js — Follow-up chat on a completed report (SSE streaming)
const express = require('express');
const fs = require('fs');
const path = require('path');
const Anthropic = require('@anthropic-ai/sdk');
const { getSession, trackTelemetry } = require('../sessions/store');
const { search } = require('../search-backends/web-search');

const router = express.Router();
const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
const MODEL = process.env.CLAUDE_MODEL || 'claude-sonnet-4-6';

const rawSystemPrompt = fs.readFileSync(
  path.resolve(__dirname, '../prompts/system-prompt.md'), 'utf-8'
);

const WEB_SEARCH_TOOL = {
  name: 'web_search',
  description: 'Search the web for current information before making any factual claim.',
  input_schema: {
    type: 'object',
    properties: {
      query: { type: 'string' },
      lang: { type: 'string', enum: ['he', 'en', 'ar'] },
    },
    required: ['query'],
  },
};

function buildSystemPrompt(session) {
  const today = new Date().toISOString().split('T')[0];
  const docExcerpt = (session.documentText || '').slice(0, 2500);
  const reportExcerpt = (session.report?.content || '').slice(0, 4000);

  return `${rawSystemPrompt}

**Current date: ${today}**

---

## הקשר — דו"ח AVAR שהושלם

### מסמך ההערכה המקורי (קטע):
${docExcerpt}

### דו"ח הניתוח (קטע):
${reportExcerpt}

---

ענה על שאלות המשך של האנליסט לגבי הדו"ח. השתמש ב-web_search לפני כל טענה עובדתית עדכנית.
השב בעברית. היה ספציפי וכלול מקורות.`;
}

// POST /api/chat/:sessionId — SSE streaming chat
router.post('/:sessionId', async (req, res) => {
  const session = getSession(req.params.sessionId);
  if (!session) return res.status(404).json({ error: 'Session not found' });
  if (session.status !== 'complete') return res.status(400).json({ error: 'Report not ready' });

  const { message, history = [] } = req.body;
  if (!message?.trim()) return res.status(400).json({ error: 'message is required' });

  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');
  res.setHeader('X-Accel-Buffering', 'no');
  res.flushHeaders();

  const emit = (ev) => {
    try { res.write(`data: ${JSON.stringify(ev)}\n\n`); } catch (_) {}
  };

  const systemPrompt = buildSystemPrompt(session);

  // Build messages: history + new user message
  const messages = [
    ...history.map(h => ({ role: h.role, content: h.content })),
    { role: 'user', content: message },
  ];

  try {
    let fullResponse = '';

    while (true) {
      const response = await client.messages.create({
        model: MODEL,
        max_tokens: 4096,
        system: systemPrompt,
        tools: [WEB_SEARCH_TOOL],
        messages,
      });

      trackTelemetry(req.params.sessionId, {
        llmCall: true,
        inputTokens: response.usage?.input_tokens || 0,
        outputTokens: response.usage?.output_tokens || 0,
      });

      if (response.stop_reason === 'tool_use') {
        messages.push({ role: 'assistant', content: response.content });

        const toolResults = [];
        for (const block of response.content) {
          if (block.type !== 'tool_use' || block.name !== 'web_search') continue;

          const { query, lang = 'en' } = block.input;
          emit({ type: 'search', query, lang });
          trackTelemetry(req.params.sessionId, { searchCall: true });

          let results = [];
          try {
            results = await search(query, lang);
            emit({ type: 'search_results', count: results.length, query });
          } catch (err) {
            emit({ type: 'search_error', query, error: err.message });
          }

          const resultText = results.length
            ? results.map(r => `**${r.title}** (${r.date || ''})\nURL: ${r.url}\nרמת מקור: ${r.sourceTier}\n${r.snippet}`).join('\n\n---\n\n')
            : 'לא נמצאו תוצאות';

          toolResults.push({ type: 'tool_result', tool_use_id: block.id, content: resultText });
        }
        messages.push({ role: 'user', content: toolResults });

      } else {
        // end_turn or max_tokens — emit final response
        fullResponse = response.content.find(b => b.type === 'text')?.text || '';
        emit({ type: 'response', text: fullResponse });
        emit({ type: 'done' });
        res.end();
        return;
      }
    }
  } catch (err) {
    emit({ type: 'error', message: err.message });
    res.end();
  }
});

module.exports = router;
