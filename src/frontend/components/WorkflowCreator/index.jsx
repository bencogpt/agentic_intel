import { useEffect, useState } from 'react';
import { api } from '../../services/client.js';

const STEPS = [
  { id: 1, label: 'פרטים' },
  { id: 2, label: 'סוכנים' },
  { id: 3, label: 'מיקוד סינתזה' },
];

const EMPTY_FORM = {
  name: '',
  description: '',
  autoActivateKeywords: '',
  agents: [],
  synthesisFocus: '',
};

function slugify(name) {
  return 'workflow-' + name.toLowerCase()
    .replace(/[^a-z0-9\s]/g, '').trim().replace(/\s+/g, '-');
}

function Field({ label, hint, required, children }) {
  return (
    <div>
      <label className="block text-sm font-medium text-gray-700 mb-1">
        {required && <span className="text-red-500 ml-1">*</span>}
        {label}
      </label>
      {children}
      {hint && <p className="text-xs text-gray-400 mt-1">{hint}</p>}
    </div>
  );
}

function Step1({ form, set }) {
  return (
    <div className="space-y-4">
      <Field label="שם ה-Workflow" required>
        <input className="input w-full" value={form.name}
          onChange={e => set('name', e.target.value)}
          placeholder="הערכת הפסקת אש" />
      </Field>
      <Field label="תיאור" hint="מתי משתמשים ב-Workflow הזה?">
        <textarea className="input w-full resize-none h-20" value={form.description}
          onChange={e => set('description', e.target.value)}
          placeholder="לניתוח אירועי הפסקת אש, הסכמים ומשא ומתן בין גורמים..." />
      </Field>
      <Field label="מילות מפתח להצעה אוטומטית (מופרדות בפסיק)"
        hint="כאשר מסמך מכיל אחת מהמילים, ה-Workflow יוצע אוטומטית">
        <input className="input w-full" value={form.autoActivateKeywords}
          onChange={e => set('autoActivateKeywords', e.target.value)}
          placeholder="הפסקת אש, ceasefire, הסכם, הפוגה" />
      </Field>
    </div>
  );
}

function Step2({ form, set }) {
  const [allAgents, setAllAgents] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api.agents.list().then(setAllAgents).finally(() => setLoading(false));
  }, []);

  const toggle = (id) =>
    set('agents', form.agents.includes(id)
      ? form.agents.filter(a => a !== id)
      : [...form.agents, id]);

  if (loading) return <p className="text-gray-400 text-sm">טוען סוכנים...</p>;

  return (
    <div className="space-y-3">
      <p className="text-sm text-gray-500">
        בחר את הסוכנים שיופעלו כברירת מחדל עם ה-Workflow הזה. ניתן לשנות בעת הפעלה.
      </p>
      <div className="grid grid-cols-2 gap-2 max-h-72 overflow-y-auto">
        {allAgents.map(a => (
          <label key={a.id}
            className={`flex items-start gap-2.5 p-3 rounded-lg border cursor-pointer transition-colors ${
              form.agents.includes(a.id) ? 'border-brand bg-brand/5' : 'border-gray-200 hover:border-gray-300'
            }`}>
            <input type="checkbox" className="mt-0.5 accent-brand"
              checked={form.agents.includes(a.id)} onChange={() => toggle(a.id)} />
            <div className="min-w-0">
              <p className="text-sm font-medium text-gray-800 truncate">{a.name}</p>
              <p className="text-xs text-gray-400 truncate">{a.role}</p>
            </div>
          </label>
        ))}
      </div>
      {form.agents.length > 0 && (
        <p className="text-xs text-brand">{form.agents.length} סוכנים נבחרו</p>
      )}
    </div>
  );
}

function Step3({ form, set }) {
  return (
    <div className="space-y-4">
      <p className="text-sm text-gray-500">
        הוסף הנחיה ממוקדת לשלב הסינתזה — מה הדו"ח צריך להדגיש, אילו היבטים לבחון לעומק.
        השאר ריק אם אין צורך במיקוד מיוחד.
      </p>
      <Field label="מיקוד סינתזה" hint="אופציונלי — נשלח לשלב הסינתזה כהנחיה נוספת">
        <textarea className="input w-full resize-none h-40 text-sm leading-relaxed"
          value={form.synthesisFocus}
          onChange={e => set('synthesisFocus', e.target.value)}
          placeholder="התמקד במדדי יציבות ההסכם: טיב מנגנוני האכיפה, מידת האמון בין הצדדים, גורמי כישלון היסטוריים, ואינדיקטורים להחלפת אש עתידית" />
      </Field>
    </div>
  );
}

