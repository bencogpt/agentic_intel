import { useEffect, useState } from 'react';
import { api } from '../../services/client.js';

// ─── Steps ────────────────────────────────────────────────────────────────────

const STEPS = [
  { id: 1, label: 'פרטים בסיסיים' },
  { id: 2, label: 'תיאור ומשימה' },
  { id: 3, label: 'מיומנויות' },
  { id: 4, label: 'הפעלה ופלט' },
];

const EMPTY_FORM = {
  name: '',
  role: '',
  priority: 3,
  description: '',
  instructions: '',
  questions: '',
  outputFormat: '',
  skills: [],
  keywords: '',
};

const PRIORITY_LABELS = {
  1: 'קריטי — תמיד מופעל ראשון',
  2: 'גבוה',
  3: 'בינוני',
  4: 'נמוך',
  5: 'רקע — משלים בלבד',
};

// ─── Body parsers ─────────────────────────────────────────────────────────────

function parseBodySection(body, headingSubstr) {
  const lines = (body || '').split('\n');
  let inSection = false;
  const out = [];
  for (const line of lines) {
    if (line.startsWith('## ')) {
      if (inSection) break;
      if (line.includes(headingSubstr)) { inSection = true; continue; }
    }
    if (inSection) out.push(line);
  }
  return out.join('\n').trim();
}

export function agentToForm(agent) {
  const body = agent.body || '';
  return {
    name: agent.name || '',
    role: agent.role || '',
    priority: agent.priority || 3,
    description: parseBodySection(body, 'תיאור הסוכן'),
    instructions: parseBodySection(body, 'הנחיות פרומפט'),
    questions: parseBodySection(body, 'שאלות ייחודיות'),
    outputFormat: parseBodySection(body, 'פורמט תוצר'),
    skills: agent.skills || [],
    keywords: (agent.auto_activate_on || []).join(', '),
  };
}

// ─── Markdown generator ───────────────────────────────────────────────────────

function generateMarkdown(form) {
  const today = new Date().toISOString().split('T')[0];
  const keywords = form.keywords.split(',').map(k => k.trim()).filter(Boolean);
  const skillLines = form.skills.length
    ? form.skills.map(s => `  - ${s}`).join('\n')
    : '';

  return `---
name: ${form.name}
role: ${form.role}
version: 1.0
author: custom
created: ${today}
last_modified: ${today}
skills:
${skillLines || '[]'}
auto_activate_on: [${keywords.join(', ')}]
priority: ${form.priority}
---

## תיאור הסוכן
${form.description}

## הנחיות פרומפט (Prompt Instructions)
${form.instructions}

## שאלות ייחודיות לסוכן
${form.questions}

## פורמט תוצר (Output Format)
${form.outputFormat}
`.trimEnd() + '\n';
}

function slugify(name) {
  return 'agent-' + name.toLowerCase()
    .replace(/[^a-z0-9\s]/g, '')
    .trim()
    .replace(/\s+/g, '-');
}

// ─── Field wrapper ────────────────────────────────────────────────────────────

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

// ─── Step components ──────────────────────────────────────────────────────────

function Step1({ form, set, isFork }) {
  return (
    <div className="space-y-4">
      {isFork && (
        <div className="bg-amber-50 border border-amber-200 rounded-lg px-3 py-2 text-xs text-amber-700">
          סוכן ברירת מחדל — השינויים יישמרו כעותק מותאם אישית חדש
        </div>
      )}
      <Field label="שם הסוכן (עברית)" required>
        <input className="input w-full" value={form.name} onChange={e => set('name', e.target.value)}
          placeholder="מנתח כלכלי מורחב" />
      </Field>
      <Field label="תפקיד קצר" required hint="משפט אחד — מה הסוכן עושה">
        <input className="input w-full" value={form.role} onChange={e => set('role', e.target.value)}
          placeholder="מנתח השלכות כלכליות וסנקציות" />
      </Field>
      <Field label="עדיפות הפעלה" hint="קובע את סדר הפעלת הסוכנים">
        <div className="flex gap-2 flex-wrap">
          {[1, 2, 3, 4, 5].map(p => (
            <button key={p} type="button"
              onClick={() => set('priority', p)}
              className={`px-3 py-1.5 rounded-lg text-sm font-medium border transition-colors ${
                form.priority === p
                  ? 'bg-brand text-white border-brand'
                  : 'bg-white text-gray-600 border-gray-300 hover:border-brand'
              }`}>
              {p} — {PRIORITY_LABELS[p].split(' — ')[0]}
            </button>
          ))}
        </div>
        <p className="text-xs text-gray-400 mt-1">{PRIORITY_LABELS[form.priority]}</p>
      </Field>
    </div>
  );
}

