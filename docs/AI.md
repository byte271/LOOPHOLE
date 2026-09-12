# AI interpretation and server operations

LOOPHOLE analyzes small, fictional deterministic economies. AI proposes a declarative model and candidate action IDs. It does not verify profit, certify cycles, review a model on the user's behalf, execute source instructions or inspect a running implementation. Real payment, legal and software exploit requests are outside this interpreter's scope.

## Setup

Use Node 22.12 or newer. From the repository root:

```sh
npm install
npm run dev
```

Without a server-side `OPENAI_API_KEY`, the rest of the application remains available, `GET /api/status` reports `configured:false`, and interpretation returns HTTP 503 with code `AI_UNAVAILABLE`. There is no simulated AI prose or substitute model output.

For AI, put these values in an uncommitted `.env` file, or supply them as environment variables:

```dotenv
OPENAI_API_KEY=your-own-key
OPENAI_MODEL=gpt-6-astra
HOST=127.0.0.1
PORT=3001
# Required whenever HOST is not loopback; also required operationally behind a public proxy.
# LOOPHOLE_ACCESS_TOKEN=your-own-long-random-token
```

The server loads `.env` using guarded `process.loadEnvFile`. Existing environment variables take precedence. Missing `.env` is normal. Do not use `VITE_` prefixes for either credential and never commit, export or embed them in a share link.

Production:

```sh
npm run build
NODE_ENV=production npm start
```

When production mode is enabled and `dist/index.html` exists, Express serves the built application and its SPA routes. Otherwise it serves only the API. Default API bind is `127.0.0.1:3001`. Non-loopback `HOST` without `LOOPHOLE_ACCESS_TOKEN` fails startup. Send `Authorization: Bearer <access-token>` on interpretation requests whenever a token is configured, even on loopback.

**Public deployment:** use HTTPS and a strong access token. Do not expose a loopback server through an unauthenticated public reverse proxy or tunnel: it cannot infer the proxy's public exposure. The development command binds Vite to `127.0.0.1`. If you override that binding or expose it through a proxy, set `LOOPHOLE_ACCESS_TOKEN` first; the Vite proxy is a path to the API. This server deliberately does not trust `X-Forwarded-For` or forwarded protocol/host headers; clients behind one proxy share a rate bucket. Configure trusted TLS/origin termination explicitly in a deployment integration rather than weakening origin validation.

## HTTP contract

- `GET /api/status` returns `{configured:boolean, model:string, requiresToken:boolean}`. It does not disclose credentials or contact OpenAI.
- `POST /api/interpret` accepts only JSON `{source:string, requestId:uuid}` and returns the domain `Interpretation`: nullable model, ambiguities, strategies, explanation, suggestedChanges and nullable server-computed usage.
- `POST /api/explain` accepts `{evidence, requestId:uuid}` under the same authentication, body, concurrency, rate and idempotency limits. The server replays and verifies the finding before any model call. It returns bounded advisory explanation text, suggested source changes, cited step indices and usage. Invalid evidence and absent findings are rejected before charging. Generated narrative never changes the verified certificate.
- Errors have shape `{error:{code,message}}`. Only allowlisted messages leave the server. No raw provider body, stack trace or request credentials are returned.
- Source is 1–30,000 characters and must not be whitespace-only. Bodies are uncompressed UTF-8 JSON, capped at 128 KiB. Unknown request fields, malformed IDs and content types are rejected before a provider call.
- Browser POST origins must match the request host and protocol. Development additionally permits HTTP loopback origins on port 5173, for Vite's `/api` proxy. Production does not permit that exception. Loopback binds reject non-loopback Host headers to reduce DNS-rebinding exposure. CLI requests without Origin are permitted subject to host and token checks. No permissive CORS headers are installed.

## Spend, cancellation and idempotency

Defaults per server process:

| Limit | Value |
| --- | --- |
| Concurrent model calls | 1, no queue |
| New calls per minute | 12 globally, 4 per socket client IP |
| Provider call deadline | 90 seconds, including response reading |
| Provider output | 10,000 output tokens and 1,000,000 response bytes |
| Idempotency receipts | 128 IDs, including successes and failures |
| Active client rate buckets | 1,024, expired after the minute window |

Each accepted UUID is bound to SHA-256 of the request kind and its parsed payload. A repeated ID with changed source or evidence returns 409 `IDEMPOTENCY_MISMATCH`. Same-ID concurrent requests share one promise. Successes and explicit failed states are retained; failed same-ID requests replay the error and **never silently make a new billable call**. `Idempotency-State` is `succeeded` or `failed` once an admitted operation finishes. Busy, rate-limited, invalid and unavailable requests make no call and create no receipt.

Receipts are not evicted or expired during a process lifetime. At capacity, new IDs return 503 `IDEMPOTENCY_CAPACITY`, while existing IDs still work. This favors no accidental rebilling over indefinite uptime. Receipts, source/model data and limits are in process memory only; a restart clears them. Do not resend uncertain old IDs after restart. Multi-instance production requires a shared durable admission/idempotency store before deployment; this release does not provide one.

