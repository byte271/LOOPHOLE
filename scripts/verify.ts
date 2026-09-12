import { readFile, stat } from 'node:fs/promises';
import { verifyEvidence } from '../src/engine/evidence';
const path = process.argv[2];
if (!path) { console.error('Usage: npm run verify -- path/to/evidence.json [--coverage]'); process.exitCode = 2; }
else {
  try {
    if ((await stat(path)).size > 2_000_000) throw new Error('Evidence exceeds 2 MB input limit.');
    const result = verifyEvidence(JSON.parse(await readFile(path, 'utf8')), { rerunCoverage: process.argv.includes('--coverage') });
    console.log(JSON.stringify({ valid: true, modelVersion: result.evidence.result.modelVersion, engineVersion: result.evidence.result.engineVersion, gain: result.verifiedFinding?.gain ?? null, certificate: result.verifiedFinding?.certificate.kind ?? null, provisional: result.verifiedFinding?.provisional ?? null, coverage: result.coverage, scope: 'Interpreted model only. Review is a user attestation, not proof of prose fidelity.' }, null, 2));
  } catch (error) { console.error(JSON.stringify({ valid: false, error: error instanceof Error ? error.message : 'Invalid evidence.' })); process.exitCode = 1; }
}
