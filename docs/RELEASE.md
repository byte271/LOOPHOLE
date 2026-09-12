# Release verification report

Verified September 12, 2026 in the supplied Linux sandbox using Node.js 26.7.0. This report distinguishes a working local application from unverified public-launch gates.

## Working and exercised

- Original Lantern Guild economy: actual BFS finds the four-action cycle `buy_discount → craft → claim → sell`, gaining exactly 100 minor units (1.00 crown) and restoring all named resources. A replay-checked monotone induction certifies repeatability in the interpreted mathematical model.
- Patched economy: reducing the maker reward to 1.00 retains legal purchasing, crafting, reward claiming and resale, but the original sequence ends at 9.00 rather than 11.00. Fresh depth-bounded search finds no counterexample. The UI's optional zero-reward patch was also exercised; it invalidates profit without disabling gameplay.
- Independent Stillwater and Emberworks economies use the same engine. Emberworks yields a finite 0.05 benefit when full-resource restoration is disabled, with no repeatability certificate.
- Source/model inspection, JSON editing, explicit review, exact initial-state configuration, objectives/budgets, recorded visual replay and guard/rule inspection.
- Version isolation, previous-trace re-execution, private browser persistence, portable evidence exports, deliberate fixed challenge snapshots and editable forks.
- An additional six-resource Counter Garden was entered through the JSON editor during browser testing. Real search cancellation, retry, depth-bounded exhaustion and a 100-state partial result were exercised without freezing the interface.
- The browser-produced Lantern JSON export passed `npm run verify -- <export> --coverage` outside the UI, including a fresh BFS.
- Desktop and 390-pixel mobile layout checked in Chrome. Playback reached the actual fourth recorded action and 11.00 crown balance. Browser error checks were empty.

## Automated results

| Check | Result |
|---|---|
| Strict TypeScript | Pass |
| Vitest | **90 / 90 tests pass** |
| Independent differential tests | 150 generated tiny exchanges per run, matching maximum gain, shortest depth and exact reachable-state count |
| Other property tests | 100 generated certified-cycle balances; 100 generated conservation paths |
| Deterministic economy evaluations | **5 / 5 cases pass** |
| Browser-export replay and coverage verifier | Pass |
| Production client/worker/server build | Pass |
| `npm audit` including development dependencies | 0 reported vulnerabilities at verification time |
| Clean source checkout: `npm ci`, typecheck, tests, build, evidence verification | Pass |
| Clean production startup, HTML, built JavaScript and `/api/status` | Pass |

An adversarial audit identified and led to regression fixes for candidate-metadata forgery, numeric boundary inconsistency, invalid candidate objectives, oversized BigInt refinement work, and raw reserved record keys. No supported-class certificate counterexample was found. This is evidence, not a claim of perfect correctness.

The production build emits nonfatal annotation warnings from the installed Zod package. No checks or warnings are disabled to manufacture a green build.

## Implemented but not live-verified

The server implements `gpt-6-astra` through the official Responses API with strict structured output, source anchoring, ambiguity propagation, strategy proposals, and advisory explanations of engine-verified traces. It has server-only credentials, bounded requests, authentication for non-loopback binding, shared call admission limits, cancellation and idempotency. Mock-provider and actual local HTTP tests exercise these boundaries.

**No `OPENAI_API_KEY` was supplied.** Consequently:

- Actual Astra interpretation of unseen prose and trace narration have not been exercised through this application.
- All six held-out live cases are unrun. `evals/live-results.json` explicitly says `skipped`, with zero calls and null accuracy, not a passing benchmark.
- The acceptance gate for a held-out economy being interpreted by the live provider is open. Configure a key and run `npm run evaluate:live`; inspect failures before considering a public launch.

## Not shipped or claimed

- Public deployment, production multi-tenant accounts, team access, cloud persistence, distributed admission controls, durable server jobs or a leaderboard.
- Product Hunt submission, complete eligibility verification or any prize assurance. Official challenge announcement and available model documentation were checked; comprehensive contest terms were not exposed in the retrieved contest text. See `docs/LAUNCH.md`.
- Correct correspondence between arbitrary prose and a running implementation. Review remains necessary; all findings are model-relative.

## Exact commands

From the extracted `loophole` source directory:

```sh
npm ci
cp .env.example .env
npm run dev
```

Open `http://localhost:5173`. For live AI, set `OPENAI_API_KEY` in the server-only `.env` file and restart. Configure `LOOPHOLE_ACCESS_TOKEN` before any public binding or proxy.

```sh
npm run typecheck
npm test
npm run evaluate
npm run evaluate:live
npm run verify -- examples/lantern-evidence.json --coverage
npm run build
npm start
```

`npm start` serves the production build at `http://127.0.0.1:3001` by default. Stop the development server first if it is already using port 3001. Source, architecture, rule-language specification, tests, samples, evaluation outputs and a complete evidence package are included in the source archive.
