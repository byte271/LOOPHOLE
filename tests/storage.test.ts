import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { DEFAULT_BUDGET, DEFAULT_OBJECTIVE, ENGINE_VERSION, modelVersion } from '../src/domain/model';
import { LANTERN } from '../src/samples';
import { search } from '../src/engine/search';
import { challengeURL, loadDraft, readChallenge, saveDraft, STORAGE_KEY, validateEvidence, type Draft } from '../src/client/storage';
const evidence = () => ({ schemaVersion: 1 as const, model: LANTERN, reviewed: true, result: search(LANTERN, DEFAULT_OBJECTIVE, DEFAULT_BUDGET, { reviewed: true }), createdAt: new Date().toISOString() });
const draft = (): Draft => ({ schemaVersion: 1, model: LANTERN, reviewed: true, objective: DEFAULT_OBJECTIVE, budget: DEFAULT_BUDGET, sourceDraft: LANTERN.source, jsonDraft: JSON.stringify(LANTERN, null, 2), evidence: evidence(), history: [], savedAt: new Date().toISOString() });
beforeEach(() => {
  const store = new Map<string, string>();
  vi.stubGlobal('localStorage', { getItem: (key: string) => store.get(key) ?? null, setItem: (key: string, value: string) => store.set(key, value), removeItem: (key: string) => store.delete(key) });
  vi.stubGlobal('location', { origin: 'https://loophole.test', pathname: '/', hash: '' });
});
afterEach(() => vi.unstubAllGlobals());
describe('private persistence and deliberate fixed challenges', () => {
  it('persists and revalidates a complete candidate-bearing result', () => {
    const d = draft(); saveDraft(d); expect(loadDraft()).toEqual(d); expect(validateEvidence(d.evidence)).toEqual(d.evidence);
  });
  it('rejects malformed recovery without destroying the original', () => {
    localStorage.setItem(STORAGE_KEY, '{broken'); expect(() => loadDraft()).toThrow(); expect(localStorage.getItem(STORAGE_KEY)).toBe('{broken');
  });
  it('rejects unknown schema versions and tampered objectives in stored evidence', () => {
    const d = draft(); localStorage.setItem(STORAGE_KEY, JSON.stringify({ ...d, schemaVersion: 2 })); expect(() => loadDraft()).toThrow();
    const bad = evidence(); bad.result.objective = { ...DEFAULT_OBJECTIVE, minGain: '9999' }; expect(() => validateEvidence(bad)).toThrow();
  });
  it('roundtrips a pinned snapshot without review, API tokens, prompts or other drafts', () => {
    saveDraft(draft()); const before = localStorage.getItem(STORAGE_KEY);
    const url = challengeURL(LANTERN, DEFAULT_OBJECTIVE, DEFAULT_BUDGET); location.hash = new URL(url).hash;
    const challenge = readChallenge()!; expect(modelVersion(challenge.model)).toBe(modelVersion(LANTERN)); expect(challenge.engineVersion).toBe(ENGINE_VERSION); expect(challenge.reviewed).toBe(false);
    expect(Object.keys(challenge).sort()).toEqual(['budget', 'engineVersion', 'kind', 'model', 'objective', 'reviewed', 'schemaVersion']);
    expect(localStorage.getItem(STORAGE_KEY)).toBe(before);
  });
  it('rejects corrupt, oversized and unrecognized challenge fragments', () => {
    for (const hash of ['#challenge=@@', '#unrecognized', '#challenge=' + 'a'.repeat(100001)]) { location.hash = hash; expect(() => readChallenge()).toThrow(); }
  });
  it('rejects results belonging to another model version', () => {
    const d = draft(); d.evidence!.result.modelVersion = 'm1-wrong'; localStorage.setItem(STORAGE_KEY, JSON.stringify(d)); expect(() => loadDraft()).toThrow();
  });
});
