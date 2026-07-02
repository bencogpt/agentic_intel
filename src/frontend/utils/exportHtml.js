// exportHtml.js — Client-side rich HTML report generator for AVAR

const BRAND = '#1a3a6b';

function esc(s) {
  if (s == null) return '';
  return String(s)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function fmtTokens(n) {
  if (!n) return '0';
  return n >= 1000 ? `${Math.round(n / 1000)}K` : String(n);
}

// ─── Source tier ──────────────────────────────────────────────────────────────

const TIER1_DOMAINS = ['reuters.com','apnews.com','bbc.com','bbc.co.uk','un.org','nytimes.com',
  'theguardian.com','haaretz.com','timesofisrael.com','jpost.com','aljazeera.com','washingtonpost.com'];
const TIER3_DOMAINS = ['twitter.com','x.com','facebook.com','reddit.com','tiktok.com'];

function urlTier(url) {
  const d = (url || '').toLowerCase();
  if (TIER1_DOMAINS.some(t => d.includes(t))) return 1;
  if (TIER3_DOMAINS.some(t => d.includes(t))) return 3;
  return 2;
}

const TIER_CSS = {
  1: 'background:#dcfce7;color:#166534',
  2: 'background:#f3f4f6;color:#6b7280',
  3: 'background:#fee2e2;color:#dc2626',
};

function tierBadge(tier) {
  return `<span style="display:inline-block;padding:1px 7px;border-radius:4px;font-size:0.72em;font-weight:700;${TIER_CSS[tier] || TIER_CSS[2]}">T${tier}</span>`;
}

function badge(label, css) {
  return `<span style="display:inline-block;padding:2px 8px;border-radius:4px;font-size:0.78em;font-weight:600;${css}">${esc(label)}</span>`;
}

// ─── Inline markdown → HTML ───────────────────────────────────────────────────

function inlineHtml(text) {
  if (!text) return '';
  const parts = [];
  const pattern = /(\*\*[^*]+\*\*|\[[^\]]+\]\(https?:\/\/[^)]+\)|https?:\/\/\S+)/g;
  let last = 0, m;
  while ((m = pattern.exec(text)) !== null) {
    if (m.index > last) parts.push(esc(text.slice(last, m.index)));
    const chunk = m[0];
    if (chunk.startsWith('**')) {
      parts.push(`<strong>${esc(chunk.slice(2, -2))}</strong>`);
    } else if (chunk.startsWith('[')) {
      const lm = chunk.match(/\[([^\]]+)\]\((https?:\/\/[^)]+)\)/);
      if (lm) {
        const tier = urlTier(lm[2]);
        parts.push(`<a href="${esc(lm[2])}" target="_blank">${esc(lm[1])}</a> ${tierBadge(tier)}`);
      }
    } else {
      const tier = urlTier(chunk);
      parts.push(`<a href="${esc(chunk)}" target="_blank" style="font-size:0.85em;word-break:break-all">${esc(chunk)}</a> ${tierBadge(tier)}`);
    }
    last = m.index + chunk.length;
  }
  if (last < text.length) parts.push(esc(text.slice(last)));
  return parts.join('');
}

function mdToHtml(text) {
  if (!text) return '<p style="color:#9ca3af">—</p>';
  return text.split('\n').map(line => {
    if (line.startsWith('### '))
      return `<h3 style="font-size:0.95em;font-weight:700;color:#111827;margin:1em 0 0.3em">${inlineHtml(line.slice(4))}</h3>`;
    if (line.startsWith('## '))
      return `<h2 style="font-size:1.05em;font-weight:700;color:#111827;margin:1.3em 0 0.4em">${inlineHtml(line.slice(3))}</h2>`;
    if (line.trim() === '---')
      return '<hr style="border:none;border-top:1px solid #e5e7eb;margin:0.8em 0">';
    if (!line.trim())
      return '<div style="height:0.4em"></div>';
    if (line.startsWith('- ') || line.startsWith('* '))
      return `<div style="display:flex;gap:0.5em;margin:0.2em 0"><span style="color:#9ca3af;flex-shrink:0">•</span><span>${inlineHtml(line.slice(2))}</span></div>`;
    if (/^\d+\.\s/.test(line)) {
      const rm = line.match(/^(\d+)\.\s(.*)/);
      return `<div style="display:flex;gap:0.5em;margin:0.2em 0"><span style="color:#6b7280;font-family:monospace;flex-shrink:0">${esc(rm[1])}.</span><span>${inlineHtml(rm[2])}</span></div>`;
    }
    return `<p style="margin:0.2em 0">${inlineHtml(line)}</p>`;
  }).join('\n');
}

