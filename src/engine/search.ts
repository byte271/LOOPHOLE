import { z } from 'zod';
import { BudgetSchema, canonical, DomainError, ENGINE_VERSION, modelVersion, ObjectiveSchema, validateModel, type Budget, type Model, type Objective, type State } from '../domain/model';
import type { Finding, SearchProgress, SearchResult } from '../domain/contracts';
import { applyAction, certifyCycle, checkAction, evaluateObjective, replay, verifyTrace } from './execute';

export type SearchOptions = { reviewed?: boolean; onProgress?: (progress: SearchProgress) => void; isCancelled?: () => boolean; candidates?: string[][]; now?: () => number };
type Node = { state: State; parent: number; actionId: string; depth: number };
export const CandidateListSchema = z.array(z.array(z.string().regex(/^[a-z][a-z0-9_]{0,39}$/)).max(40)).max(12);
export function verifyCandidate(model: Model, actionIds: string[], objectiveInput: Objective, reviewed = false): { accepted: true; finding: Finding } | { accepted: false; reason: string } {
  try {
    const objective = ObjectiveSchema.parse(objectiveInput);
    const trace = verifyTrace(model, replay(model, actionIds));
    const final = trace.steps.at(-1)?.after ?? trace.initial;
    if (!evaluateObjective(model, final, objective)) return { accepted: false, reason: 'Legal sequence, but it does not violate the selected objective.' };
    return { accepted: true, finding: { trace, gain: (BigInt(final.currency) - BigInt(model.initial.currency)).toString(), certificate: certifyCycle(model, trace, reviewed), provisional: !reviewed || model.assumptions.length > 0, objective } };
  } catch (error) { return { accepted: false, reason: error instanceof Error ? error.message : 'Candidate verification failed.' }; }
}
export function search(input: Model, objectiveInput: Objective, budgetInput: Budget, options: SearchOptions = {}): SearchResult {
  const model = validateModel(input); const objective = ObjectiveSchema.parse(objectiveInput); const budget = BudgetSchema.parse(budgetInput);
  const now = options.now ?? (() => performance.now()); const start = now();
  const nodes: Node[] = [{ state: structuredClone(model.initial), parent: -1, actionId: '', depth: 0 }];
  const seen = new Set<string>([canonical(model.initial)]);
  let cursor = 0; let explored = 0; let depth = 0; let best = -1; let status: SearchResult['status'] = 'exhausted';
  let lastProgress = start;
  const progress = (): SearchProgress => ({ explored, discovered: nodes.length, frontier: nodes.length - cursor, depth, elapsedMs: Math.max(0, Math.round(now() - start)) });
  const path = (index: number): string[] => { const ids: string[] = []; while (index > 0) { const node = nodes[index]!; ids.push(node.actionId); index = node.parent; } return ids.reverse(); };
  const candidateResults = CandidateListSchema.parse(options.candidates ?? []).map(ids => { const result = verifyCandidate(model, ids, objective, options.reviewed); return { actionIds: ids, accepted: result.accepted, reason: result.accepted ? 'Candidate independently verified; baseline search still establishes its own objective and limits.' : result.reason }; });
  // Candidate paths never seed the queue: that would invalidate the BFS shortest-path guarantee.
  options.onProgress?.(progress());
  outer: while (cursor < nodes.length) {
    if (options.isCancelled?.()) { status = 'cancelled'; break; }
    if (now() - start >= budget.maxMilliseconds) { status = 'time-limit'; break; }
    const index = cursor++; const node = nodes[index]!; depth = node.depth; explored++;
    if (node.depth >= budget.maxDepth) continue;
    for (const action of model.actions) {
      if (options.isCancelled?.()) { status = 'cancelled'; break outer; }
      if (now() - start >= budget.maxMilliseconds) { status = 'time-limit'; break outer; }
      if (!checkAction(model, node.state, action).every(check => check.passed)) continue;
      let state: State;
      try { state = applyAction(node.state, action); }
      catch (error) { if (error instanceof DomainError && error.code === 'NUMERIC_LIMIT') { status = 'numeric-limit'; break outer; } throw error; }
      const key = canonical(state); if (seen.has(key)) continue;
      if (nodes.length >= budget.maxStates) { status = 'state-limit'; break outer; }
      seen.add(key); nodes.push({ state, parent: index, actionId: action.id, depth: node.depth + 1 });
      const next = nodes.length - 1;
      if (evaluateObjective(model, state, objective) && (best < 0 || BigInt(state.currency) > BigInt(nodes[best]!.state.currency))) {
        best = next;
        if (objective.mode === 'shortest') { status = 'found'; break outer; }
      }
    }
    if (explored % 100 === 0 || now() - lastProgress >= 60) { options.onProgress?.(progress()); lastProgress = now(); }
  }
  let finding: Finding | null = null;
  if (best >= 0) {
    const verified = verifyCandidate(model, path(best), objective, options.reviewed);
    if (!verified.accepted) throw new Error(`Internal search/replay disagreement: ${verified.reason}`);
    finding = verified.finding;
  }
  const complete = status === 'exhausted';
  const result: SearchResult = { status, finding, progress: progress(), budget, objective, modelVersion: modelVersion(model), engineVersion: ENGINE_VERSION, message: searchMessage(status, !!finding), depthBoundComplete: complete, candidateResults };
  options.onProgress?.(result.progress);
  return result;
}
export function searchMessage(status: SearchResult['status'], hasFinding: boolean): string {
  const messages: Record<SearchResult['status'], string> = {
    found: 'Verified shortest counterexample. Search stopped at the first objective-satisfying BFS depth.',
    exhausted: hasFinding ? 'Depth-bounded reachable graph exhausted. This is the highest gain under the stated objective and action-depth bound.' : 'No counterexample in the exhaustively explored depth-bounded reachable graph. This does not establish safety beyond that bound.',
    'state-limit': 'State budget reached. Exploration is partial; absence of a finding is not evidence of safety.',
    'time-limit': 'Time budget reached. Search did not finish; any retained finding is verified but not proven optimal.',
    'numeric-limit': 'Numeric representation budget reached. The mathematical state space was not exhausted.',
    cancelled: 'Analysis interrupted by cancellation. Any retained finding is verified; search coverage is incomplete.',
    failed: 'Analysis failed. No completed-search claim is available.',
  };
  return messages[status];
}
