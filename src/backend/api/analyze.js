// analyze.js — Analysis orchestration: agentic tool_use loop + SSE streaming
const express = require('express');
const fs = require('fs');
const path = require('path');
const matter = require('gray-matter');
const {
  getSession, getOrFetchSession, getSessionFreshMeta, updateSession, updateAgentStatus,
  appendEvent, appendAuditEntry, registerSSEClient, unregisterSSEClient, trackTelemetry,
} = require('../sessions/store');
const { search } = require('../search-backends/web-search');
const { queryCustomSources } = require('../search-backends/custom-sources');
const { loadDocument } = require('../storage/documents');
const { getSkillContent, collectSkillSearchOptions } = require('./skills');
const { loadAllAgentsWithBody } = require('./agents');
const { chat, appendAssistant, appendToolResults, resolveModel, DEFAULT_MODEL } = require('../llm/chat');

const router = express.Router();
const MAX_CONCURRENT_AGENTS = 5;

const PROMPTS_DIR = path.resolve(__dirname, '../prompts');

const rawSystemPrompt = fs.readFileSync(path.join(PROMPTS_DIR, 'system-prompt.md'), 'utf-8');
const analysisPromptTemplate = fs.readFileSync(path.join(PROMPTS_DIR, 'analysis-prompt.md'), 'utf-8');
const synthesisPromptTemplate = fs.readFileSync(path.join(PROMPTS_DIR, 'synthesis-prompt.md'), 'utf-8');

// ─── Helpers ──────────────────────────────────────────────────────────────────