There are no automatic provider retries, including after rejection, bad JSON, incomplete output, timeout or network failure. When every waiting HTTP client disconnects, the upstream fetch is aborted. Disconnecting one duplicate does not cancel another waiter. Provider-side work or charges may continue after cancellation or a network failure; a timeout is not proof that the request was free. A new user-initiated ID represents a new potentially billable attempt.

## Provider and schema

The provider uses native `fetch` to the fixed `https://api.openai.com/v1/responses` endpoint, with redirects disabled, `store:false`, `reasoning.effort:"medium"`, no tools, and strict `text.format` JSON Schema. No request can choose a base URL, credential or model. `OPENAI_MODEL` is a server-only override and must support the request format; unsupported overrides fail explicitly without falling back or retrying.

The schema derives from the domain Zod model. All object properties are required and extra properties are forbidden. Dynamic resource records are represented in the provider-only wire schema as arrays of `{id,value}`, then checked for duplicate IDs and converted back to domain records. This avoids pretending an arbitrary-key record is an OpenAI strict object schema. The HTTP response uses normal domain records, not wire arrays.

Only completed assistant `output_text` content is parsed; refusal and incomplete responses are not interpreted as successful models. Parsed output passes strict Zod validation plus `validateModel`, which checks source anchors, declared resources, bounds, initial state and cross references. Source must match the submitted text exactly. Every cited rule is an exact source substring. Candidate action IDs must exist, but legality and profit remain the deterministic engine's responsibility. Unresolved output ambiguities are unioned into `model.assumptions`, preventing definitive findings. Nullable `maxTurns` is required; missing material semantics or unsupported rules should produce a null model rather than invented rules.

The system prompt treats source prose as untrusted data, requests cross-clause guards, finite stock and reward eligibility, exact integer minor-unit currency, complete initial resources, and explicit ambiguities. Prompt isolation and schema checks do **not** establish semantic correctness or prevent all model hallucinations. Human review remains necessary. A syntactically valid omitted restriction can still change the interpreted economy.

Usage is read from the provider response envelope, never from generated text. For `gpt-6-astra`, the estimate uses $10 per million input tokens and $50 per million output tokens, with six decimal places. It does not model caching discounts, cache-write charges, alternative service tiers, taxes or future price changes, and is not an invoice. Usage is null when absent or when a model override has unverified pricing.

Official references checked during implementation:

- [GPT-6 Astra model, Responses support, structured output, reasoning levels and pricing](https://developers.openai.com/api/docs/models/gpt-6-astra)
- [Create a Responses API response](https://developers.openai.com/api/reference/resources/responses/methods/create)
- [Strict structured output format and schema rules](https://developers.openai.com/api/docs/guides/structured-outputs.md)

## Tests and held-out evaluation

`npx vitest run tests/provider.test.ts` uses mocked provider fetches and real ephemeral local HTTP servers. It exercises schema shape, strict/malformed outputs, injected source separation, source references, missing and unknown keys, candidate references, exact amounts, missing credentials, access control, origin checks, rate and size limits, timeout/cancellation and idempotency. These are boundary tests, **not live-model accuracy results**.

`evals/held-out.json` contains six authored prose cases not embedded in the provider prompt: a renewable profit cycle, a one-time reward trap, membership-discount conversion with cross-clause guards, a finite-stock losing market, exact fractional currency and underspecified rules. Expectations were written before any live call. They include scale, starting balance, action deltas, finite resource consumption, discount guards, conversion consumption and expected profit at depth six. These are small fictional benchmarks, not an independently sampled corpus, and are not a comprehensive semantic oracle. Once published here, they are held out from the prompt, not secret from developers.

```sh
npm run evaluate:live
```

The command writes `evals/live-results.json` and prints a machine-readable report. With no key, status is `skipped`, completed cases are zero and accuracy metrics are null. This is not a pass. Live evaluation has **not** been completed in the keyless implementation environment.

With a key, the evaluator makes at most six actual sequential calls, reserves a conservative maximum $5 total estimate using UTF-8 input bytes plus framing allowance and the output-token cap, and stops on uncertain failures without retrying. It runs only the verified default model. Reservation is not a provider billing guarantee; use provider project spend controls as an additional boundary. Each explicitly launched evaluation is a new billable run.

The report separates authored semantic assertion accuracy from legal replay and objective acceptance. It independently calls engine `replay`, `verifyTrace`, `verifyCandidate` and bounded `search`; candidate replay does not become its own ground truth. Metrics include usage, estimated and reserved cost, case coverage, ambiguity counts, candidate legal/accepted counts, per-call/search latency and authored-negative false positives. Search runs at depth six with 20,000 states and two seconds. No human review is simulated, so findings remain provisional. Inspect coverage and each assertion, not only a percentage: failures, unsupported cases and budget-skipped cases are not passing results, and one authored negative case cannot establish a general false-positive rate.
