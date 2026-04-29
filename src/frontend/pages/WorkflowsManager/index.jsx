import { useEffect, useState } from 'react';
import { api } from '../../services/client.js';
import WorkflowCreator from '../../components/WorkflowCreator/index.jsx';

export default function WorkflowsManager() {
  const [workflows, setWorkflows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [editor, setEditor] = useState(null); // null | { mode, workflowId, initialForm }

  const load = () => {
    setLoading(true);
    api.workflows.list().then(setWorkflows).finally(() => setLoading(false));
  };

  useEffect(() => { load(); }, []);

  const openEdit = (w) => setEditor({
    mode: 'edit',
    workflowId: w.id,
    initialForm: {
      name: w.name,
      description: w.description || '',
      autoActivateKeywords: (w.autoActivateKeywords || []).join(', '),
      agents: w.agents || [],
      synthesisFocus: w.synthesisFocus || '',
    },
  });

  const handleDelete = async (id) => {
    if (!confirm('למחוק את ה-Workflow?')) return;
    await api.workflows.remove(id).catch(() => {});
    load();
  };

  const defaults = workflows.filter(w => w.isDefault);
  const custom = workflows.filter(w => !w.isDefault);

  if (loading) return <div className="card text-center py-8 text-gray-400">טוען...</div>;

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">ניהול Workflows</h1>
          <p className="text-gray-500 text-sm mt-1">תצורות ניתוח שמורות — הפעל במהירות מ"הערכה חדשה"</p>
        </div>
        {!editor && (
          <button onClick={() => setEditor({ mode: 'create', workflowId: null, initialForm: null })}
            className="btn-primary">+ Workflow חדש</button>
        )}
      </div>

      {editor && (
        <WorkflowCreator
          mode={editor.mode}
          workflowId={editor.workflowId}
          initialForm={editor.initialForm}
          onSaved={() => { setEditor(null); load(); }}
          onCancel={() => setEditor(null)}
        />
      )}

      <div className="mt-6">
        <WorkflowSection title="Workflows מובנים" workflows={defaults} />
        <WorkflowSection title="Workflows מותאמים" workflows={custom}
          onEdit={openEdit} onDelete={handleDelete}
          empty="אין Workflows מותאמים — צור את הראשון" />
      </div>
    </div>
  );
}

function WorkflowSection({ title, workflows, onEdit, onDelete, empty }) {
  if (workflows.length === 0 && empty)
    return (
      <div className="mb-8">
        <h2 className="text-sm font-semibold text-gray-500 uppercase tracking-wide mb-4">{title}</h2>
        <p className="text-gray-400 text-sm">{empty}</p>
      </div>
    );

  return (
    <div className="mb-8">
      <h2 className="text-sm font-semibold text-gray-500 uppercase tracking-wide mb-4">{title}</h2>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {workflows.map(w => (
          <div key={w.id} className="card flex flex-col gap-3">
            <div className="flex items-start justify-between gap-2">
              <div>
                <p className="font-semibold text-gray-800">{w.name}</p>
                {w.description && <p className="text-sm text-gray-500 mt-0.5">{w.description}</p>}
              </div>
              {w.isDefault
                ? <span className="badge bg-gray-100 text-gray-500 shrink-0">מובנה</span>
                : <span className="badge bg-brand/10 text-brand shrink-0">מותאם</span>
              }
            </div>

            {w.agents?.length > 0 && (
              <div className="flex flex-wrap gap-1">
                {w.agents.map(a => (
                  <span key={a} className="badge bg-indigo-50 text-indigo-600 text-xs">{a.replace('agent-', '')}</span>
                ))}
              </div>
            )}

            {w.autoActivateKeywords?.length > 0 && (
              <p className="text-xs text-gray-400">
                מפתחות: {w.autoActivateKeywords.join(', ')}
              </p>
            )}

            {!w.isDefault && (
              <div className="flex gap-2 pt-2 border-t border-gray-100">
                <button onClick={() => onEdit(w)} className="text-xs text-brand hover:underline font-medium">ערוך</button>
                <button onClick={() => onDelete(w.id)} className="text-xs text-red-500 hover:underline font-medium">מחק</button>
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
