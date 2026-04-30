// analyze.js — Analysis orchestration: agentic tool_use loop + SSE streaming
const express = require('express');
const fs = require('fs');
const path = require('path');
const matter = require('gray-matter');
const Anthropic = require('@anthropic-ai/sdk');
const {
  getSession, getOrFetchSession, updateSession, updateAgentStatus,
  appendEvent, appendAuditEntry, registerSSEClient, unregisterSSEClient, trackTelemetry,
} = require('../sessions/store');
const { search } = require('../search-backends/web-search');
const { loadDocument } = require('../storage/documents');

const router = express.Router();
const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
const MODEL = process.env.CLAUDE_MODEL || 'claude-sonnet-4-6';
const MAX_CONCURRENT_AGENTS = 5;

const PROMPTS_DIR = path.resolve(__dirname, '../prompts');
const PROJECT_ROOT = path.resolve(__dirname, '../../../');

const rawSystemPrompt = fs.readFileSync(path.join(PROMPTS_DIR, 'system-prompt.md'), 'utf-8');
const analysisPromptTemplate = fs.readFileSync(path.join(PROMPTS_DIR, 'analysis-prompt.md'), 'utf-8');
const synthesisPromptTemplate = fs.readFileSync(path.join(PROMPTS_DIR, 'synthesis-prompt.md'), 'utf-8');

// ─── Web Search Tool Definition ───────────────────────────────────────────────

const WEB_SEARCH_TOOL = {
  name: 'web_search',
  description: 'Search the web for current information. MUST be used before making any factual claim about specific events, persons, or situations. Use Hebrew queries for Israeli/Middle East sources, English for international sources, Arabic for Arab media.',
  input_schema: {
    type: 'object',
    properties: {
      query: { type: 'string', description: 'The search query — be specific, include dates/locations/names' },
      lang: { type: 'string', enum: ['he', 'en', 'ar'], description: 'Query language: he=Hebrew, en=English, ar=Arabic' },
    },
    required: ['query'],
  },
};

// ─── Helpers ──────────────────────────────────────────────────────────────────

function getSystemPrompt() {
  const today = new Date().toISOString().split('T')[0];
  return `${rawSystemPrompt}\n\n**Current date: ${today}**`;
}

function findSkillFile(skillId) {
  for (const sub of ['default', 'custom']) {
    const p = path.join(PROJECT_ROOT, 'skills', sub, `${skillId}.md`);
    if (fs.existsSync(p)) return p;
  }
  return null;
}

function loadAllAgents() {
  const agents = [];
  for (const sub of ['default', 'custom']) {
    const dir = path.join(PROJECT_ROOT, 'agents', sub);
    if (!fs.existsSync(dir)) continue;
    for (const file of fs.readdirSync(dir)) {
      if (!file.endsWith('.md')) continue;
      const raw = fs.readFileSync(path.join(dir, file), 'utf-8');
      const { data, content } = matter(raw);
      agents.push({ id: file.replace('.md', ''), ...data, body: content, isCustom: sub === 'custom' });
    }
  }
  return agents;
}

function extractJson(text) {
  // Try code block first
  const codeBlock = text.match(/```(?:json)?\s*([\s\S]*?)```/);
  if (codeBlock) return codeBlock[1].trim();

  // Fallback: find outermost { ... }
  const start = text.indexOf('{');
  const end = text.lastIndexOf('}');
  if (start !== -1 && end > start) return text.slice(start, end + 1);

  return text.trim();
}

function formatSearchResults(results) {
  if (!results.length) return 'לא נמצאו תוצאות';
  return results.map(r =>
    `**${r.title}** (${r.date || 'תאריך לא ידוע'})\nURL: ${r.url}\nרמת מקור: ${r.sourceTier}\n${r.snippet}`
  ).join('\n\n---\n\n');
}

// ─── Agentic Tool-Use Loop ────────────────────────────────────────────────────