function Preview({ form, mode }) {
  const id = slugify(form.name || 'workflow');
  const keywords = form.autoActivateKeywords.split(',').map(k => k.trim()).filter(Boolean);
  return (
    <div className="space-y-4">
      <div className="bg-gray-50 border border-gray-200 rounded-lg p-4 space-y-2 text-sm">
        <p><strong>שם:</strong> {form.name || '—'}</p>
        <p><strong>תיאור:</strong> {form.description || '—'}</p>
        <p><strong>סוכנים:</strong> {form.agents.length ? form.agents.join(', ') : 'לא נבחרו (אוטומטי)'}</p>
        <p><strong>מילות מפתח:</strong> {keywords.length ? keywords.join(', ') : '—'}</p>
        {form.synthesisFocus && (
          <p><strong>מיקוד סינתזה:</strong> {form.synthesisFocus.slice(0, 120)}{form.synthesisFocus.length > 120 ? '...' : ''}</p>
        )}
        <p className="text-xs text-gray-400 pt-1" dir="ltr">id: {id}</p>
      </div>
    </div>
  );
}

export default function WorkflowCreator({ mode = 'create', workflowId, initialForm, onSaved, onCancel }) {
  const [step, setStep] = useState(1);
  const [form, setForm] = useState(initialForm || EMPTY_FORM);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const set = (key, value) => setForm(f => ({ ...f, [key]: value }));
  const isPreview = step === 4;

  const canNext = () => step === 1 ? form.name.trim() : true;

  const save = async () => {
    setSaving(true);
    setError('');
    try {
      const keywords = form.autoActivateKeywords.split(',').map(k => k.trim()).filter(Boolean);
      const payload = {
        id: mode === 'edit' ? workflowId : slugify(form.name),
        name: form.name,
        description: form.description,
        agents: form.agents,
        autoActivateKeywords: keywords,
        synthesisFocus: form.synthesisFocus,
      };
      if (mode === 'edit') {
        await api.workflows.update(workflowId, payload);
      } else {
        await api.workflows.create(payload);
      }
      onSaved?.();
    } catch (e) {
      setError(e.message);
      setSaving(false);
    }
  };

  const title = mode === 'edit' ? 'עריכת Workflow' : 'יצירת Workflow חדש';
  const saveLabel = mode === 'edit' ? 'שמור שינויים' : 'שמור Workflow';

  return (
    <div className="bg-white border border-gray-200 rounded-xl shadow-lg p-6 mt-4">
      <div className="flex items-center justify-between mb-5">
        <h2 className="text-lg font-bold text-gray-900">{title}</h2>
        <button onClick={onCancel} className="text-gray-400 hover:text-gray-600 text-2xl leading-none">×</button>
      </div>

      {/* Progress */}
      <div className="flex gap-1.5 mb-5">
        {[...STEPS, { id: 4, label: 'תצוגה מקדימה' }].map(s => (
          <div key={s.id} className="flex-1">
            <div className={`h-1.5 rounded-full transition-colors ${
              step > s.id ? 'bg-green-500' : step === s.id ? 'bg-brand' : 'bg-gray-200'
            }`} />
            <p className={`text-xs mt-1 text-center hidden sm:block ${
              step === s.id ? 'text-brand font-semibold' : 'text-gray-400'
            }`}>{s.label}</p>
          </div>
        ))}
      </div>

      <h3 className="text-sm font-semibold text-gray-600 mb-4">
        {isPreview ? 'שלב 4: תצוגה מקדימה' : `שלב ${step}: ${STEPS[step - 1]?.label}`}
      </h3>

      <div className="min-h-[260px]">
        {step === 1 && <Step1 form={form} set={set} />}
        {step === 2 && <Step2 form={form} set={set} />}
        {step === 3 && <Step3 form={form} set={set} />}
        {isPreview && <Preview form={form} mode={mode} />}
      </div>

      {error && <p className="text-sm text-red-500 mt-3">{error}</p>}

      <div className="flex justify-between mt-6 pt-4 border-t border-gray-100">
        <button onClick={() => setStep(s => s - 1)} disabled={step === 1}
          className="btn-secondary disabled:opacity-40 disabled:cursor-not-allowed">
          הקודם
        </button>
        {!isPreview ? (
          <button onClick={() => setStep(s => s + 1)} disabled={!canNext()}
            className="btn-primary disabled:opacity-40 disabled:cursor-not-allowed">
            {step === 3 ? 'תצוגה מקדימה' : 'הבא'}
          </button>
        ) : (
          <button onClick={save} disabled={saving} className="btn-primary">
            {saving ? 'שומר...' : saveLabel}
          </button>
        )}
      </div>
    </div>
  );
}
