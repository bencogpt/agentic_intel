import { useState } from 'react';
import { api } from '../../services/client.js';

const STEPS = [
  { id: 1, label: 'פרטי מקור' },
  { id: 2, label: 'אימות גישה' },
  { id: 3, label: 'מיפוי תגובה' },
];

const EMPTY_FORM = {
  name: '', description: '', url: '', method: 'GET',
  authType: 'none', username: '', password: '', apiKey: '', apiKeyHeader: 'X-API-Key',
  queryParam: 'q',
  resultsPath: 'results', titleField: 'title', urlField: 'url', snippetField: 'description', dateField: '',
};

function slugify(name) {
  return 'source-' + name.toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, '').slice(0, 40);
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
      <Field label="שם המקור" required>
        <input className="input w-full" value={form.name} onChange={e => set('name', e.target.value)} placeholder="מסד נתוני איומים פנימי" />
      </Field>
      <Field label="תיאור" hint="לאיזה סוג מידע משמש מקור זה?">
        <textarea className="input w-full resize-none h-20 text-sm"
          value={form.description} onChange={e => set('description', e.target.value)} />
      </Field>
      <Field label="כתובת ה-API (URL)" required>
        <input className="input w-full font-mono text-sm" dir="ltr"
          value={form.url} onChange={e => set('url', e.target.value)}
          placeholder="https://api.example.com/search" />
      </Field>
      <Field label="שיטת HTTP">
        <div className="flex gap-3">
          {['GET', 'POST'].map(m => (
            <label key={m} className="flex items-center gap-2 cursor-pointer">
              <input type="radio" checked={form.method === m} onChange={() => set('method', m)} />
              <span className="text-sm font-mono">{m}</span>
            </label>
          ))}
        </div>
      </Field>
    </div>
  );
}

function Step2({ form, set }) {
  return (
    <div className="space-y-4">
      <Field label="סוג אימות">
        <div className="flex gap-4">
          {[
            { value: 'none',   label: 'ללא (חינמי)' },
            { value: 'basic',  label: 'משתמש + סיסמה' },
            { value: 'apikey', label: 'מפתח API' },
          ].map(({ value, label }) => (
            <label key={value} className="flex items-center gap-2 cursor-pointer">
              <input type="radio" checked={form.authType === value} onChange={() => set('authType', value)} />
              <span className="text-sm">{label}</span>
            </label>
          ))}
        </div>
      </Field>

      {form.authType === 'basic' && (
        <>
          <Field label="שם משתמש" required>
            <input className="input w-full" dir="ltr"
              value={form.username} onChange={e => set('username', e.target.value)} />
          </Field>
          <Field label="סיסמה" required>
            <input className="input w-full" type="password" dir="ltr"
              value={form.password} onChange={e => set('password', e.target.value)}
              placeholder={form._isEdit ? '(ריק = לא לשנות)' : ''} />
          </Field>
        </>
      )}

      {form.authType === 'apikey' && (
        <>
          <Field label="מפתח API" required>
            <input className="input w-full font-mono text-sm" dir="ltr"
              value={form.apiKey} onChange={e => set('apiKey', e.target.value)}
              placeholder={form._isEdit ? '(ריק = לא לשנות)' : ''} />
          </Field>
          <Field label="שם הכותרת" hint='ברירת מחדל: X-API-Key'>
            <input className="input w-full font-mono text-sm" dir="ltr"
              value={form.apiKeyHeader} onChange={e => set('apiKeyHeader', e.target.value)} />
          </Field>
        </>
      )}

      {form.authType === 'none' && (
        <p className="text-sm text-gray-400 py-4 text-center">המקור אינו דורש אימות</p>
      )}
    </div>
  );
}

function Step3({ form, set }) {
  return (
    <div className="space-y-4">
      <p className="text-sm text-gray-500">
        הגדר כיצד לשלוח את שאילתת החיפוש ואיך לקרוא את התגובה (JSON paths).
      </p>
      <Field label="פרמטר שאילתה" hint='שם הפרמטר שמכיל את טקסט החיפוש, לדוג׳ "q" או "query"'>
        <input className="input w-full font-mono text-sm" dir="ltr"
          value={form.queryParam} onChange={e => set('queryParam', e.target.value)} />
      </Field>

      <div className="border-t border-gray-100 pt-4">
        <p className="text-xs font-semibold text-gray-500 mb-3">מיפוי שדות בתגובה (dot notation)</p>
        <div className="grid grid-cols-2 gap-3">
          <Field label="נתיב מערך התוצאות" hint='לדוג׳ "results" או "data.items"'>
            <input className="input w-full font-mono text-sm" dir="ltr"
              value={form.resultsPath} onChange={e => set('resultsPath', e.target.value)} />
          </Field>
          <Field label='שדה "כותרת"'>
            <input className="input w-full font-mono text-sm" dir="ltr"
              value={form.titleField} onChange={e => set('titleField', e.target.value)} />
          </Field>
          <Field label='שדה "כתובת URL"'>
            <input className="input w-full font-mono text-sm" dir="ltr"
              value={form.urlField} onChange={e => set('urlField', e.target.value)} />
          </Field>
          <Field label='שדה "תקציר"'>
            <input className="input w-full font-mono text-sm" dir="ltr"
              value={form.snippetField} onChange={e => set('snippetField', e.target.value)} />
          </Field>
          <Field label='שדה "תאריך"' hint="אופציונלי">
            <input className="input w-full font-mono text-sm" dir="ltr"
              value={form.dateField} onChange={e => set('dateField', e.target.value)} />
          </Field>
        </div>
      </div>
    </div>
  );
}

