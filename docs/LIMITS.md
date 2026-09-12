# Limits and release gates

This is a functional local product, not a claim of production-perfect correctness or launch readiness.

## Supported

Small deterministic, turn-based game economies with one exact-integer currency, bounded named resources, explicit action variants, conjunctive eligibility guards, constant additive effects, and explicit turn semantics. Multiple economies use the same engine. Source edits create distinct model hashes. Finite outcomes and supported repeatability proofs are distinct.

## Important nonclaims

- A verified model counterexample is not proof that a real implementation has that flaw.
- A source excerpt match is not proof of accurate interpretation. User review and held-out live evaluations remain necessary.
- No result is “safe.” Exhaustion covers a precise configured depth and only if no operational budget stopped search.
- A legal profitable sequence is not automatically repeatable. Certification is intentionally incomplete and may withhold proofs for genuinely repeatable systems outside its supported class.
- Search certification currently targets a cycle starting at the configured initial state. It does not automatically certify a profitable cycle reached only after a one-time setup path, though finite objectives can discover profitable paths.
- No multi-agent concurrency, stochastic outcomes, arbitrary expressions, code execution, real payments, legal analysis, or implementation instrumentation.
- No hosted private accounts, team permissions, durable server jobs, distributed rate limiting, cloud deployment, leaderboard or Product Hunt submission.
- Challenge snapshots need the same compatible engine version and a reachable hosted origin for remote recipients. A localhost URL only works on the same machine.
- Large snapshots are capped and may not fit all messaging services. Use a JSON export for a durable backup.
- Browser storage is profile-local and can be cleared. In-flight searches are not durable jobs. Reload interrupts them rather than making success up.
- Live provider timeout/cancellation can still incur billed tokens. Local rate and concurrency caps cannot revoke completed provider work. An uncertain request is not automatically retried.
- Engine replay/search numeric representations are finite; unbounded-profit certificates are algebraic statements about the interpreted mathematical model, not a promise to run infinitely many steps on hardware.

## Evidence and release gate reporting

Run `npm test`, `npm run typecheck`, `npm run build`, `npm run evaluate`, `npm run evaluate:live`, and the independent CLI verifier. Browser-test edit/replay/export/share/cancel flows. Read generated evaluation files: a skipped live evaluation is **not** a passing interpretation gate. Before any public launch, run held-out evaluations against actual Astra with credentials, review its failure cases, complete a deployment security review, verify current challenge terms directly, and test on the intended hosting origin.
