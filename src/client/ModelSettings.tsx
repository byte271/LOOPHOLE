import { useState } from 'react';
import { DEFAULT_MODEL } from '../server/provider';

export type LocalModelSettings = { apiKey: string; model: string };
const KEY = 'loophole.model-settings.v1';
export function loadModelSettings(): LocalModelSettings {
  try {
    const value = JSON.parse(localStorage.getItem(KEY) ?? 'null');
    if (value && typeof value.apiKey === 'string' && typeof value.model === 'string') return value;
  } catch { /* Storage may be blocked. Settings remain usable in the dialog. */ }
  return { apiKey: '', model: DEFAULT_MODEL };
}
export function ModelSettings({ initial, onSave }: { initial: LocalModelSettings; onSave: (value: LocalModelSettings) => void }) {
  const [apiKey, setApiKey] = useState(initial.apiKey);
  const [model, setModel] = useState(initial.model);
  const [visible, setVisible] = useState(false);
  const [error, setError] = useState('');
  function persist(remove = false) {
    const value = { apiKey: remove ? '' : apiKey.trim(), model: model.trim() || DEFAULT_MODEL };
    try {
      if (remove) localStorage.removeItem(KEY);
      else localStorage.setItem(KEY, JSON.stringify(value));
      onSave(value);
    } catch { setError('Your browser blocked local storage. Settings were not saved.'); }
  }
  return <form className="model-settings" onSubmit={(event) => { event.preventDefault(); persist(); }}>
    <p>Use your OpenAI API key for AI interpretation and trace explanations.</p>
    <label htmlFor="model-api-key">API key</label>
    <div className="key-input-row"><input id="model-api-key" type={visible ? 'text' : 'password'} value={apiKey} onChange={(event) => setApiKey(event.target.value)} autoComplete="off" spellCheck={false} placeholder="Enter your API key" required />
      <button type="button" className="button secondary small" aria-pressed={visible} onClick={() => setVisible(!visible)}>{visible ? 'Hide' : 'Show'}</button></div>
    <label htmlFor="model-name">Model</label>
    <input id="model-name" value={model} onChange={(event) => setModel(event.target.value)} placeholder={DEFAULT_MODEL} required />
    <p className="muted">Saved only in this browser on this device. Your key is never included in exports or shared links. When you use AI, it is sent directly to OpenAI with your request, never to a LOOPHOLE server. Provider charges may apply.</p>
    {error && <p role="alert" className="error-text">{error}</p>}
    <div className="key-input-row"><button type="submit" className="button">Save on this device</button><button type="button" className="button secondary" onClick={() => persist(true)}>Remove key</button></div>
  </form>;
}