// ─── Markdown section parser ──────────────────────────────────────────────────

function parseSection(content, headingText) {
  if (!content) return null;
  const lines = content.split('\n');
  let inSection = false;
  const out = [];
  for (const line of lines) {
    if (line.startsWith('## ')) {
      if (inSection) break;
      if (line.includes(headingText)) { inSection = true; continue; }
    }
    if (inSection) out.push(line);
  }
  const result = out.join('\n').trim();
  return result || null;
}

function parsePreamble(content) {
  if (!content) return '';
  const idx = content.indexOf('\n## ');
  return idx === -1 ? content : content.slice(0, idx).trim();
}

// ─── Confidence / risk helpers ────────────────────────────────────────────────

function confidenceBadge(c) {
  if (c === 'high')   return badge('ביטחון: גבוה',   'background:#dcfce7;color:#166534');
  if (c === 'medium') return badge('ביטחון: בינוני', 'background:#fef9c3;color:#854d0e');
  return badge('ביטחון: נמוך', 'background:#fee2e2;color:#dc2626');
}

function riskBadge(r) {
  if (r === 'high')   return badge('סיכון אם שגוי: גבוה',   'background:#fee2e2;color:#dc2626');
  if (r === 'medium') return badge('סיכון אם שגוי: בינוני', 'background:#ffedd5;color:#c2410c');
  return badge('סיכון אם שגוי: נמוך', 'background:#f3f4f6;color:#6b7280');
}

function assumptionTypeBadge(type) {
  return type === 'implicit'
    ? badge('סמויה',   'background:#fef3c7;color:#92400e')
    : badge('מפורשת', 'background:#e0e7ff;color:#3730a3');
}

function relevanceBadge(r) {
  if (r === 'high')   return badge('גבוה',   'background:#fee2e2;color:#dc2626');
  if (r === 'medium') return badge('בינוני', 'background:#fef9c3;color:#854d0e');
  return badge('נמוך', 'background:#f3f4f6;color:#6b7280');
}

// ─── Section builders ─────────────────────────────────────────────────────────

function buildSummary(content) {
  const preamble = parsePreamble(content);
  const exec = parseSection(content, 'תמצית מנהלים');
  let html = mdToHtml(preamble);
  if (exec) {
    html += `<h2 style="font-size:1.05em;font-weight:700;color:#111827;margin:1.5em 0 0.5em;padding-top:1em;border-top:1px solid #f3f4f6">תמצית מנהלים</h2>`;
    html += mdToHtml(exec);
  }
  return html || '<p style="color:#9ca3af">אין תוכן</p>';
}

