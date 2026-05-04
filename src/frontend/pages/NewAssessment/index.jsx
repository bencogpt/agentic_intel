import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { api } from '../../services/client.js';

export default function NewAssessment() {
  const navigate = useNavigate();
  const [mode, setMode] = useState('text');
  const [text, setText] = useState('');
  const [title, setTitle] = useState('');
  const [file, setFile] = useState(null);
  const [agents, setAgents] = useState([]);
  const [selectedAgents, setSelectedAgents] = useState([]);
  const [workflows, setWorkflows] = useState([]);
  const [activeWorkflow, setActiveWorkflow] = useState(null);
  const [availableModels, setAvailableModels] = useState([]);
  const [selectedModel, setSelectedModel] = useState(null); // null = server default
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [dragOver, setDragOver] = useState(false);

  useEffect(() => {
    api.agents.list().catch(() => []).then(setAgents);
    api.workflows.list().catch(() => []).then(setWorkflows);
    api.models.list().catch(() => null).then(data => {
      if (data?.models) {
        setAvailableModels(data.models);
        setSelectedModel(data.default);
      }
    });
  }, []);

  // Auto-suggest workflow when text changes
  useEffect(() => {
    if (!text || activeWorkflow) return;
    const lower = text.toLowerCase();
    const suggested = workflows.find(w =>
      (w.autoActivateKeywords || []).some(k => lower.includes(k.toLowerCase()))
    );
    if (suggested) setActiveWorkflow(suggested);
  }, [text, workflows, activeWorkflow]);

  const applyWorkflow = (w) => {
    setActiveWorkflow(w);
    setSelectedAgents(w.agents || []);
  };

  const clearWorkflow = () => {
    setActiveWorkflow(null);
    setSelectedAgents([]);
  };

  const toggleAgent = (id) =>
    setSelectedAgents(prev => prev.includes(id) ? prev.filter(a => a !== id) : [...prev, id]);

  const handleSubmit = async () => {
    setError('');
    setLoading(true);
    try {
      let ingestResult;
      if (mode === 'text') {
        if (!text.trim()) { setError('יש להזין טקסט'); setLoading(false); return; }
        ingestResult = await api.ingest.text(text, title);
      } else {
        if (!file) { setError('יש לבחור קובץ'); setLoading(false); return; }
        ingestResult = await api.ingest.file(file);
      }
      await api.analyze.start(
        ingestResult.sessionId,
        selectedAgents.length ? selectedAgents : undefined,
        activeWorkflow?.synthesisFocus || undefined,
        selectedModel || undefined,
      );
      navigate(`/processing/${ingestResult.sessionId}`);
    } catch (e) {
      setError(e.message);
      setLoading(false);
    }
  };

  const handleDrop = (e) => {
    e.preventDefault();
    setDragOver(false);
    const f = e.dataTransfer.files[0];
    if (f) { setFile(f); setMode('file'); }
  };

  return (
    <div className="max-w-3xl mx-auto">
      <h1 className="text-2xl font-bold text-gray-900 mb-6">הערכה חדשה</h1>

      {/* Mode toggle */}
      <div className="flex gap-2 mb-6">
        {[['text', 'הדבקת טקסט'], ['file', 'העלאת קובץ']].map(([m, label]) => (
          <button key={m} onClick={() => setMode(m)}
            className={`px-4 py-2 rounded-lg text-sm font-medium border transition-colors ${
              mode === m ? 'bg-brand text-white border-brand' : 'bg-white text-gray-600 border-gray-300 hover:bg-gray-50'
            }`}>
            {label}
          </button>
        ))}
      </div>

      {/* Document input */}
      <div className="card mb-6">
        <input className="input w-full mb-4"
          placeholder="כותרת ההערכה (אופציונלי)"
          value={title} onChange={e => setTitle(e.target.value)} />

        {mode === 'text' ? (
          <textarea
            className="w-full h-64 border border-gray-200 rounded-lg px-3 py-2 text-sm resize-none focus:outline-none focus:ring-2 focus:ring-brand"
            placeholder="הדבק את טקסט ההערכה כאן..."
            value={text} onChange={e => setText(e.target.value)} />
        ) : (
          <div
            onDragOver={e => { e.preventDefault(); setDragOver(true); }}
            onDragLeave={() => setDragOver(false)}
            onDrop={handleDrop}
            onClick={() => document.getElementById('file-input').click()}
            className={`h-40 border-2 border-dashed rounded-lg flex flex-col items-center justify-center cursor-pointer transition-colors ${
              dragOver ? 'border-brand bg-blue-50' : 'border-gray-300 hover:border-brand hover:bg-gray-50'
            }`}>
            <input id="file-input" type="file" className="hidden"
              accept=".md,.txt,.docx,.pdf"
              onChange={e => setFile(e.target.files[0])} />
            {file
              ? <p className="text-sm text-green-600 font-medium">✓ {file.name}</p>
              : <>
                  <div className="text-3xl mb-2">📄</div>
                  <p className="text-sm text-gray-500">גרור קובץ לכאן או לחץ לבחירה</p>
                  <p className="text-xs text-gray-400 mt-1">.md, .txt, .docx, .pdf</p>
                </>
            }
          </div>
        )}
      </div>

      {/* Workflow picker */}
      {workflows.length > 0 && (
        <div className="card mb-6">
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-sm font-semibold text-gray-700">בחר Workflow</h3>
            {activeWorkflow && (
              <button onClick={clearWorkflow} className="text-xs text-gray-400 hover:text-gray-600">נקה</button>
            )}
          </div>

          {activeWorkflow && (
            <div className="mb-3 flex items-center gap-2 px-3 py-2 bg-brand/5 border border-brand/20 rounded-lg text-sm text-brand">
              <span className="font-medium">{activeWorkflow.name}</span>
              <span className="text-brand/50">—</span>
              <span className="text-xs text-brand/70">
                {activeWorkflow.agents?.length
                  ? `${activeWorkflow.agents.length} סוכנים מוגדרים`
                  : 'בחירה אוטומטית'
                }
              </span>
            </div>
          )}

          <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
            {workflows.map(w => (
              <button key={w.id}
                onClick={() => activeWorkflow?.id === w.id ? clearWorkflow() : applyWorkflow(w)}
                className={`text-right p-3 rounded-lg border text-sm transition-colors ${
                  activeWorkflow?.id === w.id
                    ? 'border-brand bg-brand/5 text-brand'
                    : 'border-gray-200 hover:border-brand text-gray-700 hover:bg-gray-50'
                }`}>
                <p className="font-medium truncate">{w.name}</p>
                {w.agents?.length > 0 && (
                  <p className="text-xs text-gray-400 mt-0.5">{w.agents.length} סוכנים</p>
                )}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Model selector */}
      {availableModels.length > 0 && (
        <div className="card mb-6">
          <h3 className="text-sm font-semibold text-gray-700 mb-3">מודל שפה</h3>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {availableModels.map(m => (
              <button
                key={m.id}
                type="button"
                onClick={() => setSelectedModel(m.id)}
                className={`text-right p-4 rounded-xl border-2 transition-all ${
                  selectedModel === m.id
                    ? 'border-brand bg-brand/5'
                    : 'border-gray-200 hover:border-gray-300 bg-white'
                }`}
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <p className={`text-sm font-semibold truncate ${selectedModel === m.id ? 'text-brand' : 'text-gray-800'}`}>
                      {m.label}
                    </p>
                    <p className="text-xs text-gray-400 mt-0.5 truncate">{m.labelEn}</p>
                    <p className="text-xs text-gray-500 mt-1 leading-snug">{m.description}</p>
                  </div>
                  <div className={`shrink-0 w-4 h-4 mt-0.5 rounded-full border-2 flex items-center justify-center ${
                    selectedModel === m.id ? 'border-brand bg-brand' : 'border-gray-300'
                  }`}>
                    {selectedModel === m.id && (
                      <div className="w-1.5 h-1.5 rounded-full bg-white" />
                    )}
                  </div>
                </div>
                {m.provider === 'cohere' && (
                  <span className="inline-block mt-2 text-xs px-2 py-0.5 rounded-full bg-purple-100 text-purple-600 font-medium">
                    Reasoning
                  </span>
                )}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Agent selection */}
      {agents.length > 0 && (
        <div className="card mb-6">
          <h3 className="text-sm font-semibold text-gray-700 mb-3">
            סוכנים <span className="text-gray-400 font-normal">(השאר ריק לבחירה אוטומטית)</span>
          </h3>
          <div className="grid grid-cols-2 gap-2">
            {agents.map(agent => (
              <label key={agent.id}
                className={`flex items-center gap-3 p-3 rounded-lg border cursor-pointer transition-colors ${
                  selectedAgents.includes(agent.id) ? 'border-brand bg-blue-50' : 'border-gray-200 hover:bg-gray-50'
                }`}>
                <input type="checkbox" className="accent-brand"
                  checked={selectedAgents.includes(agent.id)}
                  onChange={() => toggleAgent(agent.id)} />
                <div>
                  <p className="text-sm font-medium text-gray-800">{agent.name}</p>
                  <p className="text-xs text-gray-400">{agent.role}</p>
                </div>
              </label>
            ))}
          </div>
        </div>
      )}

      {error && <p className="text-red-600 text-sm mb-4 p-3 bg-red-50 rounded-lg">{error}</p>}

      <button onClick={handleSubmit} disabled={loading}
        className="btn-primary w-full text-base py-3 disabled:opacity-60">
        {loading ? 'מעבד...' : activeWorkflow ? `נתח עם ${activeWorkflow.name}` : 'נתח הערכה'}
      </button>
    </div>
  );
}