async function runWithSearch(sessionId, system, userContent, agentLabel) {
  const messages = [{ role: 'user', content: userContent }];

  while (true) {
    const response = await client.messages.create({
      model: MODEL,
      max_tokens: 8192,
      system,
      tools: [WEB_SEARCH_TOOL],
      messages,
    });

    // Track LLM call and token usage
    trackTelemetry(sessionId, {
      llmCall: true,
      inputTokens: response.usage?.input_tokens || 0,
      outputTokens: response.usage?.output_tokens || 0,
    });

    if (response.stop_reason === 'end_turn' || response.stop_reason === 'max_tokens') {
      return response.content.find(b => b.type === 'text')?.text || '';
    }

    if (response.stop_reason === 'tool_use') {
      messages.push({ role: 'assistant', content: response.content });

      const toolResults = [];
      for (const block of response.content) {
        if (block.type !== 'tool_use') continue;
        if (block.name !== 'web_search') continue;

        const { query, lang = 'en' } = block.input || {};
        if (!query) {
          console.error(`[web_search] tool_use missing query field. input was: ${JSON.stringify(block.input)}`);
          continue;
        }
        appendEvent(sessionId, { type: 'search', query, lang, agent: agentLabel });
        trackTelemetry(sessionId, { searchCall: true });

        let results = [];
        let searchError = null;
        try {
          results = await search(query, lang);
          appendEvent(sessionId, { type: 'search_results', query, count: results.length, agent: agentLabel });
        } catch (err) {
          searchError = err.message;
          appendEvent(sessionId, { type: 'search_error', query, error: err.message, agent: agentLabel });
        }

        appendAuditEntry(sessionId, {
          agent: agentLabel,
          query,
          lang,
          results,
          error: searchError,
          count: results.length,
        });

        toolResults.push({
          type: 'tool_result',
          tool_use_id: block.id,
          content: formatSearchResults(results),
        });
      }

      messages.push({ role: 'user', content: toolResults });
    } else {
      // unexpected stop reason
      return response.content.find(b => b.type === 'text')?.text || '';
    }
  }
}

// ─── Core Analysis Steps ──────────────────────────────────────────────────────

async function analyzeDocument(sessionId, documentText) {
  appendEvent(sessionId, { type: 'step', step: 'ANALYZE', message: 'מתחיל ניתוח מסמך...' });
  const userMessage = analysisPromptTemplate.replace('{{DOCUMENT}}', documentText);
  const text = await runWithSearch(sessionId, getSystemPrompt(), userMessage, 'מנתח');
  const raw = extractJson(text);
  try {
    return JSON.parse(raw);
  } catch (parseErr) {
    console.error(`[ANALYZE] JSON parse failed: ${parseErr.message}`);
    console.error(`[ANALYZE] Raw response (first 500 chars): ${raw.slice(0, 500)}`);
    appendEvent(sessionId, { type: 'warning', message: `לא ניתן לנתח JSON: ${parseErr.message}` });
    return {
      keyClaims: [{ id: 'claim-1', text: 'שגיאה בניתוח — ראה לוג שרת', confidence: 'low', sourceCount: 0,
        confidenceReasoning: 'שגיאת עיבוד JSON בשלב הניתוח', riskIfWrong: 'high',
        riskReasoning: 'לא ניתן להעריך — ניתוח אוטומטי נכשל', sourceRefs: [] }],
      assumptions: [], informationGaps: [], singleSourceDependencies: [],
      possibleBiases: [], suggestedAgents: ['agent-devils-advocate'],
    };
  }
}

async function runAgent(sessionId, agent, documentText, analysis) {
  updateAgentStatus(sessionId, agent.id, 'active');
  appendEvent(sessionId, { type: 'agent_start', agentId: agent.id, agentName: agent.name });

  // Collect missing skills for this agent
  const missingSkills = [];
  const skillsContent = (agent.skills || []).map(skillId => {
    const p = findSkillFile(skillId);
    if (!p) {
      missingSkills.push({ id: skillId, requiredBy: agent.name, agentId: agent.id });
      return '';
    }
    const { content } = matter(fs.readFileSync(p, 'utf-8'));
    return content;
  }).filter(Boolean).join('\n\n---\n\n');

  const agentSystem = `${getSystemPrompt()}\n\n## תפקיד הסוכן\n${agent.body}\n\n## ידע מקצועי (מיומנויות)\n${skillsContent}`;

  const claimsText = (analysis.keyClaims || [])
    .map((c, i) => `${i + 1}. ${c.text}`).join('\n');

  const userMessage = `# מסמך ההערכה\n\n${documentText}\n\n# טענות מרכזיות שזוהו\n\n${claimsText}\n\nנתח את המסמך לפי תפקידך. חפש מידע עדכני לפני כל טענה עובדתית. כתוב את הניתוח בעברית.`;

  const output = await runWithSearch(sessionId, agentSystem, userMessage, agent.name);

  updateAgentStatus(sessionId, agent.id, 'complete');
  appendEvent(sessionId, { type: 'agent_complete', agentId: agent.id, agentName: agent.name });

  return { agentId: agent.id, agentName: agent.name, output, completedAt: new Date().toISOString(), missingSkills };
}