function buildClaims(analysis) {
  let html = '';

  const claims = analysis?.keyClaims || [];
  html += `<h2 style="font-size:1em;font-weight:700;color:#374151;margin:0 0 1em">טענות מרכזיות שזוהו</h2>`;

  if (claims.length === 0) {
    html += '<p style="color:#9ca3af">לא זוהו טענות</p>';
  } else {
    for (const c of claims) {
      const confBg = c.confidence === 'high' ? '#f0fdf4' : c.confidence === 'medium' ? '#fefce8' : '#fef2f2';
      const confBorder = c.confidence === 'high' ? '#bbf7d0' : c.confidence === 'medium' ? '#fef08a' : '#fecaca';
      const riskBg = c.riskIfWrong === 'high' ? '#fef2f2' : c.riskIfWrong === 'medium' ? '#fff7ed' : '#f9fafb';
      const riskBorder = c.riskIfWrong === 'high' ? '#fecaca' : c.riskIfWrong === 'medium' ? '#fed7aa' : '#e5e7eb';

      html += `<div style="border:1px solid #e5e7eb;border-radius:10px;overflow:hidden;margin-bottom:16px">`;
      html += `<div style="padding:12px 16px;background:white"><p style="font-size:0.9em;font-weight:500;color:#111827;line-height:1.6">${esc(c.text)}</p></div>`;

      html += `<div style="padding:10px 16px;border-top:1px solid ${confBorder};background:${confBg}">`;
      html += `<div style="margin-bottom:6px">${confidenceBadge(c.confidence)}`;
      if (c.sourceCount > 0) html += ` <span style="font-size:0.8em;color:#6b7280">${esc(c.sourceCount)} מקורות</span>`;
      html += `</div>`;
      if (c.confidenceReasoning) html += `<p style="font-size:0.8em;color:#374151;line-height:1.5">${esc(c.confidenceReasoning)}</p>`;
      html += `</div>`;

      if (c.riskIfWrong || c.riskReasoning) {
        html += `<div style="padding:10px 16px;border-top:1px solid ${riskBorder};background:${riskBg}">`;
        html += `<div style="margin-bottom:6px">${riskBadge(c.riskIfWrong)}</div>`;
        if (c.riskReasoning) html += `<p style="font-size:0.8em;color:#374151;line-height:1.5">${esc(c.riskReasoning)}</p>`;
        html += `</div>`;
      }

      if (c.sourceRefs?.length > 0) {
        html += `<div style="padding:10px 16px;border-top:1px solid #f3f4f6;background:#f9fafb">`;
        html += `<p style="font-size:0.78em;font-weight:600;color:#6b7280;margin-bottom:6px">מקורות ועדויות:</p>`;
        html += `<ul style="list-style:none;padding:0;margin:0">`;
        for (const src of c.sourceRefs) {
          html += `<li style="font-size:0.8em;color:#4b5563;margin:3px 0;display:flex;gap:6px"><span style="color:#9ca3af;flex-shrink:0">›</span><span>${inlineHtml(src)}</span></li>`;
        }
        html += `</ul></div>`;
      }

      html += `</div>`;
    }
  }

  const assumptions = analysis?.assumptions || [];
  if (assumptions.length > 0) {
    html += `<h2 style="font-size:1em;font-weight:700;color:#374151;margin:2em 0 1em;padding-top:1em;border-top:1px solid #f3f4f6">הנחות שזוהו</h2>`;
    for (const a of assumptions) {
      html += `<div style="border:1px solid #fde68a;border-radius:10px;overflow:hidden;margin-bottom:12px">`;
      html += `<div style="padding:12px 16px;background:#fffbeb">`;
      html += `<div style="margin-bottom:8px">${assumptionTypeBadge(a.type)} ${riskBadge(a.riskIfWrong)}</div>`;
      html += `<p style="font-size:0.9em;color:#1f2937">${esc(a.text)}</p>`;
      html += `</div>`;
      if (a.riskReasoning) {
        html += `<div style="padding:10px 16px;border-top:1px solid #fde68a;background:white">`;
        html += `<p style="font-size:0.78em;font-weight:600;color:#6b7280;margin-bottom:4px">מה יקרה אם ההנחה שגויה:</p>`;
        html += `<p style="font-size:0.8em;color:#374151;line-height:1.5">${esc(a.riskReasoning)}</p>`;
        html += `</div>`;
      }
      html += `</div>`;
    }
  }

  return html;
}

function buildMdSection(content, heading, empty) {
  const sec = parseSection(content, heading);
  if (!sec) return empty ? `<p style="color:#9ca3af">${esc(empty)}</p>` : null;
  return mdToHtml(sec);
}

