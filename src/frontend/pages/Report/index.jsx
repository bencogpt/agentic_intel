import { useEffect, useRef, useState } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { api } from '../../services/client.js';
import { generateHtmlReport } from '../../utils/exportHtml.js';

const TABS = ['תמצית', 'טענות', 'עדויות סותרות', 'חלופות', 'המלצות', 'ישויות', 'מסמך מקורי', 'שקיפות', 'ביקורת'];

function fmtTokens(n) {
  if (!n) return '0';
  return n >= 1000 ? `${Math.round(n / 1000)}K` : String(n);
}

// ─── Section parser ────────────────────────────────────────────────────────────

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

// ─── Citation-aware content renderer ─────────────────────────────────────────

const TIER1 = ['reuters.com','apnews.com','bbc.com','bbc.co.uk','un.org','nytimes.com',
  'theguardian.com','haaretz.com','timesofisrael.com','jpost.com','aljazeera.com','washingtonpost.com'];
const TIER3 = ['twitter.com','x.com','facebook.com','reddit.com','tiktok.com'];

function urlTier(url = '') {
  const d = url.toLowerCase();
  if (TIER1.some(t => d.includes(t))) return 1;
  if (TIER3.some(t => d.includes(t))) return 3;
  return 2;
}

const TIER_STYLE = {
  1: 'bg-green-100 text-green-700',
  2: 'bg-gray-100 text-gray-500',
  3: 'bg-red-100 text-red-600',
};

function InlineContent({ text }) {
  const parts = [];
  const pattern = /(\*\*[^*]+\*\*|\[[^\]]+\]\(https?:\/\/[^)]+\)|https?:\/\/\S+)/g;
  let last = 0;
  let m;
  while ((m = pattern.exec(text)) !== null) {
    if (m.index > last) parts.push(<span key={last}>{text.slice(last, m.index)}</span>);
    const chunk = m[0];
    if (chunk.startsWith('**')) {
      parts.push(<strong key={m.index}>{chunk.slice(2, -2)}</strong>);
    } else if (chunk.startsWith('[')) {
      const lm = chunk.match(/\[([^\]]+)\]\((https?:\/\/[^)]+)\)/);
      if (lm) {
        const tier = urlTier(lm[2]);
        parts.push(
          <span key={m.index} className="inline-flex items-center gap-1 flex-wrap">
            <a href={lm[2]} target="_blank" rel="noopener noreferrer"
               className="text-blue-600 hover:underline">{lm[1]}</a>
            <span className={`text-xs px-1.5 py-0.5 rounded font-medium ${TIER_STYLE[tier]}`}>T{tier}</span>
          </span>
        );
      }
    } else {
      const tier = urlTier(chunk);
      parts.push(
        <span key={m.index} className="inline-flex items-center gap-1 flex-wrap">
          <a href={chunk} target="_blank" rel="noopener noreferrer"
             className="text-blue-600 hover:underline text-xs break-all">{chunk}</a>
          <span className={`text-xs px-1.5 py-0.5 rounded font-medium ${TIER_STYLE[tier]}`}>T{tier}</span>
        </span>
      );
    }
    last = m.index + chunk.length;
  }
  if (last < text.length) parts.push(<span key={last}>{text.slice(last)}</span>);
  return parts;
}

function RenderContent({ text }) {
  if (!text) return null;
  const lines = text.split('\n');
  return (
    <div className="space-y-1 text-sm leading-relaxed">
      {lines.map((line, i) => {
        if (line.startsWith('### '))
          return <h3 key={i} className="font-bold text-gray-800 mt-4 mb-1">{line.slice(4)}</h3>;
        if (line.startsWith('## '))
          return <h2 key={i} className="font-bold text-gray-900 text-base mt-5 mb-2">{line.slice(3)}</h2>;
        if (line.trim() === '---')
          return <hr key={i} className="my-4 border-gray-200" />;
        if (!line.trim())
          return <div key={i} className="h-2" />;
        if (line.startsWith('- ') || line.startsWith('* '))
          return (
            <div key={i} className="flex gap-2 text-gray-800">
              <span className="text-gray-400 shrink-0 mt-0.5">•</span>
              <span><InlineContent text={line.slice(2)} /></span>
            </div>
          );
        if (/^\d+\.\s/.test(line)) {
          const num = line.match(/^(\d+)\./)[1];
          return (
            <div key={i} className="flex gap-2 text-gray-800">
              <span className="text-gray-500 shrink-0 font-mono">{num}.</span>
              <span><InlineContent text={line.replace(/^\d+\.\s/, '')} /></span>
            </div>
          );
        }
        return <p key={i} className="text-gray-800"><InlineContent text={line} /></p>;
      })}
    </div>
  );
}

