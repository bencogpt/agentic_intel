import { useEffect, useState } from 'react';
import { api } from '../../services/client.js';
import AgentCreator, { agentToForm } from '../../components/AgentCreator/index.jsx';

const PRIORITY_LABELS = { 1: 'קריטי', 2: 'גבוה', 3: 'בינוני', 4: 'נמוך', 5: 'רקע' };
const PRIORITY_COLORS = {
  1: 'bg-red-100 text-red-700',
  2: 'bg-orange-100 text-orange-700',
  3: 'bg-blue-100 text-blue-700',
  4: 'bg-gray-100 text-gray-600',
  5: 'bg-gray-100 text-gray-500',
};

export default function AgentsManager() {
  const [agents, setAgents] = useState([]);
  const [loading, setLoading] = useState(true);
  const [editor, setEditor] = useState(null); // null | { mode, agentId, initialForm }

  const load = () => {
    setLoading(true);
    api.agents.list().then(setAgents).finally(() => setLoading(false));
  };

  useEffect(() => { load(); }, []);

  const openCreate = () => setEditor({ mode: 'create', agentId: null, initialForm: null });

  const openEdit = async (agent) => {
    const full = await api.agents.get(agent.id);
    const initialForm = agentToForm(full);
    setEditor({ mode: agent.isCustom ? 'edit' : 'fork', agentId: agent.id, initialForm });
  };

  const handleCreated = () => {
    setEditor(null);
    load();
  };

  const defaults = agents.filter(a => !a.isCustom);
  const custom = agents.filter(a => a.isCustom);

  if (loading) return <div className="card text-center py-8 text-gray-400">טוען...</div>;

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold text-gray-900">ניהול סוכנים</h1>
        {!editor && (
          <button onClick={openCreate} className="btn-primary">+ סוכן חדש</button>
        )}
      </div>

      {editor && (
        <AgentCreator
          mode={editor.mode}
          agentId={editor.agentId}
          initialForm={editor.initialForm}
          onCreated={handleCreated}
          onCancel={() => setEditor(null)}
        />
      )}

      <div className="mt-6">
        <AgentSection title="סוכנים מובנים" agents={defaults} onEdit={openEdit} />
        <AgentSection title="סוכנים מותאמים" agents={custom} onEdit={openEdit}
          empty="אין סוכנים מותאמים עדיין — צור סוכן ראשון" />
      </div>
    </div>
  );
}

function AgentSection({ title, agents, onEdit, empty }) {
  return (
    <div className="mb-8">
      <h2 className="text-sm font-semibold text-gray-500 uppercase tracking-wide mb-4">{title}</h2>
      {agents.length === 0
        ? <p className="text-gray-400 text-sm">{empty || 'אין פריטים'}</p>
        : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {agents.map(agent => (
              <div key={agent.id} className="card hover:shadow-md transition-shadow flex flex-col">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="font-semibold text-gray-800">{agent.name}</p>
                    <p className="text-sm text-gray-500 mt-0.5 truncate">{agent.role}</p>
                  </div>
                  <span className={`badge shrink-0 ${PRIORITY_COLORS[agent.priority] || PRIORITY_COLORS[3]}`}>
                    {PRIORITY_LABELS[agent.priority] || agent.priority}
                  </span>
                </div>

                {agent.skills?.length > 0 && (
                  <div className="mt-3">
                    <p className="text-xs text-gray-400 mb-1">מיומנויות:</p>
                    <div className="flex flex-wrap gap-1">
                      {agent.skills.map(s => (
                        <span key={s} className="badge bg-indigo-50 text-indigo-600">{s}</span>
                      ))}
                    </div>
                  </div>
                )}

                <div className="flex items-center justify-between mt-4 pt-3 border-t border-gray-100">
                  {agent.isCustom
                    ? <span className="badge bg-brand/10 text-brand">מותאם אישית</span>
                    : <span className="badge bg-gray-100 text-gray-500">מובנה</span>
                  }
                  <button onClick={() => onEdit(agent)}
                    className="text-xs text-brand hover:underline font-medium">
                    {agent.isCustom ? 'ערוך' : 'ערוך עותק'}
                  </button>
                </div>
              </div>
            ))}
          </div>
        )
      }
    </div>
  );
}