function buildEntities(entities) {
  if (!entities) return '<p style="color:#9ca3af">ישויות לא חולצו מהערכה זו.</p>';

  const total = (entities.persons?.length || 0) + (entities.organizations?.length || 0) +
    (entities.locations?.length || 0) + (entities.events?.length || 0);
  if (total === 0) return '<p style="color:#9ca3af">לא זוהו ישויות</p>';

  let html = '';

  const group = (title, items, sub) => {
    if (!items?.length) return;
    html += `<div style="margin-bottom:20px">`;
    html += `<h3 style="font-size:0.85em;color:#6b7280;border-bottom:1px solid #f3f4f6;padding-bottom:6px;margin-bottom:10px">${esc(title)}</h3>`;
    html += `<div style="display:flex;flex-wrap:wrap;gap:8px">`;
    for (const item of items) {
      html += `<div style="display:inline-flex;align-items:center;gap:6px;background:#f9fafb;border:1px solid #e5e7eb;border-radius:8px;padding:4px 12px">`;
      html += `<span style="font-size:0.85em;font-weight:500;color:#1f2937">${esc(item.name || item.description)}</span>`;
      if (sub) {
        const subVal = sub(item);
        if (subVal) html += `<span style="font-size:0.78em;color:#9ca3af">${esc(subVal)}</span>`;
      }
      if (item.date) html += `<span style="font-size:0.78em;color:#9ca3af">${esc(item.date)}</span>`;
      html += relevanceBadge(item.relevance);
      html += `</div>`;
    }
    html += `</div></div>`;
  };

  group('אנשים',     entities.persons,       p => p.role);
  group('ארגונים',   entities.organizations, o => o.type);
  group('מיקומים',  entities.locations,     l => l.type);
  group('אירועים',  entities.events,        null);

  return html;
}

function buildStrategicView(view) {
  if (!view || !view.lenses?.length) {
    return '<p style="color:#9ca3af">לא נבחנה ראייה אסטרטגית עבור הערכה זו.</p>';
  }

  const likLabel = { high: 'גבוה', medium: 'בינוני', low: 'נמוך' };
  const likColor = { high: '#fee2e2;color:#b91c1c', medium: '#fef9c3;color:#a16207', low: '#dcfce7;color:#15803d' };
  const accent   = { high: '#fecaca', medium: '#fde68a', low: '#bbf7d0' };

  let html = '';
  if (view.bigPicture) {
    html += `<div style="border:1px solid #dbeafe;background:#eff6ff;border-radius:10px;padding:12px 16px;margin-bottom:16px">`;
    html += `<p style="font-size:0.78em;font-weight:600;color:#1d4ed8;margin-bottom:4px">התמונה הגדולה</p>`;
    html += `<p style="font-size:0.9em;color:#1f2937;line-height:1.6">${esc(view.bigPicture)}</p></div>`;
  }

  for (const lens of view.lenses) {
    const lik = lens.likelihood;
    html += `<div style="border:1px solid ${accent[lik] || '#e5e7eb'};border-radius:10px;overflow:hidden;margin-bottom:14px">`;
    html += `<div style="display:flex;align-items:center;justify-content:space-between;gap:8px;padding:10px 16px">`;
    html += `<span style="font-size:0.95em;font-weight:700;color:#111827">${esc(lens.title || '')}</span>`;
    html += `<span style="font-size:0.75em;font-weight:500;border-radius:6px;padding:2px 8px;background:${likColor[lik] || '#f3f4f6;color:#6b7280'}">סבירות: ${esc(likLabel[lik] || lik || '—')}</span>`;
    html += `</div>`;
    html += `<div style="padding:12px 16px;background:white;border-top:1px solid #f3f4f6">`;

    if (lens.assessment) html += `<p style="font-size:0.9em;color:#1f2937;line-height:1.6;margin-bottom:10px">${esc(lens.assessment)}</p>`;

    if (lens.indicators?.length) {
      html += `<p style="font-size:0.78em;font-weight:600;color:#6b7280;margin-bottom:6px">אינדיקטורים מהמסמך:</p><ul style="margin:0 20px 10px 0;padding:0">`;
      for (const ind of lens.indicators) html += `<li style="font-size:0.8em;color:#4b5563;line-height:1.6">${esc(ind)}</li>`;
      html += `</ul>`;
    }

    if (lens.scenarios?.length) {
      html += `<p style="font-size:0.78em;font-weight:600;color:#6b7280;margin-bottom:6px">תרחישים:</p>`;
      for (const sc of lens.scenarios) {
        const wc = sc.worstCase;
        html += `<div style="border:1px solid ${wc ? '#fca5a5' : '#e5e7eb'};background:${wc ? '#fef2f2' : '#f9fafb'};border-radius:8px;padding:8px 12px;margin-bottom:8px">`;
        html += `<p style="margin-bottom:3px">`;
        if (wc) html += `<span style="font-size:0.72em;font-weight:500;border-radius:6px;padding:1px 7px;background:#fee2e2;color:#b91c1c;margin-left:6px">תרחיש קיצון</span>`;
        if (sc.title) html += `<span style="font-size:0.88em;font-weight:500;color:#111827">${esc(sc.title)}</span>`;
        html += `</p>`;
        if (sc.description) html += `<p style="font-size:0.8em;color:#4b5563;line-height:1.6">${esc(sc.description)}</p>`;
        if (sc.secondOrderEffects?.length) {
          html += `<p style="font-size:0.76em;font-weight:600;color:#6b7280;margin:6px 0 4px">השלכות מסדר שני:</p><ul style="margin:0 20px 4px 0;padding:0">`;
          for (const eff of sc.secondOrderEffects) html += `<li style="font-size:0.78em;color:#4b5563;line-height:1.6">${esc(eff)}</li>`;
          html += `</ul>`;
        }
        if (sc.implication) html += `<p style="font-size:0.8em;color:#4b5563;line-height:1.6;margin-top:5px"><strong style="color:#6b7280">השלכה: </strong>${esc(sc.implication)}</p>`;
        html += `</div>`;
      }
    }

    html += `</div></div>`;
  }

  return html;
}

