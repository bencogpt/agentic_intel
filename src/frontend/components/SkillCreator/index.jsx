import { useState } from 'react';
import { api } from '../../services/client.js';

// ─── Step definitions ─────────────────────────────────────────────────────────

const STEPS = [
  { id: 1, label: 'פרטים בסיסיים' },
  { id: 2, label: 'שאלות ליבה' },
  { id: 3, label: 'הנחיות ניתוח' },
  { id: 4, label: 'מקורות מועדפים' },
  { id: 5, label: 'דוגמאות ואזהרות' },
];

const EMPTY_FORM = {
  name: '', name_en: '', description: '', tags: '', keywords: '',
  questions: ['', '', '', '', ''],
  instructions: '', sources: '', examples: '', biases: '',
};

// ─── Body parsers — convert existing skill .md body into form fields ──────────

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

function parseQuestions(body) {
  const raw = parseBodySection(body, 'שאלות ליבה');
  const qs = raw.split('\n')
    .filter(l => /^\d+\./.test(l.trim()))
    .map(l => l.replace(/^\d+\.\s*/, '').trim());
  while (qs.length < 5) qs.push('');
  return qs.slice(0, 5);
}

function parseSources(body) {
  const raw = parseBodySection(body, 'מקורות מועדפים');
  return raw.split('\n').map(l => l.replace(/^-\s*/, '').trim()).filter(Boolean).join('\n');
}

export function skillToForm(skill) {
  const body = skill.body || '';
  return {
    name: skill.name || '',
    name_en: skill.name_en || '',
    description: parseBodySection(body, 'תיאור המיומנות'),
    tags: (skill.tags || []).join(', '),
    keywords: (skill.auto_trigger_keywords || []).join(', '),
    questions: parseQuestions(body),
    instructions: parseBodySection(body, 'הנחיות ניתוח'),
    sources: parseSources(body),
    examples: parseBodySection(body, 'דוגמאות'),
    biases: parseBodySection(body, 'אזהרות והטיות'),
  };
}

// ─── Markdown generator ───────────────────────────────────────────────────────

function generateMarkdown(form) {
  const today = new Date().toISOString().split('T')[0];
  const tags = form.tags.split(',').map(t => t.trim()).filter(Boolean);
  const keywords = form.keywords.split(',').map(k => k.trim()).filter(Boolean);
  const questions = form.questions.filter(q => q.trim());
  const sources = form.sources.split('\n').map(s => s.trim()).filter(Boolean);

  return `---
name: ${form.name}
name_en: ${form.name_en}
version: 1.0
author: custom
created: ${today}
last_modified: ${today}
tags: [${tags.join(', ')}]
auto_trigger_keywords: [${keywords.join(', ')}]
---

## תיאור המיומנות
${form.description}

## שאלות ליבה (Core Questions)
${questions.map((q, i) => `${i + 1}. ${q}`).join('\n')}

## הנחיות ניתוח (Analysis Instructions)
${form.instructions}

## מקורות מועדפים (Preferred Sources)
${sources.map(s => `- ${s}`).join('\n')}

## דוגמאות (Examples)
${form.examples}

## אזהרות והטיות ידועות (Known Biases & Warnings)
${form.biases}
`.trimEnd() + '\n';
}

function slugify(name_en) {
  return 'skill-' + name_en.toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, '');
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
          מיומנות ברירת מחדל — השינויים יישמרו כעותק מותאם אישית חדש
        </div>
      )}
      <div className="grid grid-cols-2 gap-4">
        <Field label="שם (עברית)" required>
          <input className="input w-full" value={form.name} onChange={e => set('name', e.target.value)} />
        </Field>
        <Field label="שם (English)" required>
          <input className="input w-full" value={form.name_en} onChange={e => set('name_en', e.target.value)} dir="ltr" />
        </Field>
      </div>
      <Field label="תיאור קצר" required>
        <textarea className="input w-full resize-none h-20" value={form.description}
          onChange={e => set('description', e.target.value)} />
      </Field>
      <Field label="תגיות (מופרדות בפסיק)">
        <input className="input w-full" value={form.tags} onChange={e => set('tags', e.target.value)} />
      </Field>
      <Field label="מילות מפתח להפעלה אוטומטית (מופרדות בפסיק)">
        <input className="input w-full" value={form.keywords} onChange={e => set('keywords', e.target.value)} />
      </Field>
    </div>
  );
}