async function dispatchAgents(sessionId, agents, documentText, analysis) {
  const outputs = {};
  const collectedMissingSkills = [];
  for (let i = 0; i < agents.length; i += MAX_CONCURRENT_AGENTS) {
    const chunk = agents.slice(i, i + MAX_CONCURRENT_AGENTS);
    appendEvent(sessionId, {
      type: 'dispatch',
      message: `מפעיל ${chunk.map(a => a.name).join(', ')}`,
    });
    const results = await Promise.all(chunk.map(a => runAgent(sessionId, a, documentText, analysis)));
    results.forEach(r => {
      outputs[r.agentId] = r;
      collectedMissingSkills.push(...(r.missingSkills || []));
    });
  }
  return { outputs, missingSkills: collectedMissingSkills };
}

async function synthesize(sessionId, documentText, analysis, agentOutputs, agents, synthesisFocus) {
  appendEvent(sessionId, { type: 'step', step: 'SYNTHESIZE', message: 'מסנתז דו"ח סופי...' });

  const agentOutputsText = Object.values(agentOutputs)
    .map(o => `## ${o.agentName}\n\n${o.output}`)
    .join('\n\n---\n\n');

  const focusNote = synthesisFocus
    ? `\n\n## מיקוד סינתזה (מה-Workflow)\n${synthesisFocus}`
    : '';

  const userMessage = synthesisPromptTemplate
    .replace('{{AGENT_OUTPUTS}}', agentOutputsText)
    .replace('{{DOCUMENT_SUMMARY}}', documentText.substring(0, 1500)) + focusNote;

  const content = await runWithSearch(sessionId, getSystemPrompt(), userMessage, 'מסנתז');

  return {
    content,
    agentsActivated: agents.map(a => a.name),
    skillsActivated: [...new Set(agents.flatMap(a => a.skills || []))],
    generatedAt: new Date().toISOString(),
  };
}

// ─── Background Runner ────────────────────────────────────────────────────────

async function runAnalysis(sessionId, requestedAgentIds, synthesisFocus) {
  try {
    const session = getSession(sessionId);

    // Resolve document text — in-memory on same instance, or load from storage on cold-start
    let documentText = session.documentText;
    if (!documentText) {
      documentText = await loadDocument(sessionId);
      if (!documentText) {
        appendEvent(sessionId, { type: 'error', message: 'מסמך לא נמצא — לא ניתן לנתח' });
        updateSession(sessionId, { status: 'error', error: 'Document not found in storage' });
        return;
      }
      // Cache in-memory only (STORAGE_FIELDS excludes documentText from Firestore writes)
      updateSession(sessionId, { documentText });
    }

    // Step 1 — Analyze document
    updateSession(sessionId, { status: 'analyzing', currentStep: 'ANALYZE' });
    const analysis = await analyzeDocument(sessionId, documentText);
    updateSession(sessionId, { analysis });

    appendEvent(sessionId, {
      type: 'analysis_done',
      claimsFound: analysis.keyClaims?.length || 0,
      message: `זוהו ${analysis.keyClaims?.length || 0} טענות מרכזיות`,
    });

    // Step 2 — Select agents; detect missing ones
    const allAgents = loadAllAgents();
    const availableIds = new Set(allAgents.map(a => a.id));
    const suggestedIds = requestedAgentIds?.length
      ? requestedAgentIds
      : [...(analysis.suggestedAgents || []), 'agent-devils-advocate'];

    const missingAgents = suggestedIds
      .filter(id => !availableIds.has(id))
      .map(id => ({ id, name: id.replace(/^agent-/, '').replace(/-/g, ' ') }));

    const selectedAgents = allAgents.filter(a => suggestedIds.includes(a.id));
    if (!selectedAgents.length) selectedAgents.push(...allAgents.filter(a => a.id === 'agent-devils-advocate'));

    updateSession(sessionId, {
      status: 'dispatching', currentStep: 'DISPATCH',
      activeAgents: selectedAgents.map(a => ({ id: a.id, name: a.name, status: 'waiting' })),
    });
    appendEvent(sessionId, {
      type: 'step',
      step: 'DISPATCH',
      message: `נבחרו ${selectedAgents.length} סוכנים: ${selectedAgents.map(a => a.name).join(', ')}`,
    });
    if (missingAgents.length) {
      appendEvent(sessionId, {
        type: 'missing_agents',
        message: `סוכנים חסרים: ${missingAgents.map(a => a.name).join(', ')}`,
        agents: missingAgents,
      });
    }

    // Step 3 — Research (agent dispatch)
    updateSession(sessionId, { status: 'researching', currentStep: 'RESEARCH' });
    appendEvent(sessionId, { type: 'step', step: 'RESEARCH', message: 'סוכנים מתחילים מחקר...' });
    const { outputs: agentOutputs, missingSkills } = await dispatchAgents(sessionId, selectedAgents, documentText, analysis);
    updateSession(sessionId, { agentOutputs });

    // Deduplicate missing skills by id
    const seenSkillIds = new Set();
    const uniqueMissingSkills = missingSkills.filter(s => {
      if (seenSkillIds.has(s.id)) return false;
      seenSkillIds.add(s.id);
      return true;
    });

    // Store and broadcast suggestions if any gaps found
    if (missingAgents.length || uniqueMissingSkills.length) {
      const suggestions = { missingAgents, missingSkills: uniqueMissingSkills };
      updateSession(sessionId, { suggestions });
      appendEvent(sessionId, {
        type: 'suggestions',
        missingAgents,
        missingSkills: uniqueMissingSkills,
        message: `זוהו ${missingAgents.length} סוכנים ו-${uniqueMissingSkills.length} מיומנויות חסרים`,
      });
    }

    // Step 4 — Synthesize
    updateSession(sessionId, { status: 'synthesizing', currentStep: 'SYNTHESIZE' });
    const report = await synthesize(sessionId, documentText, analysis, agentOutputs, selectedAgents, synthesisFocus);

    appendEvent(sessionId, { type: 'complete', message: 'הדו"ח הושלם' });
    updateSession(sessionId, { status: 'complete', report, completedAt: new Date().toISOString() });
  } catch (err) {
    console.error(`Analysis failed [${sessionId}]:`, err.message);
    appendEvent(sessionId, { type: 'error', message: err.message });
    updateSession(sessionId, { status: 'error', error: err.message });
  }
}