function buildDocument(documentText) {
  if (!documentText) {
    return `<p style="color:#9ca3af;text-align:center;padding:2em 0">המסמך המקורי לא נשמר עבור הערכה זו.</p>`;
  }
  return `<pre style="white-space:pre-wrap;font-family:'Segoe UI',sans-serif;font-size:0.85em;line-height:1.7;color:#374151;direction:ltr;text-align:left">${esc(documentText)}</pre>`;
}

function buildTransparency(report, telemetry, content, agentOutputs) {
  let html = '';

  html += `<div style="font-size:0.9em;color:#374151;margin-bottom:16px">`;
  html += `<p><strong>סוכנים שהופעלו:</strong> ${esc(report?.agentsActivated?.join(', ') || '—')}</p>`;
  html += `<p style="margin-top:6px"><strong>מיומנויות שהופעלו:</strong> ${esc(report?.skillsActivated?.join(', ') || '—')}</p>`;
  html += `<p style="margin-top:6px"><strong>זמן הפקה:</strong> ${esc(new Date(report?.generatedAt).toLocaleString('he-IL'))}</p>`;
  html += `</div>`;

  const agentEntries = agentOutputs ? Object.values(agentOutputs) : [];
  if (agentEntries.length > 0) {
    html += `<div style="margin-bottom:16px">`;
    html += `<h3 style="font-size:0.9em;font-weight:700;color:#374151;margin-bottom:10px">פלט סוכנים</h3>`;
    for (const agent of agentEntries) {
      html += `<details style="border:1px solid #e5e7eb;border-radius:8px;margin-bottom:8px;overflow:hidden">`;
      html += `<summary style="padding:10px 14px;display:flex;align-items:center;justify-content:space-between;gap:10px;background:#f9fafb;cursor:pointer;list-style:none;user-select:none">`;
      html += `<div style="display:flex;gap:6px;flex-wrap:wrap">`;
      for (const s of (agent.skills || [])) {
        html += `<span style="font-size:0.75em;padding:2px 8px;border-radius:4px;background:#eff6ff;color:${BRAND};font-weight:600">${esc(s)}</span>`;
      }
      if (!agent.skills?.length) {
        html += `<span style="font-size:0.75em;color:#9ca3af">ללא מיומנויות</span>`;
      }
      html += `</div>`;
      html += `<span style="font-size:0.9em;font-weight:600;color:#111827;white-space:nowrap">${esc(agent.agentName)}</span>`;
      html += `</summary>`;
      html += `<div style="border-top:1px solid #f3f4f6;background:white;padding:16px;direction:rtl">`;
      html += `<pre style="white-space:pre-wrap;font-family:'Segoe UI',sans-serif;font-size:0.85em;line-height:1.7;color:#374151">${esc(agent.output || '')}</pre>`;
      if (agent.completedAt) {
        html += `<p style="font-size:0.75em;color:#9ca3af;margin-top:10px">הושלם: ${esc(new Date(agent.completedAt).toLocaleString('he-IL'))}</p>`;
      }
      html += `</div></details>`;
    }
    html += `</div>`;
  }

  if (telemetry) {
    html += `<div style="display:grid;grid-template-columns:repeat(4,1fr);gap:12px;margin-bottom:16px">`;
    for (const [label, value] of [
      ['קריאות LLM',   telemetry.llmCalls],
      ['טוקנים קלט',  fmtTokens(telemetry.inputTokens)],
      ['טוקנים פלט',  fmtTokens(telemetry.outputTokens)],
      ['חיפושי רשת',  telemetry.searchCalls],
    ]) {
      html += `<div style="background:#f9fafb;border:1px solid #e5e7eb;border-radius:8px;padding:12px;text-align:center">`;
      html += `<div style="font-size:1.4em;font-weight:700;color:${BRAND}">${esc(value)}</div>`;
      html += `<div style="font-size:0.75em;color:#6b7280;margin-top:4px">${esc(label)}</div>`;
      html += `</div>`;
    }
    html += `</div>`;
    html += `<p style="font-size:0.78em;color:#9ca3af">סה"כ: ${fmtTokens(telemetry.inputTokens + telemetry.outputTokens)} טוקנים</p>`;
  }

  const transLog = parseSection(content, 'לוג שקיפות');
  if (transLog) {
    html += `<div style="margin-top:16px;padding-top:16px;border-top:1px solid #f3f4f6">`;
    html += mdToHtml(transLog);
    html += `</div>`;
  }

  return html;
}

