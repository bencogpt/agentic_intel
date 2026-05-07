// custom-sources.js — Query external API data sources with optional auth
'use strict';

const { getSourceWithCredentials } = require('../api/sources');

// ─── Auth header builders ──────────────────────────────────────────────────────

function buildAuthHeaders(auth) {
  if (!auth || auth.type === 'none') return {};
  if (auth.type === 'basic') {
    const encoded = Buffer.from(`${auth.username || ''}:${auth.password || ''}`).toString('base64');
    return { Authorization: `Basic ${encoded}` };
  }
  if (auth.type === 'apikey') {
    const header = auth.apiKeyHeader || 'X-API-Key';
    return { [header]: auth.apiKey || '' };
  }
  return {};
}

// ─── Response field resolver — supports dot-notation paths ───────────────────

function resolvePath(obj, dotPath) {
  if (!dotPath) return undefined;
  return dotPath.split('.').reduce((cur, key) => (cur && cur[key] !== undefined ? cur[key] : undefined), obj);
}

// ─── Main query function ──────────────────────────────────────────────────────

async function querySource(source, query) {
  const { url, method = 'GET', queryParam = 'q', auth, responseMap = {} } = source;
  const {
    resultsPath = 'results',
    title:   titleField   = 'title',
    url:     urlField     = 'url',
    snippet: snippetField = 'description',
    date:    dateField    = 'date',
  } = responseMap;

  const authHeaders = buildAuthHeaders(auth);
  let fetchUrl = url;
  let fetchOpts = { headers: { 'Content-Type': 'application/json', ...authHeaders } };

  if (method === 'POST') {
    fetchOpts.method = 'POST';
    fetchOpts.body = JSON.stringify({ [queryParam]: query });
  } else {
    const u = new URL(url);
    u.searchParams.set(queryParam, query);
    fetchUrl = u.toString();
    fetchOpts.method = 'GET';
  }

  const res = await fetch(fetchUrl, fetchOpts);
  if (!res.ok) throw new Error(`Source "${source.name}" returned HTTP ${res.status}`);

  const data = await res.json();
  const items = resolvePath(data, resultsPath);
  if (!Array.isArray(items)) return [];

  return items.map(item => ({
    title:      String(resolvePath(item, titleField)   || ''),
    url:        String(resolvePath(item, urlField)     || ''),
    snippet:    String(resolvePath(item, snippetField) || ''),
    date:       String(resolvePath(item, dateField)    || ''),
    sourceTier: 2,
    sourceLabel: source.name,
  })).filter(r => r.url);
}

// ─── Batch query across multiple source IDs ───────────────────────────────────

async function queryCustomSources(sourceIds, query) {
  if (!sourceIds?.length) return [];

  const results = await Promise.allSettled(
    sourceIds.map(async id => {
      const src = await getSourceWithCredentials(id);
      if (!src) return [];
      return querySource(src, query);
    })
  );

  return results.flatMap(r => r.status === 'fulfilled' ? r.value : []);
}

module.exports = { queryCustomSources };