function getSystemPrompt() {
  const today = new Date().toISOString().split('T')[0];
  return `${rawSystemPrompt}\n\n**Current date: ${today}**`;
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

async function runWithSearch(sessionId, system, userContent, agentLabel, llmConfig, searchOptions = {}) {
  const { provider, model } = llmConfig;
  const { domains = [], apiSources = [] } = searchOptions;
  const messages = [{ role: 'user', content: userContent }];

  while (true) {
    const response = await chat(provider, model, system, messages);

    trackTelemetry(sessionId, {
      llmCall:      true,
      inputTokens:  response.usage.inputTokens,
      outputTokens: response.usage.outputTokens,
    });

    if (response.stopReason === 'end_turn') {
      return response.text || '';
    }

    // tool_use — append assistant turn, process calls, append results
    appendAssistant(provider, messages, response.raw);

    const toolResults = [];
    for (const tc of response.toolCalls) {
      // Cohere requires a result for every tool_call_id — never skip without pushing a result
      if (tc.name !== 'web_search') {
        toolResults.push({ id: tc.id, content: 'unknown tool' });
        continue;
      }

      const { query, lang = 'en' } = tc.input || {};
      if (!query) {
        console.error(`[web_search] missing query. input: ${JSON.stringify(tc.input)}`);
        toolResults.push({ id: tc.id, content: 'missing query' });
        continue;
      }

      appendEvent(sessionId, { type: 'search', query, lang, agent: agentLabel });
      trackTelemetry(sessionId, { searchCall: true });

      let results = [];
      let searchError = null;
      try {
        // Run Tavily (with skill domains) + custom API sources in parallel
        const [webResults, customResults] = await Promise.all([
          search(query, lang, { includeDomains: domains }),
          queryCustomSources(apiSources, query),
        ]);

        // Merge and deduplicate by URL
        const seen = new Set();
        for (const r of [...webResults, ...customResults]) {
          if (r.url && !seen.has(r.url)) { seen.add(r.url); results.push(r); }
        }

        appendEvent(sessionId, { type: 'search_results', query, count: results.length, agent: agentLabel });
      } catch (err) {
        searchError = err.message;
        appendEvent(sessionId, { type: 'search_error', query, error: err.message, agent: agentLabel });
      }

      appendAuditEntry(sessionId, { agent: agentLabel, query, lang, results, error: searchError, count: results.length });
      toolResults.push({ id: tc.id, content: formatSearchResults(results) });
    }

    appendToolResults(provider, messages, toolResults);
  }
}

// ─── Core Analysis Steps ──────────────────────────────────────────────────────

async function analyzeDocument(sessionId, documentText, llmConfig, availableAgentIds = []) {
  appendEvent(sessionId, { type: 'step', step: 'ANALYZE', message: 'מתחיל ניתוח מסמך...' });
  const agentList = availableAgentIds.length
    ? availableAgentIds.map(id => `- ${id}`).join('\n')
    : '(none configured)';
  const userMessage = analysisPromptTemplate
    .replace('{{AVAILABLE_AGENTS}}', agentList)
    .replace('{{DOCUMENT}}', documentText);
  const text = await runWithSearch(sessionId, getSystemPrompt(), userMessage, 'מנתח', llmConfig);
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

async function runAgent(sessionId, agent, documentText, analysis, llmConfig) {
  updateAgentStatus(sessionId, agent.id, 'active');
  appendEvent(sessionId, { type: 'agent_start', agentId: agent.id, agentName: agent.name });

  // Load skill content from Firestore/disk (async, handles multi-instance Cloud Run)
  const missingSkills = [];
  const rawSkills = await Promise.all(
    (agent.skills || []).map(skillId => getSkillContent(skillId))
  );
  const skillsContent = rawSkills.map((raw, i) => {
    if (!raw) {
      missingSkills.push({ id: agent.skills[i], requiredBy: agent.name, agentId: agent.id });
      return null;
    }
    return matter(raw).content; // body only (after frontmatter)
  }).filter(Boolean).join('\n\n---\n\n');

  // Collect domain + API source overrides from active skills
  const searchOptions = await collectSkillSearchOptions(agent.skills || []);

  const agentSystem = `${getSystemPrompt()}\n\n## תפקיד הסוכן\n${agent.body}\n\n## ידע מקצועי (מיומנויות)\n${skillsContent}`;

  const claimsText = (analysis.keyClaims || [])
    .map((c, i) => `${i + 1}. ${c.text}`).join('\n');

  const userMessage = `# מסמך ההערכה\n\n${documentText}\n\n# טענות מרכזיות שזוהו\n\n${claimsText}\n\nנתח את המסמך לפי תפקידך. חפש מידע עדכני לפני כל טענה עובדתית. כתוב את הניתוח בעברית.`;

  const output = await runWithSearch(sessionId, agentSystem, userMessage, agent.name, llmConfig, searchOptions);

  updateAgentStatus(sessionId, agent.id, 'complete');
  appendEvent(sessionId, { type: 'agent_complete', agentId: agent.id, agentName: agent.name });

  return { agentId: agent.id, agentName: agent.name, output, completedAt: new Date().toISOString(), missingSkills };
}

async function dispatchAgents(sessionId, agents, documentText, analysis, llmConfig) {
  const outputs = {};
  const collectedMissingSkills = [];
  for (let i = 0; i < agents.length; i += MAX_CONCURRENT_AGENTS) {
    const chunk = agents.slice(i, i + MAX_CONCURRENT_AGENTS);
    appendEvent(sessionId, {
      type: 'dispatch',
      message: `מפעיל ${chunk.map(a => a.name).join(', ')}`,
    });
    const results = await Promise.all(chunk.map(a => {
      const agentConfig = a.model ? resolveModel(a.model) : llmConfig;
      return runAgent(sessionId, a, documentText, analysis, agentConfig);
    }));
    results.forEach(r => {
      outputs[r.agentId] = r;
      collectedMissingSkills.push(...(r.missingSkills || []));
    });
  }
  return { outputs, missingSkills: collectedMissingSkills };
}

async function synthesize(sessionId, documentText, analysis, agentOutputs, agents, synthesisFocus, llmConfig) {
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

  const content = await runWithSearch(sessionId, getSystemPrompt(), userMessage, 'מסנתז', llmConfig);

  return {
    content,
    agentsActivated: agents.map(a => a.name),
    skillsActivated: [...new Set(agents.flatMap(a => a.skills || []))],
    generatedAt: new Date().toISOString(),
  };
}

// ─── Background Runner ────────────────────────────────────────────────────────

async function runAnalysis(sessionId, requestedAgentIds, synthesisFocus, modelId) {
  try {
    const llmConfig = resolveModel(modelId || DEFAULT_MODEL);
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

    // Load agents early so analysis prompt can tell the model what's available,
    // enabling it to suggest both in-system agents AND new ones that are missing.
    const allAgents = await loadAllAgentsWithBody();

    // Step 1 — Analyze document
    updateSession(sessionId, { status: 'analyzing', currentStep: 'ANALYZE', model: llmConfig.model });
    const analysis = await analyzeDocument(sessionId, documentText, llmConfig, allAgents.map(a => a.id));
    updateSession(sessionId, { analysis });

    appendEvent(sessionId, {
      type: 'analysis_done',
      claimsFound: analysis.keyClaims?.length || 0,
      message: `זוהו ${analysis.keyClaims?.length || 0} טענות מרכזיות`,
    });

    // Step 2 — Select agents; detect missing ones
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
    const { outputs: agentOutputs, missingSkills } = await dispatchAgents(sessionId, selectedAgents, documentText, analysis, llmConfig);
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
    const report = await synthesize(sessionId, documentText, analysis, agentOutputs, selectedAgents, synthesisFocus, llmConfig);

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
  const { sessionId, agentIds, synthesisFocus, model } = req.body;
  if (!sessionId) return res.status(400).json({ error: 'sessionId is required' });
  const session = getSession(sessionId) || await getOrFetchSession(sessionId);
  if (!session) return res.status(404).json({ error: 'Session not found' });

  res.json({ sessionId, status: 'analyzing' });
  runAnalysis(sessionId, agentIds, synthesisFocus, model);
});

// GET /api/analyze/:sessionId/status?since=N — polling endpoint
// Always reads fresh metadata from Firestore so cross-instance events are visible.
router.get('/:sessionId/status', async (req, res) => {
  const session = await getSessionFreshMeta(req.params.sessionId);
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