function Step2({ form, set }) {
  return (
    <div className="space-y-3">
      <p className="text-sm text-gray-500 mb-2">לפחות 2 שאלות נדרשות.</p>
      {form.questions.map((q, i) => (
        <Field key={i} label={`שאלה ${i + 1}`} required={i < 2}>
          <input className="input w-full" value={q}
            onChange={e => {
              const updated = [...form.questions];
              updated[i] = e.target.value;
              set('questions', updated);
            }} />
        </Field>
      ))}
    </div>
  );
}

function Step3({ form, set }) {
  return (
    <Field label="הנחיות ניתוח" required>
      <textarea className="input w-full resize-none h-64 font-mono text-sm leading-relaxed"
        value={form.instructions} onChange={e => set('instructions', e.target.value)} />
    </Field>
  );
}

function Step4({ form, set }) {
  return (
    <Field label="מקורות מועדפים" hint="שורה לכל מקור">
      <textarea className="input w-full resize-none h-56 font-mono text-sm leading-relaxed"
        value={form.sources} onChange={e => set('sources', e.target.value)} />
    </Field>
  );
}

function Step5({ form, set }) {
  return (
    <div className="space-y-4">
      <Field label="דוגמה לטענה וניתוח" hint="אופציונלי">
        <textarea className="input w-full resize-none h-28 text-sm"
          value={form.examples} onChange={e => set('examples', e.target.value)} />
      </Field>
      <Field label="הטיות ואזהרות ידועות" hint="אופציונלי">
        <textarea className="input w-full resize-none h-28 text-sm"
          value={form.biases} onChange={e => set('biases', e.target.value)} />
      </Field>
    </div>
  );
}

function Preview({ form, mode, skillId }) {
  const md = generateMarkdown(form);
  const id = mode === 'edit' ? skillId : slugify(form.name_en);
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

// ─── Main Wizard ──────────────────────────────────────────────────────────────

// mode: 'create' | 'edit' | 'fork'
// - create: POST /api/skills (new skill)
// - edit:   PUT  /api/skills/:skillId (update custom skill in place)
// - fork:   POST /api/skills (copy of a default skill saved as custom)
export default function SkillCreator({ mode = 'create', skillId, initialForm, onCreated, onCancel }) {
  const [step, setStep] = useState(1);
  const [form, setForm] = useState(initialForm || EMPTY_FORM);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const set = (key, value) => setForm(f => ({ ...f, [key]: value }));
  const isPreview = step === 6;
  const isFork = mode === 'fork';

  const title = mode === 'edit' ? 'עריכת מיומנות' : mode === 'fork' ? 'עריכת עותק מותאם' : 'יצירת מיומנות חדשה';
  const saveLabel = mode === 'edit' ? 'שמור שינויים' : mode === 'fork' ? 'שמור כעותק מותאם' : 'שמור מיומנות';

  const canNext = () => {
    if (step === 1) return form.name.trim() && form.name_en.trim() && form.description.trim();
    if (step === 2) return form.questions.filter(q => q.trim()).length >= 2;
    if (step === 3) return form.instructions.trim();
    return true;
  };

  const save = async () => {
    setSaving(true);
    setError('');
    try {
      const content = generateMarkdown(form);
      if (mode === 'edit') {
        await api.skills.update(skillId, content);
        onCreated?.({ id: skillId, name: form.name });
      } else {
        const id = slugify(form.name_en);
        await api.skills.create(id, content);
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
        {[...STEPS, { id: 6, label: 'תצוגה מקדימה' }].map(s => (
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
        {isPreview ? 'שלב 6: תצוגה מקדימה' : `שלב ${step}: ${STEPS[step - 1]?.label}`}
      </h3>

      <div className="min-h-[300px]">
        {step === 1 && <Step1 form={form} set={set} isFork={isFork} />}
        {step === 2 && <Step2 form={form} set={set} />}
        {step === 3 && <Step3 form={form} set={set} />}
        {step === 4 && <Step4 form={form} set={set} />}
        {step === 5 && <Step5 form={form} set={set} />}
        {isPreview && <Preview form={form} mode={mode} skillId={skillId} />}
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
            {step === 5 ? 'תצוגה מקדימה' : 'הבא'}
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
