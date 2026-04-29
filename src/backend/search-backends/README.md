# Search Backends

AVAR uses a pluggable search architecture. Each backend must export a `search(query, lang)` function.

## Interface

```js
/**
 * @param {string} query - Search query
 * @param {string} lang  - Language hint: 'he' | 'en' | 'ar'
 * @returns {Promise<SearchResult[]>}
 */
async function search(query, lang) { ... }

// SearchResult shape:
{
  title: string,
  url: string,
  snippet: string,
  date: string,       // ISO date or ''
  sourceTier: 1|2|3   // 1=high credibility, 3=low
}
```

## Available Backends

| Backend file | Description | Env var needed |
|---|---|---|
| `web-search.js` | Generic web search | `WEB_SEARCH_API_KEY` |

## Adding a New Backend

1. Create `my-backend.js` in this directory implementing the interface above
2. Set `SEARCH_BACKEND=my-backend` in `.env`
3. The `search.js` API route will automatically route to it

## Source Tier Criteria

| Tier | Examples |
|---|---|
| 1 — High | Reuters, AP, BBC, academic papers, UN/government official docs |
| 2 — Medium | Regional newspapers, established think tanks, verified NGOs |
| 3 — Low | Social media, anonymous blogs, single-source claims |
