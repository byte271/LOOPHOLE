import { useEffect, useRef, useState } from 'react';
import { Sparkles, Square } from 'lucide-react';
import type { Evidence, TraceExplanation } from '../domain/contracts';
import { TraceExplanationSchema } from '../domain/ai';
import './TraceNarrative.css';
import { explain as explainDirect } from '../server/provider';
import type { LocalModelSettings } from './ModelSettings';
import { errorMessage } from './storage';
export function TraceNarrative({ evidence, configured, token, requiresToken, modelSettings }: { modelSettings: LocalModelSettings; evidence: Evidence; configured: boolean; token: string; requiresToken: boolean }) {
  const [narrative, setNarrative] = useState<TraceExplanation | null>(null);
  const [pending, setPending] = useState(false); const [error, setError] = useState('');
  const controller = useRef<AbortController | null>(null);
  useEffect(() => { setNarrative(null); setError(''); setPending(false); return () => controller.current?.abort(); }, [evidence]);
  async function explain() {
    const abort = new AbortController(); controller.current?.abort(); controller.current = abort;
    setPending(true); setError('');
    try {
      if (!modelSettings.apiKey && requiresToken && !token) throw new Error('Enter your server access token in connection settings first.');
      let payload: unknown;
      if (modelSettings.apiKey) { payload = await explainDirect(evidence, abort.signal, modelSettings); } else {
      const response = await fetch('/api/explain', { method: 'POST', signal: abort.signal, headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) }, body: JSON.stringify({ evidence, requestId: crypto.randomUUID() }) });
      payload = await response.json();
      if (!response.ok) { const detail = payload && typeof payload === 'object' && 'error' in payload ? payload.error : null; throw new Error(detail && typeof detail === 'object' && 'message' in detail ? String(detail.message) : `Explanation failed (${response.status}).`); }
      }
      const result = TraceExplanationSchema.parse(payload);
      if (result.citedSteps.some(step => step > evidence.result.finding!.trace.steps.length)) throw new Error('AI explanation cited a nonexistent step.');
      if (!abort.signal.aborted) setNarrative(result);
    } catch (e) { if (!abort.signal.aborted) setError(errorMessage(e)); }
    finally { if (controller.current === abort) setPending(false); }
  }
  return <section className="ai-narrative" aria-label="Optional Astra explanation">
    <div className="ai-narrative-heading"><h3><Sparkles size={15} /> Ask Astra about this trace</h3>
      {pending ? <button className="button secondary small" onClick={() => { controller.current?.abort(); setPending(false); setError('Explanation cancelled. Provider billing may still have occurred.'); }}><Square size={13} /> Cancel explanation</button>
        : <button className="button secondary small" disabled={!configured} onClick={explain}>Explain verified trace</button>}
    </div>
    <p className="muted">{configured ? 'Sends this pinned model and recorded trace to Astra. Its explanation and proposed repairs are advisory, never the proof.' : 'Add your API key in Model API settings to request an explanation. The deterministic proof above needs no model call.'}</p>
    {pending && <p role="status">Astra is reading the verified trace. No conclusion is inferred while waiting.</p>}
    {error && <p role="alert" className="error-text">{error}</p>}
    {narrative && <div className="ai-narrative-result"><span className="eyebrow">AI explanation · not a verification verdict</span><p>{narrative.explanation}</p><p className="muted">Cited steps: {narrative.citedSteps.join(', ') || 'none'}{narrative.usage ? ` · ${narrative.usage.model} · estimated $${narrative.usage.estimatedCostUsd}` : ''}</p>
      {narrative.suggestedChanges.length > 0 && <><h4>Proposed rule changes</h4><ul>{narrative.suggestedChanges.map((change, index) => <li key={index}>{change}</li>)}</ul><p className="muted">Review and apply a source/model edit, then run a fresh search. No repair is assumed to work.</p></>}
    </div>}
  </section>;
}