// ─── Routes ───────────────────────────────────────────────────────────────────

// POST /api/analyze — start analysis
router.post('/', async (req, res) => {
  const { sessionId, agentIds, synthesisFocus } = req.body;
  if (!sessionId) return res.status(400).json({ error: 'sessionId is required' });
  const session = getSession(sessionId) || await getOrFetchSession(sessionId);
  if (!session) return res.status(404).json({ error: 'Session not found' });

  res.json({ sessionId, status: 'analyzing' });
  runAnalysis(sessionId, agentIds, synthesisFocus);
});

// GET /api/analyze/:sessionId/status?since=N — polling endpoint
// Returns status + all events since index N (so client can request only new ones)
router.get('/:sessionId/status', async (req, res) => {
  const session = getSession(req.params.sessionId) || await getOrFetchSession(req.params.sessionId);
  if (!session) return res.status(404).json({ error: 'Session not found' });
  const since = parseInt(req.query.since, 10) || 0;
  const allEvents = session.events || [];
  res.json({
    sessionId: session.id,
    status: session.status,
    currentStep: session.currentStep,
    activeAgents: session.activeAgents || [],
    error: session.error || null,
    events: allEvents.slice(since),
    totalEvents: allEvents.length,
  });
});

// GET /api/analyze/:sessionId/stream — SSE live event stream
router.get('/:sessionId/stream', async (req, res) => {
  const session = getSession(req.params.sessionId) || await getOrFetchSession(req.params.sessionId);
  if (!session) return res.status(404).json({ error: 'Session not found' });

  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');
  res.setHeader('X-Accel-Buffering', 'no');
  res.flushHeaders();

  // Replay buffered events so late-connecting clients catch up
  const past = session.events || [];
  for (const ev of past) {
    try { res.write(`data: ${JSON.stringify(ev)}\n\n`); } catch (_) {}
  }

  // Send current status as a synthetic event if already done
  if (session.status === 'complete' || session.status === 'error') {
    res.write(`data: ${JSON.stringify({ type: session.status, ts: Date.now() })}\n\n`);
    res.end();
    return;
  }

  registerSSEClient(req.params.sessionId, res);

  const keepalive = setInterval(() => {
    try { res.write(': ping\n\n'); } catch (_) {}
  }, 20000);

  req.on('close', () => {
    clearInterval(keepalive);
    unregisterSSEClient(req.params.sessionId);
  });
});

module.exports = router;
