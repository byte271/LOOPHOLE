import { expect, it, vi } from 'vitest';
import { DEFAULT_BUDGET, DEFAULT_OBJECTIVE, ObjectiveSchema, validateModel } from '../src/domain/model';
import { LANTERN } from '../src/samples';
import { replay, transition } from '../src/engine/execute';
import { search, verifyCandidate } from '../src/engine/search';
import { verifyEvidence } from '../src/engine/evidence';
const evidence = () => ({ schemaVersion: 1, model: LANTERN, reviewed: true, result: search(LANTERN, DEFAULT_OBJECTIVE, DEFAULT_BUDGET, { reviewed: true }), createdAt: new Date().toISOString() });
it('rejects forged candidate verdicts even with coverage verification', () => {
  const e = evidence(); e.result.candidateResults = [{ actionIds: ['not_an_action'], accepted: true, reason: 'Verified' }];
  expect(() => verifyEvidence(e, { rerunCoverage: true })).toThrow('candidate verdict');
});
it('rejects impossible progress and bounds exported candidate lengths', () => {
  const e = evidence(); e.result.progress = { explored: 0, discovered: 0, frontier: 0, depth: 999, elapsedMs: 0 }; expect(() => verifyEvidence(e)).toThrow();
  const c = evidence(); c.result.candidateResults = [{ actionIds: Array(41).fill('sell'), accepted: false, reason: 'Invalid' }]; expect(() => verifyEvidence(c)).toThrow();
});
it('regenerates result prose rather than endorsing forged explanations', () => {
  const e = evidence(); e.result.message = 'This economy is safe forever'; const v = verifyEvidence(e); expect(v.evidence.result.message).not.toContain('safe forever'); expect(v.evidence.result.message).toContain('counterexample');
});
it('rejects structurally possible but invented completed traversal counts on coverage rerun', () => {
  const e = evidence(); e.result.progress.explored++; e.result.progress.discovered++; expect(() => verifyEvidence(e, { rerunCoverage: true })).toThrow('counts differ');
});
it('treats numeric representation exhaustion consistently in search and replay', () => {
  for (const field of ['turn', 'currency']) {
    const m = structuredClone(LANTERN); m.actions = [{ id: 'gain', label: 'Gain', kind: 'reward', ruleIds: ['guild'], requires: [], currencyDelta: '1', deltas: {} }];
    if (field === 'turn') m.initial.turn = 1_000_000; else m.initial.currency = '9'.repeat(256);
    validateModel(m); expect(() => replay(m, ['gain'])).toThrow('Operational numeric'); expect(() => transition(m, m.initial, 'gain')).toThrow('Operational numeric');
    expect(search(m, DEFAULT_OBJECTIVE, DEFAULT_BUDGET).status).toBe('numeric-limit');
  }
});
it('validates objectives at the candidate boundary', () => { expect(verifyCandidate(LANTERN, [], { ...DEFAULT_OBJECTIVE, minGain: '0' }, true).accepted).toBe(false); });
it('rejects overlong numeric input before any BigInt conversion', () => {
  const original = globalThis.BigInt; const spy = vi.fn(original); vi.stubGlobal('BigInt', spy);
  try { expect(ObjectiveSchema.safeParse({ ...DEFAULT_OBJECTIVE, minGain: '1'.repeat(1_000_000) }).success).toBe(false); expect(spy).not.toHaveBeenCalled(); }
  finally { vi.unstubAllGlobals(); }
});
it('rejects raw forbidden record keys rather than silently dropping effects', () => {
  const m = structuredClone(LANTERN); m.actions[0]!.deltas = JSON.parse('{"__proto__":1}'); expect(() => validateModel(m)).toThrow('Reserved resource key');
  const state = structuredClone(LANTERN); state.initial.resources = { ...state.initial.resources, ...JSON.parse('{"__proto__":0}') }; expect(() => validateModel(state)).toThrow('Reserved resource key');
});
