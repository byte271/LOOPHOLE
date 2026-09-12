import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { resolve } from 'node:path';
import { interpret, ApiError, DEFAULT_MODEL, OUTPUT_JSON_SCHEMA, SYSTEM_PROMPT, MAX_OUTPUT_TOKENS } from '../src/server/provider';
import { replay, verifyTrace } from '../src/engine/execute';
import { search, verifyCandidate } from '../src/engine/search';
import type { Interpretation } from '../src/domain/contracts';
import type { Objective } from '../src/domain/model';

type Expected = { model: boolean; ambiguitiesMin: number; ambiguitiesMax?: number; decimals?: number; initialCurrency?: string; currencyDeltas?: string[]; maxGainAtDepth6?: string; restoreResources: boolean; hasProfit?: boolean; consumedFiniteResource?: boolean; crossClauseDiscountGuards?: boolean; conversionConsumesTwo?: boolean };
type Case = { id: string; category: string; source: string; expected: Expected };
const cases = JSON.parse(await readFile(new URL('../evals/held-out.json', import.meta.url), 'utf8')) as Case[];
const outputPath = resolve('evals/live-results.json');
const started = performance.now();
const modelName = process.env.OPENAI_MODEL?.trim() || DEFAULT_MODEL;
const apiKey = process.env.OPENAI_API_KEY?.trim();
const maxSpendUsd = 5;
const report: Record<string, unknown> = { schemaVersion: 1, createdAt: new Date().toISOString(), status: 'skipped', model: modelName, scope: 'Fictional authored held-out prose. Not independent external ground truth.', limits: { maxCalls: 6, maxSpendUsd, maxOutputTokens: MAX_OUTPUT_TOKENS, timeoutMs: 90000, searchDepth: 6, searchStates: 20000, searchMilliseconds: 2000 }, cases: [] };
const results: Record<string, unknown>[] = [];
let reservedUsd = 0; let inputTokens = 0; let outputTokens = 0; let actualEstimatedCost = 0;
let passedAssertions = 0; let totalAssertions = 0; let acceptedCandidates = 0; let totalCandidates = 0; let replayPassed = 0;
let completed = 0; let ambiguityCount = 0; let positiveCases = 0; let falsePositiveCases = 0; let negativeCases = 0; let missingUsage = 0;
function assess(test: Case, answer: Interpretation) {
  const assertions: { name: string; passed: boolean }[] = [];
  const check = (name: string, passed: boolean) => assertions.push({ name, passed });
  const expected = test.expected; const model = answer.model;
  check('model support decision', !!model === expected.model);
  check('minimum ambiguity count', answer.ambiguities.length >= expected.ambiguitiesMin);
  if (expected.ambiguitiesMax !== undefined) check('maximum ambiguity count', answer.ambiguities.length <= expected.ambiguitiesMax);
  const objective: Objective = { mode: 'highest-gain', minGain: '1', restoreResources: expected.restoreResources };
  let engine: unknown = null;
  if (expected.model) check('expected model available for semantic assertions', !!model);
  if (model) {
    check('all ambiguities prohibit definitive findings', answer.ambiguities.every(a => model.assumptions.includes(a)));
    if (expected.decimals !== undefined) check('exact currency scale', model.currency.decimals === expected.decimals);
    if (expected.initialCurrency !== undefined) check('initial currency', model.initial.currency === expected.initialCurrency);
    if (expected.currencyDeltas) check('exact action currency deltas', JSON.stringify([...new Set(model.actions.map(a => a.currencyDelta))].sort()) === JSON.stringify([...new Set(expected.currencyDeltas)].sort()));
    if (expected.consumedFiniteResource) check('finite nonrenewable resource consumed', model.resources.some(r => model.initial.resources[r.id]! > 0 && model.actions.some(a => (a.deltas[r.id] ?? 0) < 0) && model.actions.every(a => (a.deltas[r.id] ?? 0) <= 0)));
    if (expected.conversionConsumesTwo) check('conversion consumes two units', model.actions.some(a => a.kind === 'convert' && Object.values(a.deltas).includes(-2)));
    if (expected.crossClauseDiscountGuards) check('discount has complementary membership guards', model.actions.some(a => a.currencyDelta === '-150' && a.requires.some(g => g.field !== 'currency' && g.op === 'eq' && g.value === '1' && model.actions.some(b => b.currencyDelta === '-200' && b.requires.some(h => h.field === g.field && h.op === 'eq' && h.value === '0')))));
    const candidates = answer.strategies.map(strategy => {
      totalCandidates++;
      let legalReplay = false;
      try { verifyTrace(model, replay(model, strategy.actionIds)); legalReplay = true; replayPassed++; } catch { /* Illegal candidates are measured, not promoted to findings. */ }
      const verification = verifyCandidate(model, strategy.actionIds, objective, false);
      if (verification.accepted) acceptedCandidates++;
      return { actionIds: strategy.actionIds, legalReplay, objectiveAccepted: verification.accepted };
    });
    const searchStarted = performance.now();
    const result = search(model, objective, { maxDepth: 6, maxStates: 20000, maxMilliseconds: 2000 }, { reviewed: false });
    const gain = result.finding?.gain ?? '0';
    if (expected.maxGainAtDepth6 !== undefined) check('authored expected maximum gain at depth six', result.depthBoundComplete && gain === expected.maxGainAtDepth6);
    if (expected.hasProfit !== undefined) {
      const prediction = !!result.finding;
      check('authored expected profitable sequence existence', prediction === expected.hasProfit && (prediction || result.depthBoundComplete));
      if (expected.hasProfit) positiveCases++; else { negativeCases++; if (prediction || candidates.some(c => c.objectiveAccepted)) falsePositiveCases++; }
    }
    engine = { candidates, searchStatus: result.status, depthBoundComplete: result.depthBoundComplete, highestGain: gain, progress: result.progress, searchElapsedMs: performance.now() - searchStarted,
      findingTraceReplayPassed: result.finding ? !!verifyTrace(model, result.finding.trace) : null, certificate: result.finding?.certificate.kind ?? null, reviewed: false };
  }
  totalAssertions += assertions.length; passedAssertions += assertions.filter(a => a.passed).length;
  return { assertions, assertionAccuracy: assertions.filter(a => a.passed).length / assertions.length, engine };
}
if (!apiKey) report.reason = 'OPENAI_API_KEY is not configured. No model calls were made; this is not a passing evaluation.';
else if (modelName !== DEFAULT_MODEL) report.reason = 'Live evaluation is limited to gpt-6-astra because other model pricing is not verified.';
else {
  report.status = 'completed';
  for (const test of cases.slice(0, 6)) {
    // UTF-8 bytes plus framing allowance conservatively reserve input spend; this is not an invoice guarantee.
    const reservedInputTokens = Buffer.byteLength(JSON.stringify({ source: test.source, schema: OUTPUT_JSON_SCHEMA, system: SYSTEM_PROMPT }), 'utf8') + 4096;
    const reservation = (reservedInputTokens * 10 + MAX_OUTPUT_TOKENS * 50) / 1000000;
    if (reservedUsd + reservation > maxSpendUsd) { report.status = 'partial'; results.push({ id: test.id, status: 'skipped', reason: 'Conservative cost reservation exceeds run budget.' }); break; }
    reservedUsd += reservation;
    const callStarted = performance.now();
    try {
      const answer = await interpret(test.source, new AbortController().signal, { apiKey, model: modelName });
      completed++; ambiguityCount += answer.ambiguities.length;
      if (answer.usage) { inputTokens += answer.usage.inputTokens; outputTokens += answer.usage.outputTokens; actualEstimatedCost += Number(answer.usage.estimatedCostUsd); } else missingUsage++;
      results.push({ id: test.id, category: test.category, status: 'completed', providerElapsedMs: performance.now() - callStarted, usage: answer.usage, ambiguities: answer.ambiguities, interpretation: answer, ...assess(test, answer) });
      if (actualEstimatedCost > reservedUsd) { report.status = 'partial'; report.reason = 'Reported usage exceeded conservative reservation; stopped before another call.'; break; }
    } catch (error) {
      report.status = 'partial';
      results.push({ id: test.id, status: 'failed', errorCode: error instanceof ApiError ? error.code : 'EVALUATION_FAILED', providerElapsedMs: performance.now() - callStarted, billingUncertain: true });
      report.reason = 'Stopped after an uncertain failure. No automatic retry or additional model calls.'; break;
    }
  }
}
report.cases = results;
report.metrics = { casesPlanned: cases.length, casesCompleted: completed, inputTokens, outputTokens, estimatedCostUsd: actualEstimatedCost.toFixed(6), conservativeReservedUsd: reservedUsd.toFixed(6), missingUsageResponses: missingUsage,
  assertionsPassed: passedAssertions, assertionsTotal: totalAssertions, assertionAccuracy: totalAssertions ? passedAssertions / totalAssertions : null,
  candidates: totalCandidates, candidatesLegalReplay: replayPassed, candidatesObjectiveAccepted: acceptedCandidates, candidateAcceptanceRate: totalCandidates ? acceptedCandidates / totalCandidates : null,
  ambiguities: ambiguityCount, authoredPositiveCasesAssessed: positiveCases, authoredNegativeCasesAssessed: negativeCases, authoredFalsePositiveCases: falsePositiveCases, authoredFalsePositiveRate: negativeCases ? falsePositiveCases / negativeCases : null,
  elapsedMs: performance.now() - started,
};
report.limitations = ['Schema validity and legal replay are not interpretation accuracy.', 'Semantic assertions were authored before live execution and are separate from replay; they are not exhaustive source correspondence checks.', 'No human review is simulated. All search results remain provisional.', 'Missing, failed or cost-skipped cases are not passing cases. Inspect case coverage alongside assertion accuracy.', 'Cost reservation is conservative, not a provider billing guarantee. Failed/cancelled calls may incur unreported costs.', 'In-memory server idempotency does not cover separate evaluation runs. Each explicitly launched run can incur new charges.'];
await mkdir(resolve('evals'), { recursive: true });
await writeFile(outputPath, JSON.stringify(report, null, 2) + '\n');
console.log(JSON.stringify(report, null, 2));
if (report.status === 'partial' || (totalAssertions > 0 && passedAssertions !== totalAssertions)) process.exitCode = 1;