function formToPayload(form) {
  const auth = form.authType === 'basic'
    ? { type: 'basic', username: form.username, password: form.password }
    : form.authType === 'apikey'
    ? { type: 'apikey', apiKey: form.apiKey, apiKeyHeader: form.apiKeyHeader }
    : { type: 'none' };

  return {
    name:        form.name,
    description: form.description,
    url:         form.url,
    method:      form.method,
    queryParam:  form.queryParam,
    auth,
    responseMap: {
      resultsPath: form.resultsPath,
      title:       form.titleField,
      url:         form.urlField,
      snippet:     form.snippetField,
      ...(form.dateField && { date: form.dateField }),
    },
  };
}

export function sourceToForm(source) {
  const auth = source.auth || {};
  return {
    name:         source.name || '',
    description:  source.description || '',
    url:          source.url || '',
    method:       source.method || 'GET',
    authType:     auth.type || 'none',
    username:     auth.username || '',
    password:     '',
    apiKey:       '',
    apiKeyHeader: auth.apiKeyHeader || 'X-API-Key',
    queryParam:   source.queryParam || 'q',
    resultsPath:  source.responseMap?.resultsPath || 'results',
    titleField:   source.responseMap?.title   || 'title',
    urlField:     source.responseMap?.url     || 'url',
    snippetField: source.responseMap?.snippet || 'description',
    dateField:    source.responseMap?.date    || '',
    _isEdit: true,
  };
}

export default function SourceCreator({ mode = 'create', sourceId, initialForm, onSaved, onCancel }) {
  const [step, setStep]     = useState(1);
  const [form, setForm]     = useState(initialForm || EMPTY_FORM);
  const [saving, setSaving] = useState(false);
  const [error, setError]   = useState('');

  const set = (key, value) => setForm(f => ({ ...f, [key]: value }));

  const canNext = () => {
    if (step === 1) return form.name.trim() && form.url.trim();
    if (step === 2) {
      if (form.authType === 'basic')  return form.username.trim() && (form.password.trim() || form._isEdit);
      if (form.authType === 'apikey') return form.apiKey.trim() || form._isEdit;
    }
    return true;
  };

  const save = async () => {
    setSaving(true);
    setError('');
    try {
      const payload = formToPayload(form);
      if (mode === 'edit') {
        // Don't overwrite credentials if left blank (edit mode)
        if (form.authType === 'basic'  && !form.password) delete payload.auth.password;
        if (form.authType === 'apikey' && !form.apiKey)   delete payload.auth.apiKey;
        await api.sources.update(sourceId, payload);
        onSaved?.({ id: sourceId, name: form.name });
      } else {
        const id = slugify(form.name);
        await api.sources.create(id, payload);
        onSaved?.({ id, name: form.name });
      }
    } catch (e) {
      setError(e.message);
      setSaving(false);
    }
  };

  const title = mode === 'edit' ? 'עריכת מקור נתונים' : 'מקור נתונים חדש';
  const saveLabel = mode === 'edit' ? 'שמור שינויים' : 'צור מקור';

  return (
    <div className="bg-white border border-gray-200 rounded-xl shadow-lg p-6 mt-4">
      <div className="flex items-center justify-between mb-5">
        <h2 className="text-lg font-bold text-gray-900">{title}</h2>
        <button onClick={onCancel} className="text-gray-400 hover:text-gray-600 text-2xl leading-none">×</button>
      </div>

      {/* Progress */}
      <div className="flex gap-1.5 mb-5">
        {STEPS.map(s => (
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
        שלב {step}: {STEPS[step - 1]?.label}
      </h3>

      <div className="min-h-[260px]">
        {step === 1 && <Step1 form={form} set={set} />}
        {step === 2 && <Step2 form={form} set={set} />}
        {step === 3 && <Step3 form={form} set={set} />}
      </div>

      {error && <p className="text-sm text-red-500 mt-3">{error}</p>}

      <div className="flex justify-between mt-6 pt-4 border-t border-gray-100">
        <button onClick={() => setStep(s => s - 1)} disabled={step === 1}
          className="btn-secondary disabled:opacity-40 disabled:cursor-not-allowed">
          הקודם
        </button>
        {step < STEPS.length ? (
          <button onClick={() => setStep(s => s + 1)} disabled={!canNext()}
            className="btn-primary disabled:opacity-40 disabled:cursor-not-allowed">
            הבא
          </button>
        ) : (
          <button onClick={save} disabled={saving || !canNext()}
            className="btn-primary disabled:opacity-40 disabled:cursor-not-allowed">
            {saving ? 'שומר...' : saveLabel}
          </button>
        )}
      </div>
    </div>
  );
}