function Step2({ form, set }) {
  return (
    <div className="space-y-4">
      <Field label="תיאור הסוכן" required hint="מה הסוכן עושה, תחום המומחיות שלו">
        <textarea className="input w-full resize-none h-24 text-sm" value={form.description}
          onChange={e => set('description', e.target.value)}
          placeholder="סוכן זה מתמחה בניתוח השלכות כלכליות של אירועים מודיעיניים..." />
      </Field>
      <Field label="הנחיות פרומפט" required hint="הוראות ספציפיות לסוכן — איך לנתח, מה לבדוק">
        <textarea className="input w-full resize-none h-36 text-sm font-mono leading-relaxed"
          value={form.instructions} onChange={e => set('instructions', e.target.value)}
          placeholder={`אתה מנתח כלכלי. קרא את ההערכה ושאל:\n1. מה ההשלכות הכלכליות של התרחיש?\n2. האם הסנקציות הרלוונטיות אוכפות?\n3. מה מידת חשיפת השחקנים הכלכליים?`} />
      </Field>
      <Field label="שאלות ייחודיות לסוכן" hint="שאלות ממוקדות שהסוכן חייב לשאול (אופציונלי)">
        <textarea className="input w-full resize-none h-24 text-sm"
          value={form.questions} onChange={e => set('questions', e.target.value)}
          placeholder={`- מה הנפח הכלכלי של הפעולה?\n- האם קיים מניע כלכלי מוסתר?`} />
      </Field>
    </div>
  );
}

function Step3({ form, set }) {
  const [allSkills, setAllSkills] = useState([]);
  const [loadingSkills, setLoadingSkills] = useState(true);

  useEffect(() => {
    api.skills.list().then(setAllSkills).finally(() => setLoadingSkills(false));
  }, []);

  const toggle = (id) => {
    set('skills', form.skills.includes(id)
      ? form.skills.filter(s => s !== id)
      : [...form.skills, id]
    );
  };

  if (loadingSkills) return <p className="text-gray-400 text-sm">טוען מיומנויות...</p>;

  return (
    <div className="space-y-3">
      <p className="text-sm text-gray-500">
        בחר מיומנויות שהסוכן ייטען איתן. אלו מוסיפות ידע מקצועי לניתוח שלו (אופציונלי).
      </p>
      <div className="grid grid-cols-2 gap-2 max-h-72 overflow-y-auto">
        {allSkills.map(s => (
          <label key={s.id}
            className={`flex items-start gap-2.5 p-3 rounded-lg border cursor-pointer transition-colors ${
              form.skills.includes(s.id)
                ? 'border-brand bg-brand/5'
                : 'border-gray-200 hover:border-gray-300'
            }`}>
            <input type="checkbox" checked={form.skills.includes(s.id)}
              onChange={() => toggle(s.id)} className="mt-0.5 accent-brand" />
            <div className="min-w-0">
              <p className="text-sm font-medium text-gray-800 truncate">{s.name}</p>
              <p className="text-xs text-gray-400 truncate">{s.nameEn}</p>
            </div>
          </label>
        ))}
      </div>
      {form.skills.length > 0 && (
        <p className="text-xs text-brand">נבחרו: {form.skills.join(', ')}</p>
      )}
    </div>
  );
}

function Step4({ form, set }) {
  return (
    <div className="space-y-4">
      <Field label="מילות מפתח להפעלה אוטומטית (מופרדות בפסיק)"
        hint="השאר ריק להפעלה ידנית בלבד — הסוכן לא יופעל אוטומטית">
        <input className="input w-full" value={form.keywords}
          onChange={e => set('keywords', e.target.value)}
          placeholder="כלכלה, סנקציות, GDP, בנק מרכזי, נפט" />
      </Field>
      <Field label="פורמט תוצר" hint="תאר את מבנה הפלט הצפוי מהסוכן (אופציונלי)">
        <textarea className="input w-full resize-none h-36 text-sm font-mono leading-relaxed"
          value={form.outputFormat} onChange={e => set('outputFormat', e.target.value)}
          placeholder={`## ניתוח כלכלי\n\n### השלכות ישירות\n[ניתוח]\n\n### גורמי סיכון כלכליים\n[רשימה]\n\n### המלצות כלכליות\n[המלצות]`} />
      </Field>
    </div>
  );
}

