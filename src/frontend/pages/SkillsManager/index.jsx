import { useEffect, useState } from 'react';
import { api } from '../../services/client.js';
import SkillCreator, { skillToForm } from '../../components/SkillCreator/index.jsx';

export default function SkillsManager() {
  const [skills, setSkills] = useState([]);
  const [loading, setLoading] = useState(true);
  const [editor, setEditor] = useState(null); // null | { mode, skillId, initialForm }

  const load = () => {
    setLoading(true);
    api.skills.list().then(setSkills).finally(() => setLoading(false));
  };

  useEffect(() => { load(); }, []);

  const openCreate = () => setEditor({ mode: 'create', skillId: null, initialForm: null });

  const openEdit = async (skill) => {
    const full = await api.skills.get(skill.id);
    const initialForm = skillToForm(full);
    const mode = skill.isCustom ? 'edit' : 'fork';
    setEditor({ mode, skillId: skill.id, initialForm });
  };

  const handleCreated = () => {
    setEditor(null);
    load();
  };

  const defaults = skills.filter(s => !s.isCustom);
  const custom = skills.filter(s => s.isCustom);

  if (loading) return <div className="card text-center py-8 text-gray-400">טוען...</div>;

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold text-gray-900">ניהול מיומנויות</h1>
        {!editor && (
          <button onClick={openCreate} className="btn-primary">+ מיומנות חדשה</button>
        )}
      </div>

      {editor && (
        <SkillCreator
          mode={editor.mode}
          skillId={editor.skillId}
          initialForm={editor.initialForm}
          onCreated={handleCreated}
          onCancel={() => setEditor(null)}
        />
      )}

      <div className="mt-6">
        <Section title="מיומנויות ברירת מחדל" skills={defaults} onEdit={openEdit} />
        <Section title="מיומנויות מותאמות" skills={custom} onEdit={openEdit}
          empty="אין מיומנויות מותאמות עדיין — צור מיומנות ראשונה" />
      </div>
    </div>
  );
}

function Section({ title, skills, onEdit, empty }) {
  return (
    <div className="mb-8">
      <h2 className="text-sm font-semibold text-gray-500 uppercase tracking-wide mb-4">{title}</h2>
      {skills.length === 0
        ? <p className="text-gray-400 text-sm">{empty || 'אין פריטים'}</p>
        : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {skills.map(s => (
              <div key={s.id} className="card hover:shadow-md transition-shadow flex flex-col">
                <div className="flex-1">
                  <p className="font-semibold text-gray-800">{s.name}</p>
                  <p className="text-xs text-gray-400 mt-1">{s.nameEn}</p>
                  <div className="flex flex-wrap gap-1 mt-3">
                    {(s.tags || []).slice(0, 4).map(tag => (
                      <span key={tag} className="badge bg-gray-100 text-gray-600">{tag}</span>
                    ))}
                  </div>
                </div>
                <div className="flex items-center justify-between mt-4 pt-3 border-t border-gray-100">
                  {s.isCustom
                    ? <span className="badge bg-brand/10 text-brand">מותאם אישית</span>
                    : <span className="badge bg-gray-100 text-gray-500">ברירת מחדל</span>
                  }
                  <button
                    onClick={() => onEdit(s)}
                    className="text-xs text-brand hover:underline font-medium"
                  >
                    {s.isCustom ? 'ערוך' : 'ערוך עותק'}
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
