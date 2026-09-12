# LOOPHOLE

**You wrote the rules. It found the infinite-money glitch.**

An executable workspace for finding counterexamples in small, deterministic fictional game economies. The model proposes; the engine verifies. A claim is always about the reviewed interpretation, never automatically about a running implementation.

## Verification status

The local application, 90 deterministic/boundary tests, production build, clean-install setup and portable evidence verifier passed. Live Astra evaluations are explicitly **skipped** until a server key is configured. See the [release verification report](docs/RELEASE.md) for measured results and open launch gates.

## Run locally

Requires Node.js 22.12+ and npm. Node.js 26 was used for verification.

```sh
npm ci
cp .env.example .env
npm run dev
```

Open **http://localhost:5173**. Four built-in economies, model editing, search, replay, version comparison and evidence exports work without credentials. Add `OPENAI_API_KEY` to `.env` and restart to enable actual Astra interpretation of prose. Never put an API key in the browser or share it in a challenge.

```sh
npm run typecheck
npm test
npm run evaluate
npm run evaluate:live
npm run build
npm start
```

Production serves the built app at **http://127.0.0.1:3001** by default. This is a single-user local release, not an authenticated multi-tenant hosted service. Before exposing a network deployment, read [the provider and security notes](docs/AI.md); require an access token, TLS and an appropriate reverse proxy. Public launch readiness is not asserted.

## Try the complete deterministic workflow

1. Open **The Lantern Guild**, inspect its rules and executable model, and confirm the interpretation.
2. Find a loophole with the default shortest/restored-state objective. The actual BFS finds four actions: spend the guild seal to buy a bundle, craft a lantern, claim the maker reward and restored seal, sell the lantern.
3. Step through the recorded trace: **10.00 → 2.00 → 2.00 → 5.00 → 11.00 crowns**. Every named non-currency resource is restored. Read the repeatability proof.
4. Edit the maker reward from **3.00 to 1.00**, updating both its source clause and action delta, or load the patched sample. The old sequence remains legal but ends at **9.00**, so it no longer violates the objective. Fresh analysis checks other paths. Legitimate crafting and resale still work.
5. Compare pinned versions and export the evidence. Verify without the UI:

```sh
npm run verify -- examples/lantern-evidence.json --coverage
```

The default verifier independently re-executes the trace and certificate. `--coverage` also runs a fresh bounded BFS. It does not establish that the prose was interpreted correctly: review remains an explicit human attestation.

For **Emberworks**, turn off full resource restoration to find the 0.05 one-time benefit. Its depleted welcome token blocks a repeatability certificate. **Stillwater** is a finite, no-profit negative control; a six-turn depth budget covers its entire reachable execution horizon.

## Source map

- `src/domain`: strict runtime schemas, exact amounts, canonical hashes, contracts.
- `src/engine`: deterministic legality/transitions, replay verifier, supported cycle proof, BFS, evidence verifier, isolated browser worker.
- `src/samples`: original independent economies. No sample-specific branches in the engine.
- `src/server`: server-only Astra adapter and bounded HTTP service.
- `src/client`: source/model editor, map and trace replay, jobs, storage and challenge snapshots.
- `scripts`: CLI evidence verification and deterministic/live evaluations.
- `tests`: behavioral, property-based, differential and provider-boundary tests.

Read [the domain contract](docs/CONTRACT.md), [rule language](docs/RULE_LANGUAGE.md), [architecture](docs/ARCHITECTURE.md), [limits](docs/LIMITS.md), and [launch demo](docs/LAUNCH.md).

## Verification and honesty

`evals/deterministic-results.json` contains actual search measurements and replay checks for maintained regression cases. `evals/live-results.json` records live held-out interpretation outcomes or an explicit skipped result if credentials are absent. Mock-provider tests verify our adapter, not Astra's ability to interpret unseen rules. No-counterexample results name depth, state and time limits; they never mean “safe.”

Private drafts are local to this browser, not backed up or synchronized. Deliberate challenge sharing creates a pinned URL-fragment snapshot visible to every recipient; no server publishing, account access or leaderboard is claimed. Fork a challenge to edit it. Localhost links are not internet-hosted links.
