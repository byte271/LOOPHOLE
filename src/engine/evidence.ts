import { z } from 'zod';
import { amount, BudgetSchema, canonical, DomainError, ENGINE_VERSION, ModelSchema, modelVersion, ObjectiveSchema, validateModel } from '../domain/model';
import type { Evidence, Finding } from '../domain/contracts';
import { certifyCycle, evaluateObjective, TraceSchema, verifyTrace } from './execute';
import { search, searchMessage, verifyCandidate } from './search';
const CertificateSchema = z.discriminatedUnion('kind', [z.object({ kind: z.literal('repeatable-profit'), gain: amount, argument: z.array(z.string().max(2000)).max(12) }).strict(), z.object({ kind: z.literal('finite-only'), gain: amount, reasons: z.array(z.string().max(2000)).max(12) }).strict()]);
const FindingSchema = z.object({ trace: TraceSchema, gain: amount, certificate: CertificateSchema, provisional: z.boolean(), objective: ObjectiveSchema }).strict();
export const EvidenceSchema = z.object({ schemaVersion: z.literal(1), model: ModelSchema, reviewed: z.boolean(), createdAt: z.iso.datetime(), result: z.object({
  status: z.enum(['found', 'exhausted', 'state-limit', 'time-limit', 'numeric-limit', 'cancelled', 'failed']), finding: FindingSchema.nullable(),
  progress: z.object({ explored: z.number().int().nonnegative().max(100000), discovered: z.number().int().nonnegative().max(100000), frontier: z.number().int().nonnegative().max(100000), depth: z.number().int().nonnegative().max(40), elapsedMs: z.number().nonnegative().max(86400000) }).strict(),
  budget: BudgetSchema, objective: ObjectiveSchema, modelVersion: z.string().max(67), engineVersion: z.literal(ENGINE_VERSION), message: z.string().max(4000), depthBoundComplete: z.boolean(),
  candidateResults: z.array(z.object({ actionIds: z.array(z.string().max(40)).max(40), accepted: z.boolean(), reason: z.string().max(4000) }).strict()).max(12).optional(),
}).strict() }).strict();
export function verifyEvidence(input: unknown, options: { rerunCoverage?: boolean } = {}): { evidence: Evidence; verifiedFinding: Finding | null; coverage: string } {
  const evidence = EvidenceSchema.parse(input); const model = validateModel(evidence.model); const { result } = evidence;
  if (result.modelVersion !== modelVersion(model)) throw new DomainError('VERSION_MISMATCH', 'Evidence result does not belong to its model.');
  if (result.depthBoundComplete !== (result.status === 'exhausted')) throw new DomainError('COVERAGE_MISMATCH', 'Exhaustion metadata contradicts the job status.');
  if (result.status === 'found' && !result.finding) throw new DomainError('MISSING_FINDING', 'Found status requires a trace.');
  if (result.status === 'found' && result.objective.mode !== 'shortest') throw new DomainError('OBJECTIVE_MISMATCH', 'Early found status is only valid for the shortest objective.');
  const p = result.progress;
  if (p.explored > p.discovered || p.frontier !== p.discovered - p.explored || p.discovered > result.budget.maxStates || p.depth > result.budget.maxDepth || (result.depthBoundComplete && p.frontier !== 0) || (!['failed', 'cancelled'].includes(result.status) && p.discovered < 1)) throw new DomainError('PROGRESS_MISMATCH', 'Reported progress contradicts structural search bounds.');
  for (const candidate of result.candidateResults ?? []) {
    const verified = verifyCandidate(model, candidate.actionIds, result.objective, evidence.reviewed);
    if (verified.accepted !== candidate.accepted) throw new DomainError('CANDIDATE_MISMATCH', 'A recorded candidate verdict disagrees with fresh verification.');
    candidate.reason = verified.accepted ? 'Candidate independently verified; baseline search still establishes its own objective and limits.' : verified.reason;
  }
  result.message = searchMessage(result.status, !!result.finding);
  const finding = result.finding;
  if (finding) {
    const trace = verifyTrace(model, finding.trace); const end = trace.steps.at(-1)?.after ?? trace.initial;
    if (canonical(finding.objective) !== canonical(result.objective) || !evaluateObjective(model, end, result.objective)) throw new DomainError('OBJECTIVE_MISMATCH', 'Trace does not violate the pinned objective.');
    if (trace.steps.length > result.budget.maxDepth) throw new DomainError('BUDGET_MISMATCH', 'Trace exceeds the stated search depth.');
    if (finding.gain !== (BigInt(end.currency) - BigInt(model.initial.currency)).toString()) throw new DomainError('GAIN_MISMATCH', 'Claimed gain is incorrect.');
    if (finding.provisional !== (!evidence.reviewed || model.assumptions.length > 0)) throw new DomainError('REVIEW_MISMATCH', 'Finding confirmation contradicts model review or assumptions.');
    if (canonical(finding.certificate) !== canonical(certifyCycle(model, trace, evidence.reviewed))) throw new DomainError('CERTIFICATE_MISMATCH', 'The claimed repeatability certificate does not match the proof.');
  }
  let coverage = 'Replay and certificate checked. Reported search coverage and optimality were not independently rerun.';
  if (options.rerunCoverage) {
    const repeated = search(model, result.objective, { ...result.budget, maxMilliseconds: 15000 }, { reviewed: evidence.reviewed });
    if (result.depthBoundComplete && !repeated.depthBoundComplete) throw new DomainError('COVERAGE_NOT_REPRODUCED', 'Could not reproduce exhaustive depth-bounded coverage within the verifier budget.');
    if ((result.depthBoundComplete || result.status === 'found') && (repeated.finding?.gain !== finding?.gain || repeated.finding?.trace.steps.length !== finding?.trace.steps.length)) throw new DomainError('SEARCH_MISMATCH', 'The claimed search outcome could not be reproduced.');
    if ((result.depthBoundComplete || result.status === 'found') && ['explored', 'discovered', 'frontier', 'depth'].some(key => repeated.progress[key as keyof typeof p] !== p[key as keyof typeof p])) throw new DomainError('PROGRESS_NOT_REPRODUCED', 'Reported completed-search counts differ from the fresh deterministic traversal.');
    coverage = repeated.depthBoundComplete ? 'Depth-bounded exhaustive coverage independently rerun.' : repeated.status === 'found' ? 'Shortest counterexample reproduced by a fresh BFS.' : 'Fresh search remains partial; no exhaustive coverage claim.';
  }
  return { evidence, verifiedFinding: finding, coverage };
}
