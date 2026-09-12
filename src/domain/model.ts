import { z } from 'zod';
import { sha256 } from '@noble/hashes/sha2.js';
import { bytesToHex } from '@noble/hashes/utils.js';

export const ENGINE_VERSION = '1.0.0';
const id = z.string().regex(/^[a-z][a-z0-9_]{0,39}$/);
export const amount = z.string().regex(/^(0|[1-9][0-9]*|-[1-9][0-9]*)$/).max(256);
const nonnegativeAmount = amount.refine(v => !v.startsWith('-'), 'Must be nonnegative');
const resourceRecord = (minimum: number) => z.preprocess((input, ctx) => {
  if (input && typeof input === 'object' && ['__proto__', 'constructor', 'prototype'].some(key => Object.hasOwn(input, key))) {
    ctx.addIssue({ code: 'custom', message: 'Reserved resource key is forbidden.' });
    return z.NEVER;
  }
  return input;
}, z.record(z.string(), z.number().int().min(minimum).max(1_000_000)));
export const ResourceSchema = z.object({ id, label: z.string().min(1).max(80), kind: z.enum(['item', 'stock', 'flag', 'counter']), max: z.number().int().min(1).max(1_000_000) }).strict();
export const StateSchema = z.object({ currency: nonnegativeAmount, resources: resourceRecord(0), turn: z.number().int().min(0).max(1_000_000) }).strict();
export const GuardSchema = z.object({ field: z.string().min(1).max(40), op: z.enum(['gte', 'lte', 'eq']), value: amount }).strict();
export const ActionSchema = z.object({
  id, label: z.string().min(1).max(100), kind: z.enum(['buy', 'craft', 'reward', 'sell', 'convert', 'other']),
  ruleIds: z.array(id).min(1).max(16), requires: z.array(GuardSchema).max(32),
  currencyDelta: amount, deltas: resourceRecord(-1_000_000),
}).strict();
export const ModelSchema = z.object({
  schemaVersion: z.literal(1), name: z.string().min(1).max(100), description: z.string().max(1000),
  source: z.string().min(1).max(30000), currency: z.object({ label: z.string().min(1).max(30), decimals: z.number().int().min(0).max(6) }).strict(),
  resources: z.array(ResourceSchema).max(24), rules: z.array(z.object({ id, text: z.string().min(1).max(4000) }).strict()).min(1).max(48),
  actions: z.array(ActionSchema).min(1).max(48), initial: StateSchema,
  maxTurns: z.number().int().min(1).max(1_000_000).nullable(),
  assumptions: z.array(z.string().min(1).max(1000)).max(24),
}).strict();
export type Model = z.infer<typeof ModelSchema>;
export type State = z.infer<typeof StateSchema>;
export type Action = z.infer<typeof ActionSchema>;
export type Guard = z.infer<typeof GuardSchema>;
export const ObjectiveSchema = z.object({ mode: z.enum(['shortest', 'highest-gain']), minGain: nonnegativeAmount.refine(v => v !== '0', 'Gain must be positive'), restoreResources: z.boolean() }).strict();
export type Objective = z.infer<typeof ObjectiveSchema>;
export const BudgetSchema = z.object({ maxDepth: z.number().int().min(1).max(40), maxStates: z.number().int().min(1).max(100000), maxMilliseconds: z.number().int().min(1).max(15000) }).strict();
export type Budget = z.infer<typeof BudgetSchema>;
export const DEFAULT_OBJECTIVE: Objective = { mode: 'shortest', minGain: '1', restoreResources: true };
export const DEFAULT_BUDGET: Budget = { maxDepth: 12, maxStates: 20000, maxMilliseconds: 5000 };
export class DomainError extends Error { constructor(public code: string, message: string) { super(message); this.name = 'DomainError'; } }
export function canonical(value: unknown): string {
  if (value === null || typeof value !== 'object') return JSON.stringify(value);
  if (Array.isArray(value)) return '[' + value.map(canonical).join(',') + ']';
  return '{' + Object.entries(value).sort(([a], [b]) => a < b ? -1 : a > b ? 1 : 0).map(([k, v]) => JSON.stringify(k) + ':' + canonical(v)).join(',') + '}';
}
export function modelVersion(model: Model): string { return 'm1-' + bytesToHex(sha256(new TextEncoder().encode(canonical(model)))); }
export function validateState(model: Model, state: State): State {
  const result = StateSchema.parse(state);
  const keys = model.resources.map(r => r.id).sort();
  if (canonical(keys) !== canonical(Object.keys(result.resources).sort())) throw new DomainError('STATE_FIELDS', 'State must declare exactly every resource.');
  for (const r of model.resources) if (result.resources[r.id]! > r.max) throw new DomainError('RESOURCE_BOUND', `${r.label} exceeds capacity.`);
  if (model.maxTurns !== null && result.turn > model.maxTurns) throw new DomainError('TURN_BOUND', 'Starting turn exceeds turn limit.');
  return result;
}
export function validateModel(input: unknown): Model {
  const model = ModelSchema.parse(input);
  const unique = (values: string[], kind: string) => { if (new Set(values).size !== values.length) throw new DomainError('DUPLICATE_ID', `Duplicate ${kind} ID.`); };
  unique(model.resources.map(r => r.id), 'resource'); unique(model.rules.map(r => r.id), 'rule'); unique(model.actions.map(a => a.id), 'action');
  if (model.resources.some(r => ['currency', 'turn', '__proto__', 'constructor', 'prototype'].includes(r.id))) throw new DomainError('RESERVED_FIELD', 'Reserved resource name.');
  const resources = new Set(model.resources.map(r => r.id)); const rules = new Set(model.rules.map(r => r.id));
  for (const rule of model.rules) if (!model.source.includes(rule.text)) throw new DomainError('SOURCE_REFERENCE', `Rule ${rule.id} is not an exact excerpt of the original source.`);
  for (const action of model.actions) {
    unique(action.ruleIds, 'action rule');
    if (action.ruleIds.some(r => !rules.has(r))) throw new DomainError('UNKNOWN_RULE', `Unknown rule in ${action.id}.`);
    if (Object.keys(action.deltas).some(r => !resources.has(r))) throw new DomainError('UNKNOWN_RESOURCE', `Unknown effect resource in ${action.id}.`);
    for (const guard of action.requires) if (guard.field !== 'currency' && !resources.has(guard.field)) throw new DomainError('UNKNOWN_RESOURCE', `Unknown guard field ${guard.field}.`);
  }
  validateState(model, model.initial);
  return model;
}
export function formatMoney(value: string, decimals = 2): string {
  const n = BigInt(value); const digits = (n < 0n ? -n : n).toString().padStart(decimals + 1, '0');
  return (n < 0n ? '−' : '') + (decimals ? digits.slice(0, -decimals) + '.' + digits.slice(-decimals) : digits);
}
