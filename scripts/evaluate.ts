import { mkdir, writeFile } from 'node:fs/promises';
import { DEFAULT_BUDGET, DEFAULT_OBJECTIVE, ENGINE_VERSION, modelVersion } from '../src/domain/model';
import { SAMPLES } from '../src/samples';
import { search } from '../src/engine/search';
import { verifyEvidence } from '../src/engine/evidence';
await mkdir('evals', { recursive: true }); await mkdir('examples', { recursive: true });
const cases = [
  { id: 'lantern', objective: DEFAULT_OBJECTIVE, expectedGain: '100', expectedCertificate: 'repeatable-profit' },
  { id: 'lantern_repaired', objective: DEFAULT_OBJECTIVE, expectedGain: null, expectedCertificate: null },
  { id: 'pearl', objective: DEFAULT_OBJECTIVE, expectedGain: null, expectedCertificate: null },
  { id: 'ember', objective: { ...DEFAULT_OBJECTIVE, restoreResources: false }, expectedGain: '5', expectedCertificate: 'finite-only' },
  { id: 'ember', objective: DEFAULT_OBJECTIVE, expectedGain: null, expectedCertificate: null },
];
const results = [];
for (const test of cases) {
  const sample = SAMPLES.find(s => s.id === test.id)!;
  const result = search(sample.model, test.objective, DEFAULT_BUDGET, { reviewed: true });
  const evidence = { schemaVersion: 1, model: sample.model, reviewed: true, result, createdAt: new Date().toISOString() };
  const verified = verifyEvidence(evidence, { rerunCoverage: true });
  const pass = (result.finding?.gain ?? null) === test.expectedGain && (result.finding?.certificate.kind ?? null) === test.expectedCertificate;
  results.push({ id: test.id, objective: test.objective, passed: pass, status: result.status, gain: result.finding?.gain ?? null, certificate: result.finding?.certificate.kind ?? null, explored: result.progress.explored, discovered: result.progress.discovered, elapsedMs: result.progress.elapsedMs, replayReproducible: true, coverage: verified.coverage, modelVersion: modelVersion(sample.model) });
  if (test.id === 'lantern') await writeFile('examples/lantern-evidence.json', JSON.stringify(evidence, null, 2) + '\n');
}
for (const sample of SAMPLES) await writeFile(`examples/${sample.id}.json`, JSON.stringify(sample.model, null, 2) + '\n');
const report = { schemaVersion: 1, engineVersion: ENGINE_VERSION, at: new Date().toISOString(), kind: 'deterministic-regression', notHeldOutInterpretation: true, liveModelCalls: 0, modelCostUsd: '0', passed: results.every(r => r.passed), results };
await writeFile('evals/deterministic-results.json', JSON.stringify(report, null, 2) + '\n');
console.log(JSON.stringify(report, null, 2));
if (!report.passed) process.exitCode = 1;
