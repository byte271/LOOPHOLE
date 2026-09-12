import type { Budget, Model, Objective, State } from './model';
export type Check = { label: string; passed: boolean; actual: string; expected: string };
export type TraceStep = { index: number; actionId: string; parameters: Record<string, never>; ruleIds: string[]; checks: Check[]; before: State; after: State };
export type Trace = { schemaVersion: 1; engineVersion: string; modelVersion: string; initial: State; steps: TraceStep[] };
export type Certificate = { kind: 'repeatable-profit'; gain: string; argument: string[] } | { kind: 'finite-only'; gain: string; reasons: string[] };
export type Finding = { trace: Trace; gain: string; certificate: Certificate; provisional: boolean; objective: Objective };
export type SearchProgress = { explored: number; discovered: number; frontier: number; depth: number; elapsedMs: number };
export type SearchResult = {
  status: 'found' | 'exhausted' | 'state-limit' | 'time-limit' | 'numeric-limit' | 'cancelled' | 'failed';
  finding: Finding | null; progress: SearchProgress; budget: Budget; objective: Objective;
  modelVersion: string; engineVersion: string; message: string; depthBoundComplete: boolean;
  candidateResults?: { actionIds: string[]; accepted: boolean; reason: string }[];
};
export type Evidence = { schemaVersion: 1; model: Model; reviewed: boolean; result: SearchResult; createdAt: string };
export type SearchRequest = { runId: string; model: Model; objective: Objective; budget: Budget; reviewed: boolean; candidates?: string[][] };
export type WorkerResponse = { runId: string; type: 'progress'; progress: SearchProgress } | { runId: string; type: 'result'; result: SearchResult } | { runId: string; type: 'error'; message: string };
export type TraceExplanation = { explanation: string; suggestedChanges: string[]; citedSteps: number[]; usage: Interpretation['usage'] };
export type Interpretation = { model: Model | null; ambiguities: string[]; strategies: { title: string; actionIds: string[]; rationale: string }[]; explanation: string; suggestedChanges: string[]; usage: { inputTokens: number; outputTokens: number; estimatedCostUsd: string; model: string } | null };