const LANG_CSS = {
  he: 'background:#dbeafe;color:#1d4ed8',
  en: 'background:#f3f4f6;color:#6b7280',
  ar: 'background:#dcfce7;color:#166534',
};
const LANG_LABEL = { he: 'עב', en: 'EN', ar: 'ER' };

function buildAudit(searchAudit) {
  if (!searchAudit?.length) {
    return '<p style="color:#9ca3af;text-align:center;padding:2em 0">לא נמצאו רשומות חיפוש לתיק זה</p>';
  }

  let html = `<p style="font-size:0.8em;color:#9ca3af;margin-bottom:16px">${searchAudit.length} חיפושי רשת בוצעו במהלך הניתוח</p>`;

  for (let i = 0; i < searchAudit.length; i++) {
    const entry = searchAudit[i];
    const langCss = LANG_CSS[entry.lang] || LANG_CSS.en;
    const langLabel = LANG_LABEL[entry.lang] || entry.lang;
    const time = new Date(entry.ts).toLocaleTimeString('he-IL', { hour: '2-digit', minute: '2-digit', second: '2-digit' });

    html += `<details style="border:1px solid #e5e7eb;border-radius:8px;margin-bottom:8px;overflow:hidden">`;
    html += `<summary style="padding:10px 14px;display:flex;align-items:center;gap:10px;background:white;cursor:pointer;list-style:none;user-select:none">`;
    html += `<span style="padding:2px 8px;border-radius:4px;font-family:monospace;font-size:0.75em;font-weight:700;flex-shrink:0;${langCss}">${esc(langLabel)}</span>`;
    html += `<div style="flex:1;min-width:0;direction:rtl">`;
    html += `<p style="font-size:0.9em;font-weight:500;color:#111827;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${esc(entry.query)}</p>`;
    html += `<div style="display:flex;align-items:center;gap:8px;margin-top:2px;flex-wrap:wrap">`;
    html += `<span style="font-size:0.78em;color:#6b7280">${esc(entry.agent)}</span>`;
    html += `<span style="color:#d1d5db">·</span>`;
    html += `<span style="font-size:0.75em;color:#9ca3af">${esc(time)}</span>`;
    html += `<span style="color:#d1d5db">·</span>`;
    if (entry.error) {
      html += badge('שגיאה', 'background:#fee2e2;color:#dc2626');
    } else {
      const countCss = entry.count > 0 ? 'background:#dcfce7;color:#166534' : 'background:#f3f4f6;color:#6b7280';
      html += badge(`${entry.count} תוצאות`, countCss);
    }
    html += `</div></div>`;
    html += `</summary>`;

    html += `<div style="border-top:1px solid #f3f4f6;background:#f9fafb;padding:12px;direction:rtl">`;
    if (entry.error) {
      html += `<p style="font-size:0.8em;color:#dc2626;font-weight:500">שגיאת חיפוש: ${esc(entry.error)}</p>`;
    } else if (!entry.results?.length) {
      html += `<p style="font-size:0.8em;color:#9ca3af">לא נמצאו תוצאות</p>`;
    } else {
      for (const r of entry.results) {
        const rTier = r.sourceTier != null ? r.sourceTier : urlTier(r.url);
        html += `<div style="background:white;border:1px solid #e5e7eb;border-radius:6px;padding:10px;margin-bottom:8px">`;
        html += `<div style="display:flex;align-items:flex-start;justify-content:space-between;gap:8px;margin-bottom:4px">`;
        html += `<a href="${esc(r.url)}" target="_blank" style="font-size:0.85em;font-weight:500;color:#2563eb;line-height:1.4">${esc(r.title)}</a>`;
        html += tierBadge(rTier);
        html += `</div>`;
        if (r.date) html += `<p style="font-size:0.75em;color:#9ca3af;margin-bottom:2px">${esc(r.date)}</p>`;
        html += `<p style="font-size:0.75em;color:#9ca3af;word-break:break-all;margin-bottom:4px">${esc(r.url)}</p>`;
        if (r.snippet) html += `<p style="font-size:0.8em;color:#6b7280;line-height:1.5">${esc(r.snippet)}</p>`;
        html += `</div>`;
      }
    }
    html += `</div></details>`;
  }

  return html;
}

