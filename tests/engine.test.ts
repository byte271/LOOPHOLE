import { describe, expect, it } from 'vitest';
import fc from 'fast-check';
import { canonical, DEFAULT_BUDGET, DEFAULT_OBJECTIVE, ENGINE_VERSION, formatMoney, modelVersion, validateModel, type Model, type Objective } from '../src/domain/model';
import { certifyCycle, enumerateActions, isLegal, replay, transition, verifyTrace } from '../src/engine/execute';
import { search, verifyCandidate } from '../src/engine/search';
import { verifyEvidence } from '../src/engine/evidence';
import { LANTERN, repairLantern, SAMPLES } from '../src/samples';
const cycle = ['buy_discount', 'craft', 'claim', 'sell'];
const clone = () => structuredClone(LANTERN);
const objective: Objective = { ...DEFAULT_OBJECTIVE, mode: 'highest-gain' };
function tiny(buy: number, sell: number, cap = 2, turns: number | null = 6): Model {
  return validateModel({ schemaVersion: 1, name: 'Generated exchange', description: '', source: 'A fully explicit finite exchange.', currency: { label: 'units', decimals: 0 }, resources: [{ id: 'item', label: 'Item', kind: 'item', max: cap }], rules: [{ id: 'trade', text: 'A fully explicit finite exchange.' }], initial: { currency: '20', resources: { item: 0 }, turn: 0 }, maxTurns: turns, assumptions: [], actions: [
    { id: 'buy', label: 'Buy', kind: 'buy', ruleIds: ['trade'], requires: [], currencyDelta: String(-buy), deltas: { item: 1 } },
    { id: 'sell', label: 'Sell', kind: 'sell', ruleIds: ['trade'], requires: [], currencyDelta: String(sell), deltas: { item: -1 } },
  ] });
}
// This intentionally uses a separately written tiny exchange interpreter, not engine transitions.
function reference(buy: number, sell: number, cap: number, turns: number): { max: number; minSteps: number | null; states: number } {
  let frontier = [{ cash: 20, item: 0 }]; let max = 20; let minSteps: number | null = null; let states = 1;
  for (let depth = 1; depth <= turns; depth++) {
    const next: { cash: number; item: number }[] = []; const seen = new Set<string>();
    const add = (cash: number, item: number) => { const key = `${cash},${item}`; if (!seen.has(key)) { seen.add(key); next.push({ cash, item }); if (item === 0) { max = Math.max(max, cash); if (cash > 20 && minSteps === null) minSteps = depth; } } };
    for (const s of frontier) { if (s.cash >= buy && s.item < cap) add(s.cash - buy, s.item + 1); if (s.item > 0) add(s.cash + sell, s.item - 1); }
    states += next.length; frontier = next;
  }
  return { max, minSteps, states };
}
describe('domain boundary and exact state transitions', () => {
  it('validates independent economies with one shared schema', () => { for (const sample of SAMPLES) expect(validateModel(sample.model)).toEqual(sample.model); });
  it('rejects illegal crafting, debt, overcapacity and unknown actions', () => {
    expect(isLegal(LANTERN, LANTERN.initial, 'craft')).toBe(false);
    expect(() => transition(LANTERN, LANTERN.initial, 'craft')).toThrow('Ore lower bound');
    const poor = { ...LANTERN.initial, currency: '0' }; expect(isLegal(LANTERN, poor, 'buy_discount')).toBe(false);
    const bought = transition(LANTERN, LANTERN.initial, 'buy_discount'); expect(isLegal(LANTERN, bought, 'buy_discount')).toBe(false);
    expect(() => transition(LANTERN, LANTERN.initial, 'hack')).toThrow('Unknown action');
  });
  it('never mutates input state or aliases output resources', () => {
    const before = canonical(LANTERN); const after = transition(LANTERN, LANTERN.initial, 'buy_discount'); after.resources.ore = 0;
    expect(canonical(LANTERN)).toBe(before);
  });
  it('uses BigInt beyond Number safe range and formats decimals exactly', () => {
    const model = tiny(1, 2); model.initial.currency = '900719925474099312345';
    const trace = replay(model, ['buy', 'sell']); expect(trace.steps.at(-1)!.after.currency).toBe('900719925474099312346');
    expect(formatMoney('105')).toBe('1.05'); expect(formatMoney('-5')).toBe('−0.05'); expect(formatMoney('1', 6)).toBe('0.000001');
  });
  it('tracks stock and one-time benefits', () => {
    const model = SAMPLES.find(s => s.id === 'ember')!.model;
    const trace = replay(model, ['buy', 'buy', 'convert', 'reward', 'sell']);
    expect(trace.steps.at(-1)!.after.currency).toBe('105'); expect(trace.steps.at(-1)!.after.resources.welcome).toBe(0);
    expect(() => replay(model, ['buy', 'buy', 'convert', 'reward', 'sell', 'buy', 'buy', 'convert', 'reward'])).toThrow('Welcome token lower bound');
    const pearl = SAMPLES.find(s => s.id === 'pearl')!.model;
    expect(() => replay(pearl, ['buy', 'buy', 'buy'])).toThrow();
  });
  it.each([
    (m: Model) => { m.schemaVersion = 2 as 1; },
    (m: Model) => { m.actions[0]!.currencyDelta = '0.1'; },
    (m: Model) => { m.actions[0]!.currencyDelta = '-0'; },
    (m: Model) => { m.actions[0]!.deltas.unknown = 1; },
    (m: Model) => { m.actions[0]!.requires.push({ field: 'turn', op: 'gte', value: '0' }); },
    (m: Model) => { m.rules[0]!.text = 'Unanchored invented clause'; },
    (m: Model) => { m.actions[0]!.ruleIds = ['missing']; },
    (m: Model) => { m.resources.push(m.resources[0]!); },
    (m: Model) => { m.initial.resources.ore = 2; },
    (m: Model) => { delete m.initial.resources.glass; },
    (m: Model) => { (m as unknown as Record<string, unknown>).script = 'alert(1)'; },
  ])('rejects malformed or unsupported models (%#)', mutate => { const model = clone(); mutate(model); expect(() => validateModel(model)).toThrow(); });
  it('canonical hashing is order-insensitive but binds every rule edit', () => {
    const model = clone(); model.initial.resources = Object.fromEntries(Object.entries(model.initial.resources).reverse());
    expect(modelVersion(model)).toBe(modelVersion(LANTERN)); expect(modelVersion(repairLantern())).not.toBe(modelVersion(LANTERN));
    expect(modelVersion(JSON.parse(JSON.stringify(LANTERN)))).toBe(modelVersion(LANTERN));
  });
});
describe('recorded replay, counterexamples and certificates', () => {
  it('replays the original four-rule cycle, including every checked bound', () => {
    const trace = replay(LANTERN, cycle); expect(verifyTrace(LANTERN, JSON.parse(JSON.stringify(trace)))).toEqual(trace);
    expect(trace.steps.map(s => s.after.currency)).toEqual(['200', '200', '500', '1100']);
    expect(trace.steps.every(s => s.checks.every(c => c.passed) && s.ruleIds.length > 0)).toBe(true);
    expect(certifyCycle(LANTERN, trace, true).kind).toBe('repeatable-profit');
  });
  it.each(['currency', 'checks', 'rules', 'parameters', 'version', 'initial', 'engine'])('rejects trace tampering: %s', field => {
    const trace = replay(LANTERN, cycle);
    if (field === 'currency') trace.steps[1]!.after.currency = '999999';
    if (field === 'checks') trace.steps[0]!.checks[0]!.passed = false;
    if (field === 'rules') trace.steps[0]!.ruleIds = ['forge'];
    if (field === 'parameters') (trace.steps[0]!.parameters as Record<string, unknown>).count = 99;
    if (field === 'version') trace.modelVersion = 'm1-wrong';
    if (field === 'initial') trace.initial.currency = '1001';
    if (field === 'engine') trace.engineVersion = '0.0.0';
    expect(() => verifyTrace(LANTERN, trace)).toThrow();
  });
  it('rejects old traces on a new model; patch retains legitimate gameplay', () => {
    const patched = repairLantern(); expect(() => verifyTrace(patched, replay(LANTERN, cycle))).toThrow('different rule-set');
    const trace = replay(patched, cycle); expect(trace.steps.at(-1)!.after.currency).toBe('900');
    expect(verifyCandidate(patched, cycle, DEFAULT_OBJECTIVE, true).accepted).toBe(false);
    expect(search(patched, DEFAULT_OBJECTIVE, DEFAULT_BUDGET, { reviewed: true }).finding).toBeNull();
  });
  it('withholds repeatability for consumed state, turn caps, assumptions, or upper/equality currency guards', () => {
    const model = SAMPLES.find(s => s.id === 'ember')!.model;
    const finite = certifyCycle(model, replay(model, ['buy', 'buy', 'convert', 'reward', 'sell']), true);
    expect(finite.kind).toBe('finite-only');
    for (const mutate of [ (m: Model) => { m.maxTurns = 8; }, (m: Model) => { m.assumptions = ['Reward supply unresolved']; }, (m: Model) => { m.actions[0]!.requires.push({ field: 'currency', op: 'lte', value: '1000' }); }, (m: Model) => { m.actions[0]!.requires.push({ field: 'currency', op: 'eq', value: '1000' }); } ]) {
      const m = clone(); mutate(m); expect(certifyCycle(m, replay(m, cycle), true).kind).toBe('finite-only');
    }
    expect(certifyCycle(LANTERN, replay(LANTERN, cycle), false).kind).toBe('finite-only');
  });
  it('rejects nonprofitable certificates and invalid model-proposed actions', () => {
    expect(certifyCycle(repairLantern(), replay(repairLantern(), cycle), true).kind).toBe('finite-only');
    expect(verifyCandidate(LANTERN, ['reward_free'], DEFAULT_OBJECTIVE).accepted).toBe(false);
    expect(verifyCandidate(LANTERN, ['sell'], DEFAULT_OBJECTIVE).accepted).toBe(false);
  });
  it('repeats a certified cycle at many independently generated balances', () => {
    fc.assert(fc.property(fc.integer({ min: 0, max: 1000000 }), n => {
      const m = clone(); m.initial.currency = (1000n + 100n * BigInt(n)).toString();
      const trace = replay(m, cycle); expect(BigInt(trace.steps.at(-1)!.after.currency) - BigInt(m.initial.currency)).toBe(100n);
      expect(trace.steps.at(-1)!.after.resources).toEqual(m.initial.resources);
    }), { numRuns: 100 });
  });
});
describe('bounded BFS guarantees and failure states', () => {
  it('finds the shortest actual cycle, not a scripted result', () => {
    const result = search(LANTERN, DEFAULT_OBJECTIVE, DEFAULT_BUDGET, { reviewed: true });
    expect(result.status).toBe('found'); expect(result.finding!.trace.steps.map(s => s.actionId)).toEqual(cycle);
    expect(result.finding!.certificate.kind).toBe('repeatable-profit'); expect(result.depthBoundComplete).toBe(false);
  });
  it('distinguishes highest gain from shortest', () => {
    const result = search(LANTERN, objective, { ...DEFAULT_BUDGET, maxDepth: 12 }, { reviewed: true });
    expect(result.depthBoundComplete).toBe(true); expect(result.finding!.gain).toBe('300'); expect(result.finding!.trace.steps.length).toBe(12);
  });
  it('reports finite benefits without claiming repeatability', () => {
    const model = SAMPLES.find(s => s.id === 'ember')!.model;
    const result = search(model, { ...DEFAULT_OBJECTIVE, restoreResources: false }, DEFAULT_BUDGET, { reviewed: true });
    expect(result.finding!.gain).toBe('5'); expect(result.finding!.certificate.kind).toBe('finite-only');
    expect(search(model, DEFAULT_OBJECTIVE, DEFAULT_BUDGET, { reviewed: true }).finding).toBeNull();
  });
  it('exhausts a complete finite negative economy', () => {
    const m = SAMPLES.find(s => s.id === 'pearl')!.model;
    const result = search(m, objective, { ...DEFAULT_BUDGET, maxDepth: 6 });
    expect(result.status).toBe('exhausted'); expect(result.finding).toBeNull(); expect(result.progress.frontier).toBe(0);
  });
  it('does not call state or time budgets completed searches', () => {
    const limited = search(LANTERN, objective, { ...DEFAULT_BUDGET, maxStates: 2 }); expect(limited.status).toBe('state-limit'); expect(limited.depthBoundComplete).toBe(false);
    let tick = 0; const timed = search(LANTERN, objective, { ...DEFAULT_BUDGET, maxMilliseconds: 2 }, { now: () => tick++ }); expect(timed.status).toBe('time-limit');
    expect(search(LANTERN, objective, DEFAULT_BUDGET, { isCancelled: () => true }).status).toBe('cancelled');
  });
  it('retains verified partial gains without optimality claims', () => {
    const result = search(LANTERN, objective, { ...DEFAULT_BUDGET, maxStates: 7 }, { reviewed: true });
    expect(result.status).toBe('state-limit'); expect(result.finding!.gain).toBe('100'); expect(result.depthBoundComplete).toBe(false);
  });
  it('does not let a longer model suggestion break shortest-path guarantees', () => {
    const result = search(LANTERN, DEFAULT_OBJECTIVE, DEFAULT_BUDGET, { candidates: [[...cycle, ...cycle], ['sell']] });
    expect(result.finding!.trace.steps.length).toBe(4); expect(result.candidateResults!.map(c => c.accepted)).toEqual([true, false]);
  });
  it('matches independent exhaustive reference on 150 generated tiny worlds', () => {
    fc.assert(fc.property(fc.integer({ min: 1, max: 8 }), fc.integer({ min: 1, max: 8 }), fc.integer({ min: 1, max: 3 }), fc.integer({ min: 1, max: 8 }), (buy, sell, cap, turns) => {
      const m = tiny(buy, sell, cap, turns); const expected = reference(buy, sell, cap, turns);
      const result = search(m, objective, { ...DEFAULT_BUDGET, maxDepth: turns });
      expect(result.status).toBe('exhausted'); expect(Number(result.finding?.gain ?? '0')).toBe(expected.max - 20); expect(result.progress.discovered).toBe(expected.states);
      const shortest = search(m, DEFAULT_OBJECTIVE, { ...DEFAULT_BUDGET, maxDepth: turns }); expect(shortest.finding?.trace.steps.length ?? null).toBe(expected.minSteps);
    }), { numRuns: 150, seed: 20260918 });
  });
  it('conserves assets in fair exchanges over generated legal paths', () => {
    fc.assert(fc.property(fc.array(fc.boolean(), { maxLength: 30 }), choices => {
      const m = tiny(3, 3, 3, null); let state = m.initial;
      for (const choice of choices) { const action = choice ? 'buy' : 'sell'; if (enumerateActions(m, state).some(a => a.id === action)) state = transition(m, state, action); expect(BigInt(state.currency) + BigInt(state.resources.item!) * 3n).toBe(20n); }
    }), { numRuns: 100 });
  });
});
describe('portable evidence', () => {
  const evidence = () => ({ schemaVersion: 1, model: LANTERN, reviewed: true, result: search(LANTERN, DEFAULT_OBJECTIVE, DEFAULT_BUDGET, { reviewed: true }), createdAt: new Date().toISOString() });
  it('verifies exported evidence independently of the UI, including coverage rerun', () => { const result = verifyEvidence(JSON.parse(JSON.stringify(evidence())), { rerunCoverage: true }); expect(result.verifiedFinding!.certificate.kind).toBe('repeatable-profit'); expect(result.coverage).toContain('Shortest'); });
  it('rejects fake certificates, objective changes, wrong versions and false exhaustion', () => {
    const changed = evidence(); changed.result.finding!.certificate.gain = '999'; expect(() => verifyEvidence(changed)).toThrow('certificate');
    const objectiveChanged = evidence(); objectiveChanged.result.objective = { ...DEFAULT_OBJECTIVE, minGain: '999' }; expect(() => verifyEvidence(objectiveChanged)).toThrow('objective');
    const wrongVersion = evidence(); wrongVersion.result.engineVersion = 'unknown'; expect(() => verifyEvidence(wrongVersion)).toThrow();
    const falseCoverage = evidence(); falseCoverage.result.depthBoundComplete = true; expect(() => verifyEvidence(falseCoverage)).toThrow('Exhaustion');
    expect(ENGINE_VERSION).toBe('1.0.0');
  });
});
