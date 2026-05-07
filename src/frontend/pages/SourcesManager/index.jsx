import { useEffect, useState } from 'react';
import { api } from '../../services/client.js';
import SourceCreator, { sourceToForm } from '../../components/SourceCreator/index.jsx';

const AUTH_LABEL = { none: 'ללא', basic: 'משתמש + סיסמה', apikey: 'מפתח API' };
const AUTH_COLOR = {
  none:   'bg-gray-100 text-gray-500',
  basic:  'bg-blue-100 text-blue-700',
  apikey: 'bg-purple-100 text-purple-700',
};
const METHOD_COLOR = { GET: 'bg-green-100 text-green-700', POST: 'bg-orange-100 text-orange-700' };

function SourceCard({ source, onEdit, onDelete }) {
  const authLabel = AUTH_LABEL[source.auth?.type] || AUTH_LABEL.none;
  const authColor = AUTH_COLOR[source.auth?.type] || AUTH_COLOR.none;
  const methodColor = METHOD_COLOR[source.method] || METHOD_COLOR.GET;

  return (
    <div className="bg-white border border-gray-200 rounded-xl p-4 hover:shadow-md transition-shadow">
      <div className="flex items-start justify-between gap-2 mb-2">
        <div className="flex-1 min-w-0">
          <h3 className="font-semibold text-gray-900 truncate">{source.name}</h3>
          {source.description && (
            <p className="text-xs text-gray-500 mt-0.5 line-clamp-2">{source.description}</p>
          )}
        </div>
        <div className="flex gap-1.5 shrink-0">
          <button onClick={() => onEdit(source)}
            className="text-xs px-2.5 py-1 border border-gray-200 rounded-lg text-gray-600 hover:border-brand hover:text-brand transition-colors">
            ערוך
          </button>
          <button onClick={() => onDelete(source)}
            className="text-xs px-2.5 py-1 border border-red-200 rounded-lg text-red-500 hover:bg-red-50 transition-colors">
            מחק
          </button>
        </div>
      </div>

      <div className="flex flex-wrap gap-1.5 mt-3">
        <span className={`text-xs px-2 py-0.5 rounded font-medium ${authColor}`}>{authLabel}</span>
        <span className={`text-xs px-2 py-0.5 rounded font-mono font-medium ${methodColor}`}>{source.method || 'GET'}</span>
      </div>

      <p className="text-xs text-gray-400 font-mono mt-2 truncate" dir="ltr">{source.url}</p>
    </div>
  );
}

export default function SourcesManager() {
  const [sources, setSources] = useState([]);
  const [loading, setLoading] = useState(true);
  const [editor,  setEditor]  = useState(null); // null | { mode, sourceId, initialForm }
  const [error,   setError]   = useState('');

  const load = () => {
    setLoading(true);
    api.sources.list()
      .then(setSources)
      .catch(e => setError(e.message))
      .finally(() => setLoading(false));
  };

  useEffect(load, []);

  const openCreate = () => setEditor({ mode: 'create', sourceId: null, initialForm: null });

  const openEdit = (source) => {
    setEditor({ mode: 'edit', sourceId: source.id, initialForm: sourceToForm(source) });
  };

  const handleDelete = async (source) => {
    if (!window.confirm(`למחוק את המקור "${source.name}"?`)) return;
    try {
      await api.sources.remove(source.id);
      load();
    } catch (e) {
      setError(e.message);
    }
  };

  const handleSaved = () => {
    setEditor(null);
    load();
  };

  if (loading) return (
    <div className="card text-center py-12 text-gray-400">טוען מקורות...</div>
  );

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">מקורות נתונים חיצוניים</h1>
          <p className="text-gray-400 text-sm mt-1">
            ממשקי API לחיפוש מידע מודיעיני — מופעלים דרך מיומנויות
          </p>
        </div>
        {!editor && (
          <button onClick={openCreate} className="btn-primary text-sm">+ מקור חדש</button>
        )}
      </div>

      {error && (
        <div className="bg-red-50 border border-red-200 rounded-lg px-4 py-3 text-sm text-red-600 mb-4">
          {error}
        </div>
      )}

      {editor && (
        <SourceCreator
          mode={editor.mode}
          sourceId={editor.sourceId}
          initialForm={editor.initialForm}
          onSaved={handleSaved}
          onCancel={() => setEditor(null)}
        />
      )}

      {!editor && (
        <>
          {sources.length === 0 ? (
            <div className="card text-center py-12">
              <p className="text-gray-400 text-sm mb-4">לא הוגדרו מקורות נתונים עדיין</p>
              <button onClick={openCreate} className="btn-primary text-sm">+ צור מקור ראשון</button>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {sources.map(s => (
                <SourceCard key={s.id} source={s} onEdit={openEdit} onDelete={handleDelete} />
              ))}
            </div>
          )}
        </>
      )}
    </div>
  );
}