// ─── Main template ────────────────────────────────────────────────────────────

export function generateHtmlReport(data) {
  const { report, analysis, documentText, searchAudit, telemetry, title, generatedAt, agentOutputs, strategicView } = data;
  const content = report?.content || '';

  const sections = [
    { title: 'תמצית',           html: buildSummary(content) },
    { title: 'טענות',           html: buildClaims(analysis) },
    { title: 'עדויות סותרות',   html: buildMdSection(content, 'עדויות סותרות', 'לא נמצאו עדויות סותרות בדו״ח') },
    { title: 'חלופות',          html: buildMdSection(content, 'חלופות מדורגות', '') || buildMdSection(content, 'חלופות', 'לא נמצאו חלופות בדו״ח') },
    { title: 'המלצות',          html: buildMdSection(content, 'המלצות', 'לא נמצאו המלצות בדו״ח') },
    { title: 'ראייה אסטרטגית',  html: buildStrategicView(strategicView) },
    { title: 'ישויות',          html: buildEntities(analysis?.entities) },
    { title: 'מסמך מקורי',      html: buildDocument(documentText) },
    { title: 'שקיפות',          html: buildTransparency(report, telemetry, content, agentOutputs) },
    { title: 'ביקורת חיפוש',    html: buildAudit(searchAudit) },
  ];

  const agentsBar = (report?.agentsActivated?.length > 0)
    ? `<div style="background:#eff6ff;border:1px solid #dbeafe;border-radius:8px;padding:10px 16px;margin-bottom:16px;font-size:0.85em;color:#1d4ed8">
         <strong>סוכנים שפעלו:</strong> ${esc(report.agentsActivated.join(' | '))}
         ${report.skillsActivated?.length > 0 ? ` &nbsp;·&nbsp; <strong>מיומנויות:</strong> ${esc(report.skillsActivated.join(', '))}` : ''}
       </div>`
    : '';

  const sectionsHtml = sections.map(({ title: t, html: h }) => `
    <details open style="background:white;border:1px solid #e5e7eb;border-radius:12px;margin-bottom:16px;overflow:hidden">
      <summary style="padding:16px 20px;font-weight:600;font-size:1em;cursor:pointer;display:flex;align-items:center;justify-content:space-between;list-style:none;user-select:none;color:#111827">
        <span>${esc(t)}</span>
        <span style="font-size:0.75em;color:#9ca3af;transition:transform 0.2s" class="arr">▼</span>
      </summary>
      <div style="padding:20px;border-top:1px solid #f3f4f6;font-size:0.9em;line-height:1.6;color:#1f2937;direction:rtl">
        ${h}
      </div>
    </details>
  `).join('');

  return `<!DOCTYPE html>
<html dir="rtl" lang="he">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>דו"ח AVAR: ${esc(title)}</title>
<style>
  * { box-sizing: border-box; margin: 0; padding: 0; }
  body { font-family: 'Segoe UI', Tahoma, Arial, sans-serif; background: #f9fafb; color: #1f2937; line-height: 1.6; }
  .container { max-width: 940px; margin: 0 auto; padding: 28px 16px 48px; }
  details summary::-webkit-details-marker { display: none; }
  details[open] summary .arr { transform: rotate(180deg); }
  details summary:hover { background: #f9fafb !important; }
  a { color: #2563eb; text-decoration: none; }
  a:hover { text-decoration: underline; }
  @media print {
    body { background: white; }
    .no-print { display: none !important; }
    details { break-inside: avoid; }
  }
</style>
</head>
<body>
<div class="container">

  <!-- Header -->
  <div style="background:${BRAND};color:white;border-radius:12px;padding:24px 28px;margin-bottom:24px">
    <div style="font-size:0.75em;opacity:0.6;margin-bottom:6px;letter-spacing:0.05em">AVAR — מערכת אימות הערכות מודיעיניות</div>
    <h1 style="font-size:1.4em;font-weight:700;margin-bottom:8px">${esc(title)}</h1>
    <div style="font-size:0.82em;opacity:0.75">נוצר: ${esc(new Date(generatedAt).toLocaleString('he-IL'))}</div>
  </div>

  <!-- Controls -->
  <div class="no-print" style="display:flex;gap:10px;margin-bottom:16px">
    <button onclick="document.querySelectorAll('details').forEach(d=>d.open=true)"
      style="background:${BRAND};color:white;border:none;border-radius:8px;padding:7px 16px;font-size:0.85em;cursor:pointer">
      פרוס הכל
    </button>
    <button onclick="document.querySelectorAll('details').forEach(d=>d.open=false)"
      style="background:white;color:#374151;border:1px solid #d1d5db;border-radius:8px;padding:7px 16px;font-size:0.85em;cursor:pointer">
      קפל הכל
    </button>
    <button onclick="window.print()"
      style="background:white;color:#374151;border:1px solid #d1d5db;border-radius:8px;padding:7px 16px;font-size:0.85em;cursor:pointer">
      הדפסה / PDF
    </button>
  </div>

  ${agentsBar}
  ${sectionsHtml}

</div>
</body>
</html>`;
}
