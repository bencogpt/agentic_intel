// web-search.js — Tavily AI search backend (grounding)

const TIER1_DOMAINS = [
  'reuters.com', 'apnews.com', 'bbc.com', 'bbc.co.uk', 'un.org',
  'nytimes.com', 'theguardian.com', 'haaretz.com', 'timesofisrael.com',
  'jpost.com', 'aljazeera.com', 'france24.com', 'dw.com', 'npr.org',
  'washingtonpost.com', 'ft.com', 'economist.com',
];
const TIER3_DOMAINS = ['twitter.com', 'x.com', 'facebook.com', 'reddit.com', 'tiktok.com'];

function classifySourceTier(url = '') {
  const d = url.toLowerCase();
  if (TIER1_DOMAINS.some(t => d.includes(t))) return 1;
  if (TIER3_DOMAINS.some(t => d.includes(t))) return 3;
  return 2;
}

async function search(query, lang = 'en', options = {}) {
  const key = process.env.TAVILY_API_KEY;
  if (!key) throw new Error('TAVILY_API_KEY not set');

  // Guard: query must be a non-empty string — undefined is silently dropped by JSON.stringify
  if (!query || typeof query !== 'string' || !query.trim()) {
    throw new Error(`Invalid search query: ${JSON.stringify(query)}`);
  }

  const { includeDomains = [] } = options;

  const res = await fetch('https://api.tavily.com/search', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      api_key: key,          // Tavily REST API requires api_key in body
      query: query.trim(),
      search_depth: 'advanced',
      include_answer: false,
      include_raw_content: false,
      max_results: 6,
      ...(includeDomains.length && { include_domains: includeDomains }),
    }),
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Tavily error ${res.status}: ${text.slice(0, 200)}`);
  }

  const data = await res.json();
  return (data.results || []).map(r => ({
    title: r.title || '',
    url: r.url || '',
    snippet: r.content || '',
    date: r.published_date || '',
    sourceTier: classifySourceTier(r.url),
  }));
}

module.exports = { search };
