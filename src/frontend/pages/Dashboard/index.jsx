import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { api } from '../../services/client.js';

function fmtTokens(n) {
  if (!n) return '0';
  return n >= 1000 ? `${Math.round(n / 1000)}K` : String(n);
}

const STATUS_LABELS = {
  pending: 'ממתין', analyzing: 'מנתח', dispatching: 'שולח לסוכנים',
  researching: 'חוקר', synthesizing: 'מסנתז', complete: 'הושלם', error: 'שגיאה',
};
const STATUS_COLORS = {
  pending: 'bg-gray-100 text-gray-600',
  analyzing: 'bg-blue-100 text-blue-700',
  dispatching: 'bg-indigo-100 text-indigo-700',
  researching: 'bg-purple-100 text-purple-700',
  synthesizing: 'bg-yellow-100 text-yellow-700',
  complete: 'bg-green-100 text-green-700',
  error: 'bg-red-100 text-red-700',
};

export default function Dashboard() {
  const navigate = useNavigate();
  const [sessions, setSessions] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api.sessions.list()
      .then(setSessions)
      .catch(() => setSessions([]))
      .finally(() => setLoading(false));
  }, []);

  return (
    <div>
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">לוח בקרה</h1>
          <p className="text-gray-500 mt-1">מערכת אימות הערכות מודיעיניות</p>
        </div>
        <button onClick={() => navigate('/new')} className="btn-primary">
          + הערכה חדשה
        </button>
      </div>

      {loading && (
        <div className="card text-center py-12 text-gray-400">
          <div className="animate-spin text-3xl mb-3">⚙️</div>
          <p>טוען היסטוריה...</p>
        </div>
      )}

      {!loading && sessions.length === 0 && (
        <div className="card text-center py-16 text-gray-400">
          <div className="text-5xl mb-4">📋</div>
          <p className="text-lg font-medium">אין הערכות עדיין</p>
          <p className="text-sm mt-2">התחל על ידי לחיצה על "הערכה חדשה"</p>
          <button onClick={() => navigate('/new')} className="btn-primary mt-6">
            צור הערכה ראשונה
          </button>
        </div>
      )}

      {!loading && sessions.length > 0 && (
        <div className="space-y-3">
          {sessions.map(s => (
            <div
              key={s.id}
              onClick={() => s.status === 'complete' ? navigate(`/report/${s.id}`) : s.status !== 'error' ? navigate(`/processing/${s.id}`) : null}
              className={`card flex items-center justify-between gap-4 transition-colors ${
                s.status === 'complete' ? 'cursor-pointer hover:border-brand hover:shadow-md' :
                s.status === 'error' ? 'opacity-60' : 'cursor-pointer hover:border-brand'
              }`}
            >
              <div className="flex-1 min-w-0">
                <p className="font-medium text-gray-900 truncate">{s.title || 'הערכה ללא שם'}</p>
                <p className="text-xs text-gray-400 mt-1">
                  {new Date(s.createdAt).toLocaleString('he-IL')}
                  {s.wordCount ? ` · ${s.wordCount} מילים` : ''}
                  {s.agentsActivated?.length ? ` · ${s.agentsActivated.length} סוכנים` : ''}
                  {s.telemetry && (
                    <>
                      {` · ${s.telemetry.llmCalls} קריאות`}
                      {` · ${fmtTokens(s.telemetry.inputTokens + s.telemetry.outputTokens)} טוקנים`}
                      {s.telemetry.searchCalls > 0 ? ` · ${s.telemetry.searchCalls} חיפושים` : ''}
                    </>
                  )}
                </p>
              </div>
              <span className={`badge whitespace-nowrap ${STATUS_COLORS[s.status] || 'bg-gray-100 text-gray-600'}`}>
                {STATUS_LABELS[s.status] || s.status}
              </span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
