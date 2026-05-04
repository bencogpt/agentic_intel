import { useEffect, useRef, useState, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { api } from '../../services/client.js';

const STEPS = ['ANALYZE', 'DISPATCH', 'RESEARCH', 'SYNTHESIZE'];
const STEP_LABELS = {
  ANALYZE: 'מנתח מסמך',
  DISPATCH: 'מפעיל סוכנים',
  RESEARCH: 'חוקר עדויות',
  SYNTHESIZE: 'מסנתז דו"ח',
};
const AGENT_STATUS_COLORS = {
  waiting:  'bg-gray-200 text-gray-500',
  active:   'bg-blue-100 text-blue-700 animate-pulse',
  complete: 'bg-green-100 text-green-700',
};

function eventLabel(ev) {
  switch (ev.type) {
    case 'step':           return `[${ev.step}] ${ev.message}`;
    case 'search':         return `חיפוש [${ev.lang || 'en'}]: "${ev.query}"${ev.agent ? ` (${ev.agent})` : ''}`;
    case 'search_results': return `נמצאו ${ev.count} תוצאות עבור "${ev.query}"`;
    case 'search_error':   return `שגיאת חיפוש: ${ev.error}`;
    case 'dispatch':       return ev.message;
    case 'agent_start':    return `סוכן מתחיל: ${ev.agentName}`;
    case 'agent_complete': return `סוכן הושלם: ${ev.agentName}`;
    case 'analysis_done':  return ev.message;
    case 'missing_agents': return `סוכנים לא נמצאו: ${ev.agents?.map(a => a.name).join(', ')}`;
    case 'suggestions':    return ev.message;
    case 'warning':        return `אזהרה: ${ev.message}`;
    case 'complete':       return `הניתוח הושלם`;
    case 'error':          return `שגיאה: ${ev.message}`;
    default:               return ev.message || JSON.stringify(ev);
  }
}

function eventColor(ev) {
  switch (ev.type) {
    case 'search':          return 'text-blue-600';
    case 'search_results':  return 'text-green-600';
    case 'search_error':    return 'text-orange-500';
    case 'agent_start':     return 'text-indigo-600';
    case 'agent_complete':  return 'text-green-700';
    case 'error':           return 'text-red-600';
    case 'warning':         return 'text-amber-600';
    case 'missing_agents':  return 'text-amber-600';
    case 'suggestions':     return 'text-amber-600 font-semibold';
    case 'complete':        return 'text-green-700 font-semibold';
    default:                return 'text-gray-700';
  }
}

const POLL_INTERVAL = 2500; // ms

export default function Processing() {
  const { sessionId } = useParams();
  const navigate      = useNavigate();

  const [events, setEvents]           = useState([]);
  const [currentStep, setCurrentStep] = useState('');
  const [activeAgents, setActiveAgents] = useState([]);
  const [suggestions, setSuggestions] = useState(null);
  const [error, setError]             = useState('');
  const notesEndRef = useRef(null);
  const seenCount   = useRef(0); // how many events we've already displayed
  const timerRef    = useRef(null);

  const handleNewEvents = useCallback((newEvs, status, step, agents, err) => {
    if (newEvs.length > 0) {
      setEvents(prev => [...prev, ...newEvs]);

      // Process each new event for side-effects
      for (const ev of newEvs) {
        if (ev.type === 'step')     setCurrentStep(ev.step);
        if (ev.type === 'suggestions') {
          setSuggestions({ missingAgents: ev.missingAgents || [], missingSkills: ev.missingSkills || [] });
        }
        if (ev.type === 'agent_start') {
          setActiveAgents(prev => {
            if (prev.find(a => a.id === ev.agentId)) {
              return prev.map(a => a.id === ev.agentId ? { ...a, status: 'active' } : a);
            }
            return [...prev, { id: ev.agentId, name: ev.agentName, status: 'active' }];
          });
        }
        if (ev.type === 'agent_complete') {
          setActiveAgents(prev => prev.map(a => a.id === ev.agentId ? { ...a, status: 'complete' } : a));
        }
      }
    }

    if (step) setCurrentStep(step);
    if (agents?.length) setActiveAgents(prev => {
      // merge in active agents from status (covers cold-start reconnect)
      const merged = [...prev];
      for (const a of agents) {
        if (!merged.find(x => x.id === a.id)) merged.push(a);
      }
      return merged;
    });

    if (status === 'complete') {
      clearInterval(timerRef.current);
      navigate(`/report/${sessionId}`);
    }
    if (status === 'error') {
      clearInterval(timerRef.current);
      setError(err || 'שגיאה בניתוח');
    }
  }, [sessionId, navigate]);

  useEffect(() => {
    let cancelled = false;

    async function poll() {
      if (cancelled) return;
      try {
        const data = await api.analyze.status(sessionId, seenCount.current);
        if (cancelled) return;
        const newEvs = data.events || [];
        seenCount.current += newEvs.length;
        handleNewEvents(newEvs, data.status, data.currentStep, data.activeAgents, data.error);
      } catch (e) {
        // network blip — keep polling silently
        console.warn('[Processing] poll error:', e.message);
      }
    }

    // first poll immediately, then every POLL_INTERVAL
    poll();
    timerRef.current = setInterval(poll, POLL_INTERVAL);

    return () => {
      cancelled = true;
      clearInterval(timerRef.current);
    };
  }, [sessionId, handleNewEvents]);

  // Auto-scroll
  useEffect(() => {
    notesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [events]);

  const stepIndex = currentStep ? STEPS.indexOf(currentStep) : -1;

  if (error) return (
    <div className="max-w-2xl mx-auto card text-center">
      <div className="text-4xl mb-4">⚠️</div>
      <p className="text-red-600 font-medium">{error}</p>
      <button onClick={() => navigate('/new')} className="btn-secondary mt-4">חזור</button>
    </div>
  );

  return (
    <div className="max-w-2xl mx-auto">
      <h1 className="text-2xl font-bold text-gray-900 mb-2">מעבד הערכה</h1>
      <p className="text-gray-400 text-sm mb-6">Session: {sessionId}</p>

      {/* Step progress */}
      <div className="card mb-4">
        <h3 className="text-xs font-semibold text-gray-500 mb-3 uppercase tracking-wide">שלב נוכחי</h3>
        <div className="flex gap-2">
          {STEPS.map((step, i) => {
            const state = i < stepIndex ? 'done' : i === stepIndex ? 'active' : 'pending';
            return (
              <div key={step} className="flex-1">
                <div className={`h-2 rounded-full mb-2 transition-all ${
                  state === 'done'   ? 'bg-green-500' :
                  state === 'active' ? 'bg-brand animate-pulse' : 'bg-gray-200'
                }`} />
                <p className={`text-xs text-center ${state === 'active' ? 'text-brand font-semibold' : 'text-gray-400'}`}>
                  {STEP_LABELS[step]}
                </p>
              </div>
            );
          })}
        </div>
      </div>

      {/* Active agents */}
      {activeAgents.length > 0 && (
        <div className="card mb-4">
          <h3 className="text-xs font-semibold text-gray-500 mb-3 uppercase tracking-wide">סוכנים</h3>
          <div className="flex flex-wrap gap-2">
            {activeAgents.map(agent => (
              <span key={agent.id} className={`badge ${AGENT_STATUS_COLORS[agent.status] || AGENT_STATUS_COLORS.waiting}`}>
                {agent.name}
              </span>
            ))}
          </div>
        </div>
      )}

      {/* Suggestions panel */}
      {suggestions && (suggestions.missingAgents.length > 0 || suggestions.missingSkills.length > 0) && (
        <div className="border border-amber-200 bg-amber-50 rounded-xl p-4 mb-4">
          <p className="text-sm font-semibold text-amber-800 mb-3">
            זוהו פערים — הניתוח הושלם ללא הרכיבים הבאים:
          </p>
          {suggestions.missingAgents.length > 0 && (
            <div className="mb-3">
              <p className="text-xs font-semibold text-amber-700 mb-2">סוכנים חסרים:</p>
              <div className="flex flex-wrap gap-2">
                {suggestions.missingAgents.map(a => (
                  <button key={a.id} onClick={() => navigate('/agents')}
                    className="flex items-center gap-1.5 bg-white border border-amber-300 text-amber-800 text-xs px-3 py-1.5 rounded-lg hover:bg-amber-100 transition-colors">
                    <span className="font-medium">{a.name}</span>
                    <span className="text-amber-500">+ צור</span>
                  </button>
                ))}
              </div>
            </div>
          )}
          {suggestions.missingSkills.length > 0 && (
            <div>
              <p className="text-xs font-semibold text-amber-700 mb-2">מיומנויות חסרות:</p>
              <div className="flex flex-wrap gap-2">
                {suggestions.missingSkills.map(s => (
                  <button key={s.id} onClick={() => navigate('/skills')}
                    className="flex items-center gap-1.5 bg-white border border-amber-300 text-amber-800 text-xs px-3 py-1.5 rounded-lg hover:bg-amber-100 transition-colors">
                    <span className="font-medium">{s.id.replace(/^skill-/, '').replace(/-/g, ' ')}</span>
                    <span className="text-xs text-amber-500">נדרש ע"י {s.requiredBy}</span>
                    <span className="text-amber-500">+ צור</span>
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* Live event log */}
      <div className="card">
        <h3 className="text-xs font-semibold text-gray-500 mb-3 uppercase tracking-wide">יומן פעילות</h3>
        <div className="h-72 overflow-y-auto space-y-1.5 font-mono text-xs" dir="rtl">
          {events.length === 0 && (
            <p className="text-gray-300 text-center pt-8">ממתין לאירועים...</p>
          )}
          {events.map((ev, i) => (
            <div key={i} className={`flex gap-2 ${eventColor(ev)}`}>
              <span className="text-gray-300 shrink-0">
                {new Date(ev.ts).toLocaleTimeString('he-IL', { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
              </span>
              <span>{eventLabel(ev)}</span>
            </div>
          ))}
          <div ref={notesEndRef} />
        </div>
      </div>
    </div>
  );
}