// ─── Chat panel ───────────────────────────────────────────────────────────────

function ChatPanel({ sessionId }) {
  const [open, setOpen] = useState(false);
  const [history, setHistory] = useState([]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [searches, setSearches] = useState([]);
  const bottomRef = useRef(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [history, searches]);

  const send = async () => {
    const msg = input.trim();
    if (!msg || loading) return;
    setInput('');
    setLoading(true);
    setSearches([]);
    setHistory(h => [...h, { role: 'user', content: msg }]);

    try {
      const response = await fetch(`/api/chat/${sessionId}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message: msg, history }),
      });

      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let buffer = '';
      let assistantText = '';

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });
        const parts = buffer.split('\n\n');
        buffer = parts.pop();
        for (const part of parts) {
          const line = part.trim();
          if (!line.startsWith('data: ')) continue;
          try {
            const ev = JSON.parse(line.slice(6));
            if (ev.type === 'search') {
              setSearches(s => [...s, `חיפוש [${ev.lang || 'en'}]: "${ev.query}"`]);
            }
            if (ev.type === 'response') {
              assistantText = ev.text;
            }
            if (ev.type === 'done') {
              setHistory(h => [...h, { role: 'assistant', content: assistantText }]);
              setSearches([]);
            }
            if (ev.type === 'error') {
              setHistory(h => [...h, { role: 'assistant', content: `שגיאה: ${ev.message}` }]);
              setSearches([]);
            }
          } catch (_) {}
        }
      }
    } catch (err) {
      setHistory(h => [...h, { role: 'assistant', content: `שגיאה: ${err.message}` }]);
    } finally {
      setLoading(false);
      setSearches([]);
    }
  };

  return (
    <div className="mt-4">
      <button
        onClick={() => setOpen(o => !o)}
        className="w-full flex items-center justify-between px-4 py-3 bg-white border border-gray-200
                   rounded-xl shadow-sm text-sm font-medium text-gray-700 hover:border-brand transition-colors"
      >
        <span>שיחה עם הדו"ח</span>
        <span className="text-gray-400">{open ? '▲' : '▼'}</span>
      </button>

      {open && (
        <div className="bg-white border border-gray-200 rounded-xl shadow-sm mt-1 flex flex-col" style={{ height: '420px' }}>
          {/* Messages */}
          <div className="flex-1 overflow-y-auto p-4 space-y-3">
            {history.length === 0 && (
              <p className="text-gray-400 text-sm text-center pt-8">
                שאל שאלת המשך על הדו"ח — אבחן טענות, בקש הסברים, חפש עדויות נוספות
              </p>
            )}
            {history.map((m, i) => (
              <div key={i} className={`flex ${m.role === 'user' ? 'justify-start' : 'justify-end'}`}>
                <div className={`max-w-[85%] rounded-xl px-4 py-2.5 text-sm ${
                  m.role === 'user'
                    ? 'bg-brand text-white rounded-tr-sm'
                    : 'bg-gray-50 border border-gray-200 text-gray-800 rounded-tl-sm'
                }`}>
                  {m.role === 'assistant'
                    ? <RenderContent text={m.content} />
                    : m.content
                  }
                </div>
              </div>
            ))}
            {loading && (
              <div className="flex justify-end">
                <div className="bg-gray-50 border border-gray-200 rounded-xl rounded-tl-sm px-4 py-2.5 text-sm text-gray-500 space-y-1 max-w-[85%]">
                  {searches.map((s, i) => (
                    <p key={i} className="text-blue-600 text-xs">{s}</p>
                  ))}
                  {searches.length === 0 && <span className="animate-pulse">מעבד...</span>}
                </div>
              </div>
            )}
            <div ref={bottomRef} />
          </div>

          {/* Input */}
          <div className="border-t border-gray-100 p-3 flex gap-2">
            <input
              className="input flex-1"
              value={input}
              onChange={e => setInput(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && !e.shiftKey && send()}
              placeholder={'שאל שאלה על הדו"ח...'}
              disabled={loading}
            />
            <button onClick={send} disabled={loading || !input.trim()} className="btn-primary text-sm px-4">
              שלח
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Main Report page ─────────────────────────────────────────────────────────

export default function Report() {
  const { sessionId } = useParams();
  const navigate = useNavigate();
  const [data, setData] = useState(null);
  const [tab, setTab] = useState(0);
  const [error, setError] = useState('');

  useEffect(() => {
    api.report.get(sessionId)
      .then(setData)
      .catch(e => setError(e.message));
  }, [sessionId]);

  const exportHtml = () => {
    const html = generateHtmlReport(data);
    const blob = new Blob([html], { type: 'text/html;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `avar-report-${sessionId}.html`;
    a.click();
    URL.revokeObjectURL(url);
  };

  if (error) return (
    <div className="card text-center"><p className="text-red-600">{error}</p></div>
  );
  if (!data) return (
    <div className="card text-center py-12 text-gray-400">
      <div className="animate-spin text-4xl mb-4">⚙️</div><p>טוען דו"ח...</p>
    </div>
  );

  const { report, analysis } = data;
  const content = report?.content || '';
  const sec = heading => parseSection(content, heading);

  return (
    <div>
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">{data.title}</h1>
          <p className="text-gray-400 text-sm mt-1">
            נוצר: {new Date(data.generatedAt).toLocaleString('he-IL')}
          </p>
        </div>
        <div className="flex gap-2">
          <button onClick={exportHtml} className="btn-secondary text-sm">ייצוא HTML</button>
          <button onClick={() => navigate('/')} className="btn-secondary text-sm">חזור</button>
        </div>
      </div>

      {/* Transparency bar */}
      {report?.agentsActivated?.length > 0 && (
        <div className="bg-blue-50 border border-blue-100 rounded-lg px-4 py-3 mb-6 text-sm text-blue-700">
          <strong>סוכנים שפעלו:</strong> {report.agentsActivated.join(' | ')}
          {report.skillsActivated?.length > 0 && (
            <> &nbsp;·&nbsp; <strong>מיומנויות:</strong> {report.skillsActivated.join(', ')}</>
          )}
        </div>
      )}

      {/* Suggestions banner */}
      {data.suggestions && (
        (data.suggestions.missingAgents?.length > 0 || data.suggestions.missingSkills?.length > 0)
      ) && (
        <div className="border border-amber-200 bg-amber-50 rounded-xl px-4 py-3 mb-6">
          <p className="text-sm font-semibold text-amber-800 mb-2">
            הניתוח זיהה רכיבים חסרים — הוספתם תשפר את הדיוק בהערכות עתידיות:
          </p>
          <div className="flex flex-wrap gap-2">
            {data.suggestions.missingAgents?.map(a => (
              <Link key={a.id} to="/agents"
                className="inline-flex items-center gap-1.5 bg-white border border-amber-300 text-amber-800 text-xs px-3 py-1.5 rounded-lg hover:bg-amber-100 transition-colors">
                <span>סוכן חסר:</span>
                <span className="font-semibold">{a.name}</span>
                <span className="text-amber-500 font-medium">← צור</span>
              </Link>
            ))}
            {data.suggestions.missingSkills?.map(s => (
              <Link key={s.id} to="/skills"
                className="inline-flex items-center gap-1.5 bg-white border border-amber-300 text-amber-800 text-xs px-3 py-1.5 rounded-lg hover:bg-amber-100 transition-colors">
                <span>מיומנות חסרה:</span>
                <span className="font-semibold">{s.id.replace(/^skill-/, '').replace(/-/g, ' ')}</span>
                <span className="text-xs text-amber-600">(נדרש ע"י {s.requiredBy})</span>
                <span className="text-amber-500 font-medium">← צור</span>
              </Link>
            ))}
          </div>
        </div>
      )}

      {/* Tabs */}
      <div className="flex gap-1 border-b border-gray-200 mb-6 overflow-x-auto">
        {TABS.map((t, i) => (
          <button key={t} onClick={() => setTab(i)}
            className={`px-4 py-2 text-sm font-medium border-b-2 whitespace-nowrap transition-colors ${
              tab === i ? 'border-brand text-brand' : 'border-transparent text-gray-500 hover:text-gray-700'
            }`}>
            {t}
          </button>
        ))}
      </div>

      {/* Content card */}
      <div className="card">
        <div className="overflow-y-auto max-h-[65vh] pr-1">
          {tab === 0 && (
            <div className="text-sm leading-relaxed text-gray-800">
              <RenderContent text={parsePreamble(content)} />
              {sec('תמצית מנהלים') && (
                <>
                  <h2 className="text-base font-bold text-gray-900 mt-5 mb-2">תמצית מנהלים</h2>
                  <RenderContent text={sec('תמצית מנהלים')} />
                </>
              )}
              {!content && 'אין תוכן'}
            </div>
          )}

          {tab === 1 && (
            <div>
              <h3 className="font-semibold text-gray-700 mb-4">טענות מרכזיות שזוהו</h3>
              {analysis?.keyClaims?.length > 0 ? (
                <ul className="space-y-4">
                  {analysis.keyClaims.map((c, i) => (
                    <li key={c.id || i} className="border border-gray-200 rounded-xl overflow-hidden">
                      {/* Claim text */}
                      <div className="px-4 py-3 bg-white">
                        <p className="text-sm font-medium text-gray-900 leading-relaxed">{c.text}</p>
                      </div>

                      {/* Confidence row */}
                      <div className={`px-4 py-3 border-t ${
                        c.confidence === 'high' ? 'bg-green-50 border-green-100' :
                        c.confidence === 'medium' ? 'bg-yellow-50 border-yellow-100' :
                        'bg-red-50 border-red-100'
                      }`}>
                        <div className="flex items-center gap-2 mb-1.5">
                          <span className={`badge text-xs ${
                            c.confidence === 'high' ? 'bg-green-100 text-green-700' :
                            c.confidence === 'medium' ? 'bg-yellow-100 text-yellow-700' :
                            'bg-red-100 text-red-700'
                          }`}>
                            ביטחון: {c.confidence === 'high' ? 'גבוה' : c.confidence === 'medium' ? 'בינוני' : 'נמוך'}
                          </span>
                          {c.sourceCount > 0 && (
                            <span className="text-xs text-gray-500">{c.sourceCount} מקורות</span>
                          )}
                        </div>
                        {c.confidenceReasoning && (
                          <p className="text-xs text-gray-700 leading-relaxed">{c.confidenceReasoning}</p>
                        )}
                      </div>

                      {/* Risk row */}
                      {(c.riskIfWrong || c.riskReasoning) && (
                        <div className={`px-4 py-3 border-t ${
                          c.riskIfWrong === 'high' ? 'bg-red-50 border-red-100' :
                          c.riskIfWrong === 'medium' ? 'bg-orange-50 border-orange-100' :
                          'bg-gray-50 border-gray-100'
                        }`}>
                          <div className="flex items-center gap-2 mb-1.5">
                            <span className={`badge text-xs ${
                              c.riskIfWrong === 'high' ? 'bg-red-100 text-red-700' :
                              c.riskIfWrong === 'medium' ? 'bg-orange-100 text-orange-700' :
                              'bg-gray-100 text-gray-600'
                            }`}>
                              סיכון אם שגוי: {c.riskIfWrong === 'high' ? 'גבוה' : c.riskIfWrong === 'medium' ? 'בינוני' : 'נמוך'}
                            </span>
                          </div>
                          {c.riskReasoning && (
                            <p className="text-xs text-gray-700 leading-relaxed">{c.riskReasoning}</p>
                          )}
                        </div>
                      )}

                      {/* Sources row */}
                      {c.sourceRefs?.length > 0 && (
                        <div className="px-4 py-3 border-t border-gray-100 bg-gray-50">
                          <p className="text-xs font-semibold text-gray-500 mb-1.5">מקורות ועדויות:</p>
                          <ul className="space-y-1">
                            {c.sourceRefs.map((src, si) => (
                              <li key={si} className="text-xs text-gray-600 flex gap-1.5">
                                <span className="text-gray-400 shrink-0 mt-0.5">›</span>
                                <span><InlineContent text={src} /></span>
                              </li>
                            ))}
                          </ul>
                        </div>
                      )}
                    </li>
                  ))}
                </ul>
              ) : <p className="text-gray-400 text-sm">לא זוהו טענות</p>}

              {analysis?.assumptions?.length > 0 && (
                <>
                  <h3 className="font-semibold text-gray-700 mt-8 mb-4">הנחות שזוהו</h3>
                  <ul className="space-y-3">
                    {analysis.assumptions.map((a, i) => (
                      <li key={i} className="border border-amber-100 rounded-xl overflow-hidden">
                        <div className="px-4 py-3 bg-amber-50">
                          <div className="flex items-center gap-2 mb-1.5">
                            <span className="badge bg-amber-100 text-amber-700 text-xs">
                              {a.type === 'implicit' ? 'סמויה' : 'מפורשת'}
                            </span>
                            <span className={`badge text-xs ${
                              a.riskIfWrong === 'high' ? 'bg-red-100 text-red-700' :
                              a.riskIfWrong === 'medium' ? 'bg-orange-100 text-orange-700' :
                              'bg-gray-100 text-gray-600'
                            }`}>
                              סיכון: {a.riskIfWrong === 'high' ? 'גבוה' : a.riskIfWrong === 'medium' ? 'בינוני' : 'נמוך'}
                            </span>
                          </div>
                          <p className="text-sm text-gray-800">{a.text}</p>
                        </div>
                        {a.riskReasoning && (
                          <div className="px-4 py-3 border-t border-amber-100 bg-white">
                            <p className="text-xs font-semibold text-gray-500 mb-1">מה יקרה אם ההנחה שגויה:</p>
                            <p className="text-xs text-gray-700 leading-relaxed">{a.riskReasoning}</p>
                          </div>
                        )}
                      </li>
                    ))}
                  </ul>
                </>
              )}
            </div>
          )}

          {tab === 2 && <SectionTab content={sec('עדויות סותרות')} empty="לא נמצאו עדויות סותרות בדו״ח" />}
          {tab === 3 && <SectionTab content={sec('חלופות מדורגות') || sec('חלופות')} empty="לא נמצאו חלופות מדורגות בדו״ח" />}
          {tab === 4 && <SectionTab content={sec('המלצות')} empty="לא נמצאו המלצות בדו״ח" />}

          {tab === 5 && <EntitiesTab entities={analysis?.entities} />}

          {tab === 6 && (
            <div>
              {data.documentText ? (
                <pre className="whitespace-pre-wrap text-sm text-gray-700 leading-relaxed font-sans">
                  {data.documentText}
                </pre>
              ) : (
                <p className="text-gray-400 text-sm text-center py-8">
                  המסמך המקורי לא נשמר עבור הערכה זו.
                  <br />
                  <span className="text-xs">הערכות חדשות ישמרו את המסמך אוטומטית.</span>
                </p>
              )}
            </div>
          )}

          {tab === 8 && <AuditTab audit={data.searchAudit} />}

          {tab === 7 && (
            <div className="text-sm text-gray-700 space-y-2">
              <p><strong>סוכנים שהופעלו:</strong> {report?.agentsActivated?.join(', ') || '—'}</p>
              <p><strong>מיומנויות שהופעלו:</strong> {report?.skillsActivated?.join(', ') || '—'}</p>
              <p><strong>זמן הפקה:</strong> {new Date(report?.generatedAt).toLocaleString('he-IL')}</p>

              {data.agentOutputs && Object.keys(data.agentOutputs).length > 0 && (
                <div className="mt-4 pt-4 border-t border-gray-100">
                  <h3 className="font-semibold text-gray-700 mb-3">פלט סוכנים</h3>
                  <AgentOutputsPanel outputs={data.agentOutputs} />
                </div>
              )}

              {data.telemetry && (
                <div className="mt-4 pt-4 border-t border-gray-100">
                  <h3 className="font-semibold text-gray-700 mb-3">טלמטריה</h3>
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                    {[
                      { label: 'קריאות LLM', value: data.telemetry.llmCalls },
                      { label: 'טוקנים קלט', value: fmtTokens(data.telemetry.inputTokens) },
                      { label: 'טוקנים פלט', value: fmtTokens(data.telemetry.outputTokens) },
                      { label: 'חיפושי רשת', value: data.telemetry.searchCalls },
                    ].map(({ label, value }) => (
                      <div key={label} className="bg-gray-50 border border-gray-200 rounded-lg p-3 text-center">
                        <p className="text-2xl font-bold text-brand">{value}</p>
                        <p className="text-xs text-gray-500 mt-1">{label}</p>
                      </div>
                    ))}
                  </div>
                  <p className="text-xs text-gray-400 mt-3">
                    סה"כ: {fmtTokens(data.telemetry.inputTokens + data.telemetry.outputTokens)} טוקנים
                    {' · '}
                    קלט: {fmtTokens(data.telemetry.inputTokens)} / פלט: {fmtTokens(data.telemetry.outputTokens)}
                  </p>
                </div>
              )}

              {sec('לוג שקיפות') && (
                <div className="mt-4 pt-4 border-t border-gray-100">
                  <RenderContent text={sec('לוג שקיפות')} />
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Chat panel */}
      <ChatPanel sessionId={sessionId} />
    </div>
  );
}

function AgentOutputsPanel({ outputs }) {
  const [expanded, setExpanded] = useState({});
  const toggle = id => setExpanded(prev => ({ ...prev, [id]: !prev[id] }));
  const entries = Object.values(outputs);

  return (
    <div className="space-y-3">
      {entries.map(agent => (
        <div key={agent.agentId} className="border border-gray-200 rounded-lg overflow-hidden">
          <button
            onClick={() => toggle(agent.agentId)}
            className="w-full flex items-center justify-between px-4 py-3 bg-gray-50 hover:bg-gray-100 transition-colors text-right"
          >
            <div className="flex items-center gap-2 flex-wrap">
              {(agent.skills || []).map(s => (
                <span key={s} className="text-xs px-2 py-0.5 rounded bg-brand/10 text-brand font-medium">{s}</span>
              ))}
              {(!agent.skills || agent.skills.length === 0) && (
                <span className="text-xs text-gray-400">ללא מיומנויות</span>
              )}
            </div>
            <div className="flex items-center gap-3">
              <span className="font-semibold text-gray-800 text-sm">{agent.agentName}</span>
              <svg className={`w-4 h-4 text-gray-400 transition-transform ${expanded[agent.agentId] ? 'rotate-180' : ''}`} fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" /></svg>
            </div>
          </button>
          {expanded[agent.agentId] && (
            <div className="px-4 py-3 bg-white border-t border-gray-100">
              <pre className="whitespace-pre-wrap text-sm text-gray-700 leading-relaxed font-sans">
                {agent.output}
              </pre>
              {agent.completedAt && (
                <p className="text-xs text-gray-400 mt-3">
                  הושלם: {new Date(agent.completedAt).toLocaleString('he-IL')}
                </p>
              )}
            </div>
          )}
        </div>
      ))}
    </div>
  );
}

const LANG_LABELS = { he: 'עב', en: 'EN', ar: 'ER' };
const LANG_COLORS  = {
  he: 'bg-blue-100 text-blue-700',
  en: 'bg-gray-100 text-gray-600',
  ar: 'bg-green-100 text-green-700',
};

function AuditTab({ audit }) {
  const [expanded, setExpanded] = useState({});
  const toggle = i => setExpanded(prev => ({ ...prev, [i]: !prev[i] }));

  if (!audit?.length) return (
    <p className="text-gray-400 text-sm text-center py-8">לא נמצאו רשומות חיפוש לתיק זה</p>
  );

  return (
    <div>
      <p className="text-xs text-gray-400 mb-4">{audit.length} חיפושי רשת בוצעו במהלך הניתוח</p>
      <div className="space-y-2">
        {audit.map((entry, i) => (
          <div key={i} className="border border-gray-200 rounded-lg overflow-hidden">
            <button
              onClick={() => toggle(i)}
              className="w-full flex items-start gap-3 px-4 py-3 bg-white hover:bg-gray-50 transition-colors text-left"
            >
              <span className={`shrink-0 text-xs px-2 py-0.5 rounded font-mono font-medium mt-0.5 ${LANG_COLORS[entry.lang] || LANG_COLORS.en}`}>
                {LANG_LABELS[entry.lang] || entry.lang}
              </span>
              <div className="flex-1 min-w-0" dir="rtl">
                <p className="text-sm font-medium text-gray-900 truncate">{entry.query}</p>
                <div className="flex items-center gap-2 mt-0.5 flex-wrap">
                  <span className="text-xs text-gray-500">{entry.agent}</span>
                  <span className="text-gray-300">·</span>
                  <span className="text-xs text-gray-400">
                    {new Date(entry.ts).toLocaleTimeString('he-IL', { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
                  </span>
                  <span className="text-gray-300">·</span>
                  {entry.error ? (
                    <span className="text-xs text-red-600 font-medium">שגיאה</span>
                  ) : (
                    <span className={`text-xs px-1.5 py-0.5 rounded font-medium ${
                      entry.count > 0 ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-500'
                    }`}>
                      {entry.count} תוצאות
                    </span>
                  )}
                </div>
              </div>
              <span className="text-gray-300 shrink-0 text-xs mt-1">{expanded[i] ? '▲' : '▼'}</span>
            </button>

            {expanded[i] && (
              <div className="border-t border-gray-100 bg-gray-50 px-4 py-3 space-y-3" dir="rtl">
                {entry.error && (
                  <p className="text-xs text-red-600 font-medium">שגיאת חיפוש: {entry.error}</p>
                )}
                {entry.results?.length === 0 && !entry.error && (
                  <p className="text-xs text-gray-400">לא נמצאו תוצאות</p>
                )}
                {entry.results?.map((r, ri) => (
                  <div key={ri} className="bg-white border border-gray-200 rounded-lg p-3">
                    <div className="flex items-start justify-between gap-2 mb-1">
                      <a href={r.url} target="_blank" rel="noopener noreferrer"
                         className="text-sm font-medium text-blue-600 hover:underline leading-tight">
                        {r.title}
                      </a>
                      {r.sourceTier != null && (
                        <span className={`shrink-0 text-xs px-1.5 py-0.5 rounded font-medium ${TIER_STYLE[r.sourceTier] || TIER_STYLE[2]}`}>
                          T{r.sourceTier}
                        </span>
                      )}
                    </div>
                    {r.date && <p className="text-xs text-gray-400 mb-1">{r.date}</p>}
                    <p className="text-xs text-gray-500 break-all mb-1">{r.url}</p>
                    {r.snippet && <p className="text-xs text-gray-600 leading-relaxed">{r.snippet}</p>}
                  </div>
                ))}
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}

function SectionTab({ content, empty }) {
  if (!content) return <p className="text-gray-400 text-sm text-center py-8">{empty}</p>;
  return <RenderContent text={content} />;
}

const RELEVANCE_STYLE = {
  high:   'bg-red-100 text-red-700',
  medium: 'bg-yellow-100 text-yellow-700',
  low:    'bg-gray-100 text-gray-600',
};
const RELEVANCE_LABEL = { high: 'גבוה', medium: 'בינוני', low: 'נמוך' };

function EntityGroup({ title, items, renderSub }) {
  if (!items?.length) return null;
  return (
    <div className="mb-6">
      <h3 className="text-sm font-semibold text-gray-600 mb-3 pb-1 border-b border-gray-100">{title}</h3>
      <div className="flex flex-wrap gap-2">
        {items.map((item, i) => (
          <div key={i} className="flex items-center gap-1.5 bg-gray-50 border border-gray-200 rounded-lg px-3 py-1.5">
            <span className="text-sm font-medium text-gray-800">{item.name || item.description}</span>
            {renderSub && <span className="text-xs text-gray-400">{renderSub(item)}</span>}
            {item.date && <span className="text-xs text-gray-400">{item.date}</span>}
            <span className={`text-xs px-1.5 py-0.5 rounded font-medium ${RELEVANCE_STYLE[item.relevance] || RELEVANCE_STYLE.low}`}>
              {RELEVANCE_LABEL[item.relevance] || item.relevance}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}

function EntitiesTab({ entities }) {
  if (!entities) return (
    <p className="text-gray-400 text-sm text-center py-8">
      ישויות לא חולצו מהערכה זו.
      <br /><span className="text-xs">הערכות חדשות יחלצו ישויות אוטומטית.</span>
    </p>
  );

  const total = (entities.persons?.length || 0) + (entities.organizations?.length || 0) +
    (entities.locations?.length || 0) + (entities.events?.length || 0);

  if (total === 0) return <p className="text-gray-400 text-sm text-center py-8">לא זוהו ישויות</p>;

  return (
    <div>
      <EntityGroup title="אנשים" items={entities.persons} renderSub={p => p.role} />
      <EntityGroup title="ארגונים" items={entities.organizations} renderSub={o => o.type} />
      <EntityGroup title="מיקומים" items={entities.locations} renderSub={l => l.type} />
      <EntityGroup title="אירועים" items={entities.events} />
    </div>
  );
}
