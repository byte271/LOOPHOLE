import { z } from 'zod';
import { canonical, DomainError, ENGINE_VERSION, modelVersion, StateSchema, validateModel, validateState, type Action, type Model, type Objective, type State } from '../domain/model';
import type { Certificate, Check, Trace, TraceStep } from '../domain/contracts';

const CheckSchema = z.object({ label: z.string().max(160), passed: z.boolean(), actual: z.string().max(258), expected: z.string().max(264) }).strict();
export const TraceSchema = z.object({ schemaVersion: z.literal(1), engineVersion: z.literal(ENGINE_VERSION), modelVersion: z.string().max(67), initial: StateSchema, steps: z.array(z.object({ index: z.number().int().min(0).max(39), actionId: z.string().max(40), parameters: z.object({}).strict(), ruleIds: z.array(z.string().max(40)).max(16), checks: z.array(CheckSchema).max(82), before: StateSchema, after: StateSchema }).strict()).max(40) }).strict();

export function checkAction(model: Model, state: State, action: Action): Check[] {
  const checks: Check[] = [];
  const check = (label: string, actual: bigint, op: 'gte' | 'lte' | 'eq', expected: bigint) => checks.push({ label, passed: op === 'gte' ? actual >= expected : op === 'lte' ? actual <= expected : actual === expected, actual: actual.toString(), expected: `${op} ${expected}` });
  for (const guard of action.requires) check(guard.field, guard.field === 'currency' ? BigInt(state.currency) : BigInt(state.resources[guard.field]!), guard.op, BigInt(guard.value));
  check('Currency stays nonnegative', BigInt(state.currency) + BigInt(action.currencyDelta), 'gte', 0n);
  for (const resource of model.resources) {
    const after = BigInt(state.resources[resource.id]!) + BigInt(action.deltas[resource.id] ?? 0);
    check(`${resource.label} lower bound`, after, 'gte', 0n);
    check(`${resource.label} capacity`, after, 'lte', BigInt(resource.max));
  }
  if (model.maxTurns !== null) check('Turn limit', BigInt(state.turn + 1), 'lte', BigInt(model.maxTurns));
  return checks;
}
export function isLegal(model: Model, state: State, actionId: string): boolean {
  const action = model.actions.find(a => a.id === actionId);
  return !!action && checkAction(model, state, action).every(c => c.passed);
}
export function enumerateActions(model: Model, state: State): Action[] { return model.actions.filter(action => checkAction(model, state, action).every(c => c.passed)); }
export function transition(model: Model, state: State, actionId: string): State {
  const action = model.actions.find(a => a.id === actionId);
  if (!action) throw new DomainError('UNKNOWN_ACTION', `Unknown action: ${actionId}.`);
  const failed = checkAction(model, state, action).find(c => !c.passed);
  if (failed) throw new DomainError('ILLEGAL_ACTION', `${action.label}: ${failed.label} is ${failed.actual}, needs ${failed.expected}.`);
  return applyAction(state, action);
}
export function applyAction(state: State, action: Action): State {
  const next = { currency: (BigInt(state.currency) + BigInt(action.currencyDelta)).toString(), resources: Object.fromEntries(Object.entries(state.resources).map(([id, value]) => [id, value + (action.deltas[id] ?? 0)])), turn: state.turn + 1 };
  if (next.currency.length > 256 || next.turn > 1_000_000) throw new DomainError('NUMERIC_LIMIT', 'Operational numeric representation limit reached, not a mathematical economy limit.');
  return next;
}
export function evaluateObjective(model: Model, state: State, objective: Objective): boolean {
  return BigInt(state.currency) - BigInt(model.initial.currency) >= BigInt(objective.minGain) && (!objective.restoreResources || canonical(state.resources) === canonical(model.initial.resources));
}
export function replay(input: Model, actionIds: string[], initial?: State): Trace {
  const model = validateModel(input);
  if (actionIds.length > 40) throw new DomainError('TRACE_LIMIT', 'Replay is limited to 40 actions in engine v1.');
  let state = validateState(model, initial ?? model.initial);
  const trace: Trace = { schemaVersion: 1, engineVersion: ENGINE_VERSION, modelVersion: modelVersion(model), initial: structuredClone(state), steps: [] };
  actionIds.forEach((actionId, index) => {
    const action = model.actions.find(a => a.id === actionId);
    if (!action) throw new DomainError('UNKNOWN_ACTION', `Step ${index + 1}: unknown action ${actionId}.`);
    const checks = checkAction(model, state, action);
    const failed = checks.find(c => !c.passed);
    if (failed) throw new DomainError('ILLEGAL_ACTION', `Step ${index + 1} (${action.label}): ${failed.label} is ${failed.actual}, needs ${failed.expected}.`);
    const after = applyAction(state, action);
    const step: TraceStep = { index, actionId, parameters: {}, ruleIds: [...action.ruleIds], checks, before: state, after };
    trace.steps.push(step); state = after;
  });
  return trace;
}
export function verifyTrace(model: Model, input: Trace): Trace {
  const trace = TraceSchema.parse(input);
  if (trace.modelVersion !== modelVersion(validateModel(model))) throw new DomainError('VERSION_MISMATCH', 'Trace belongs to a different rule-set version.');
  if (canonical(trace.initial) !== canonical(model.initial)) throw new DomainError('INITIAL_MISMATCH', 'Trace initial state does not match the pinned model.');
  const verified = replay(model, trace.steps.map(step => step.actionId));
  if (canonical(trace) !== canonical(verified)) throw new DomainError('TRACE_TAMPERED', 'Recorded states, preconditions, parameters or rule references differ from deterministic replay.');
  return verified;
}
export function certifyCycle(model: Model, input: Trace, reviewed: boolean): Certificate {
  const trace = verifyTrace(model, input); const end = trace.steps.at(-1)?.after ?? trace.initial;
  const gain = (BigInt(end.currency) - BigInt(trace.initial.currency)).toString();
  const reasons: string[] = [];
  if (BigInt(gain) <= 0n) reasons.push('The sequence has no positive net currency gain.');
  if (!reviewed || model.assumptions.length) reasons.push('The interpreted model is unconfirmed or has unresolved assumptions.');
  if (canonical(end.resources) !== canonical(trace.initial.resources)) reasons.push('Non-currency state is not restored, including stock, eligibility, benefits and counters.');
  if (model.maxTurns !== null) reasons.push('A finite turn cap eventually blocks repetition.');
  if (trace.steps.some(step => model.actions.find(a => a.id === step.actionId)!.requires.some(g => g.field === 'currency' && g.op !== 'gte'))) reasons.push('A currency equality or upper-bound guard lies outside the monotone proof class.');
  if (reasons.length) return { kind: 'finite-only', gain, reasons };
  return { kind: 'repeatable-profit', gain, argument: [
    `Each execution gains ${gain} minor units. Every named non-currency resource returns exactly to its initial value.`,
    'All effects are constant integer deltas. The only currency guards used are lower bounds; extra currency preserves them and nonnegative balances.',
    'All stock, eligibility, reward and consumption state is explicit and restored. Resource guards and capacities therefore repeat unchanged.',
    'Turns are explicitly uncapped and no action can read them. Their monotone increase cannot block a later iteration.',
    'By induction, iteration n starts with the same resources and initial currency plus n times the gain, and executes the same legal sequence. This is an unbounded-profit proof over mathematical integers in this reviewed model, not a claim about a real implementation.',
  ] };
}
