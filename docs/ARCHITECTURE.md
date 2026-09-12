# Architecture and decisions

## Modular monolith

A React/Vite client and small Express service share a TypeScript domain library. The engine imports only domain types and validation, never React, HTTP, storage or provider code. No microservices, plugin registry, queue broker or database is needed for a single-user local product.

```
Prose -> server-only provider -> validated provisional Model
                                |
JSON editor --------------------+-> explicit review
                                      |
                                      v
                              disposable Search Worker
                           legality -> transition -> BFS
                                      |
                                      v
                              independent trace replay
                              objective + certificate
                                      |
                                      v
                        pinned result -> UI / JSON evidence
```

## Decisions

1. **BigInt with JSON strings.** Exact minor-unit currency, portable JSON and deterministic comparisons. Decimal scale is presentation only. Resource integers stay within a bounded safe range.
2. **Constant-vector rule language.** Deliberately less expressive than generated code. Guard conjunctions and constant effects admit inspectable legality checks and a short, reviewable repeatability argument. Future rule types must add both runtime semantics and proof eligibility tests; they may initially be excluded from certification.
3. **Canonical content versions.** SHA-256 includes source, compiled rules, initial state and metadata. This is conservative: renaming a model invalidates its version too. Trace and export schema versions and engine version are separate compatibility boundaries.
4. **Exact full-state BFS.** No unsound cash dominance. Time is part of the state, so budgeted executions are distinguished. Memory is bounded by a hard node limit, not just a soft time budget. Model suggestions are independently verified and recorded but do not seed the BFS queue, which preserves shortest-depth guarantees.
5. **Worker isolation.** Search cannot block the rendering thread. The UI owns run IDs, termination and a wall-clock watchdog; engine loops additionally check elapsed time and state budgets. A killed Worker cannot emit a completed result. Reloading does not resume an in-flight job as successful.
6. **Client-local persistence.** Private drafts live in versioned, validated browser storage. No implicit upload. Storage is not encrypted against scripts or other users of the same browser profile. Export is the durable portable backup. Unknown schema versions are rejected rather than silently migrated. A future schema needs an explicit migration plus compatibility fixtures; no fictional migration is shipped for a first schema.
7. **Explicit share snapshots.** Fixed challenges include model, initial state, objective, engine version and budgets. Sharing is an intentional URL-fragment copy, not a private access-control mechanism. A recipient can fork, not mutate the pinned challenge. The hosting server does not receive fragments in HTTP requests; recipients and browser history can still see them. No original prompt logs, credentials or other drafts are included.
8. **Local server credentials.** API keys never cross to the client. Provider failures are typed application errors. Rate limits, concurrency limits, input/output caps, timeouts and idempotency bound costs within one process. This is not distributed abuse prevention or multi-user authentication.

## Replay verification

The verifier validates the model and trace schema, recomputes the model version, insists the initial state matches, executes each action, and compares all recorded preconditions, states, parameters and source IDs with fresh execution. Then it recomputes gain, the chosen objective and the certificate. Untrusted prose never supplies the verdict. CLI verification uses the same domain library but no browser, provider or UI metadata. Small-world differential tests use a separately written exchange simulator so the engine is not its sole oracle.

## Repeatability argument

For a certified sequence with gain g > 0, all non-currency resources are restored. The effects are constant vectors. At repetition n, the resource trajectory is identical and every currency balance is its original value plus ng. Lower-bound guards and nonnegative balances remain true. Since uncapped turns cannot be read by guards, the turn increase is irrelevant. Thus induction establishes all later executions over mathematical integer currency. Equality/upper currency guards, turn caps, depleted flags and unresolved assumptions block this proof, rather than being ignored.

## Extending safely

New deterministic actions belong in the schema and execution library, with malformed-input, transition, conservation and trace tests. A new search strategy must retain exact replay as the acceptance gate and state its own optimality/completeness claims. A new provider implements the interpretation boundary, not engine semantics. Saved projects/team access would replace browser persistence with authenticated ownership-aware storage, immutable version records, explicit job lifecycle and recovery. Larger jobs would move the same engine into isolated server workers with per-job CPU/memory limits and a durable queue; neither is pretended to exist here.