function Preview({ form, mode, agentId }) {
  const md = generateMarkdown(form);
  const id = mode === 'edit' ? agentId : slugify(form.name);
  return (
    <div className="space-y-3">
      <p className="text-sm text-gray-500">
        {mode === 'edit' ? 'עדכון קובץ: ' : 'קובץ חדש: '}
        <code className="bg-gray-100 px-1.5 py-0.5 rounded text-xs" dir="ltr">{id}.md</code>
      </p>
      <pre className="bg-gray-50 border border-gray-200 rounded-lg p-4 text-xs font-mono
                      overflow-auto max-h-80 whitespace-pre-wrap text-gray-700 leading-relaxed" dir="ltr">
        {md}
      </pre>
    </div>
  );
}

// ─── Main wizard ──────────────────────────────────────────────────────────────

export default function AgentCreator({ mode = 'create', agentId, initialForm, onCreated, onCancel }) {
  const [step, setStep] = useState(1);
  const [form, setForm] = useState(initialForm || EMPTY_FORM);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const set = (key, value) => setForm(f => ({ ...f, [key]: value }));
  const isPreview = step === 5;
  const isFork = mode === 'fork';

  const title = mode === 'edit' ? 'עריכת סוכן' : mode === 'fork' ? 'עריכת עותק סוכן' : 'יצירת סוכן חדש';
  const saveLabel = mode === 'edit' ? 'שמור שינויים' : mode === 'fork' ? 'שמור כעותק מותאם' : 'שמור סוכן';

  const canNext = () => {
    if (step === 1) return form.name.trim() && form.role.trim();
    if (step === 2) return form.description.trim() && form.instructions.trim();
    return true;
  };

  const save = async () => {
    setSaving(true);
    setError('');
    try {
      const content = generateMarkdown(form);
      if (mode === 'edit') {
        await api.agents.update(agentId, content);
        onCreated?.({ id: agentId, name: form.name });
      } else {
        const id = slugify(form.name);
        await api.agents.create(id, content);
        onCreated?.({ id, name: form.name });
      }
    } catch (e) {
      setError(e.message);
      setSaving(false);
    }
  };

  return (
    <div className="bg-white border border-gray-200 rounded-xl shadow-lg p-6 mt-4">
      {/* Header */}
      <div className="flex items-center justify-between mb-5">
        <h2 className="text-lg font-bold text-gray-900">{title}</h2>
        <button onClick={onCancel} className="text-gray-400 hover:text-gray-600 text-2xl leading-none">×</button>
      </div>

      {/* Progress */}
      <div className="flex gap-1.5 mb-5">
        {[...STEPS, { id: 5, label: 'תצוגה מקדימה' }].map(s => (
          <div key={s.id} className="flex-1">
            <div className={`h-1.5 rounded-full transition-colors ${
              step > s.id ? 'bg-green-500' : step === s.id ? 'bg-brand' : 'bg-gray-200'
            }`} />
            <p className={`text-xs mt-1 text-center hidden md:block truncate ${
              step === s.id ? 'text-brand font-semibold' : 'text-gray-400'
            }`}>{s.label}</p>
          </div>
        ))}
      </div>

      <h3 className="text-sm font-semibold text-gray-600 mb-4">
        {isPreview ? 'שלב 5: תצוגה מקדימה' : `שלב ${step}: ${STEPS[step - 1]?.label}`}
      </h3>

      <div className="min-h-[280px]">
        {step === 1 && <Step1 form={form} set={set} isFork={isFork} />}
        {step === 2 && <Step2 form={form} set={set} />}
        {step === 3 && <Step3 form={form} set={set} />}
        {step === 4 && <Step4 form={form} set={set} />}
        {isPreview && <Preview form={form} mode={mode} agentId={agentId} />}
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
            {step === 4 ? 'תצוגה מקדימה' : 'הבא'}
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
