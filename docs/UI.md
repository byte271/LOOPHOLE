# LOOPHOLE client workbench

## Entry points

- `index.html` loads `src/client/main.tsx`.
- `App.tsx` owns the workspace, pinned worker runs, interpretation requests, replay controls, version comparison, and dialogs.
- `EconomyMap.tsx` is a bespoke SVG economy illustration. The Market, Forge, Guild and Exchange are illustrative categories, not inferred game geography. Only recorded trace steps move the avatar or draw an active colored route. Selecting an action merely inspects it.
- `storage.ts` uses the shared engine evidence schema/verifier for local drafts and exports, and owns the bounded challenge-snapshot boundary. There is no separate client implementation of proof verification.
- `styles.css` defines the cream/ink/coral/mint instrument styling, responsive layouts, keyboard focus states, and reduced-motion behavior.

## Using the workspace

1. Choose a sample, read the rulebook, and check **I reviewed this model**. Search is also allowed without review, but findings stay provisional.
2. Choose shortest path or highest gain. Minimum gain is an integer amount in currency minor units. Expand **Search limits** to edit depth, state and millisecond budgets. The starting inventory settings button edits initial-state JSON.
3. **Find a loophole** launches the real worker. Counts are worker observations, not simulated percentages. Cancellation terminates the worker and records an honest cancelled status with the last observed counts.
4. Play, pause, restart, step, or select an individual timeline card. All displayed before/after resources, currency, turns, guards and rule references come from independently verified trace steps.
5. **Try a patch: zero reward** changes an actual reward action, its source clause and rule text. It creates a new unreviewed version, resets replay, and preserves the earlier evidence in History. No patch finding is scripted.
6. **History → Compare trace** replays an old result's action IDs against the current model's initial state. It reports the first illegal action or, if still legal, the recomputed gain and objective satisfaction. Always run a fresh search to test other strategies.

## Source and AI

The Rules tab supports prose editing; the Model tab supports bounded declarative JSON editing and validation. No API key is required for samples, JSON models, worker search, replay, persistence, or evidence export.

`GET /api/status` controls the AI connection indicator. Prose is sent only after **Interpret with AI**, using `POST /api/interpret` with `{source, requestId}` and optional `Authorization: Bearer …`. The masked access token is React state only: it is not persisted, exported, included in a challenge, or logged by the client. Server error messages and unavailable interpretation are surfaced honestly. There is no simulated AI output.

Returned ambiguities are copied into model assumptions, preventing review and certification until explicitly resolved in the model. Strategies are proposals; the worker independently checks their action IDs. Engine candidate acceptance/rejection is displayed alongside the proposal after search. The proof explanation is deterministic. `TraceNarrative.tsx` optionally requests an advisory Astra explanation through `/api/explain` only after a finding exists. That endpoint re-verifies the evidence before any model call. The AI narrative and suggested repairs never replace the engine verdict, are not persisted as proof, and are clearly labeled.

## Persistence and sharing

Local storage key: `loophole.workspace.v1`.

Draft schema version 1 stores the current model, review state, objective, budgets, editable source/JSON text, current pinned evidence, and at most five previous model versions. UTF-8 encoded drafts are limited to 450,000 bytes. Edits autosave after 700 ms; **Save draft** also saves explicitly. Invalid or oversized stored drafts are not silently deleted or overwritten. Recovery errors remain visible, with an option to download the original stored content. An explicit save is required to replace a failed recovery.

A share dialog requires explicit disclosure consent before creating a URL. The `#challenge=` fragment contains a base64url UTF-8 fixed snapshot with schema version, model, objective, budget, engine version and `reviewed: false`. It does not include private history, evidence, AI interaction history, tokens, or server logs. No upload or server publication occurs. The fragment is limited to 100,000 characters and strictly schema-validated. Browser URL limits can be lower.

Recipients get a read-only challenge. It does not overwrite their private draft. **Fork to edit** explicitly creates a private editable draft and removes the fragment. Review resets to false. The original shared link stays unchanged.

**Export evidence** downloads the pinned `{schemaVersion, model, reviewed, result, createdAt}` object after re-verification. Current model edits never become attached to old evidence.

## Verification performed

- `npx tsc --noEmit` passed against the current shared engine/domain/server tree.
- `npx vite build` passed, including the worker bundle.
- Actual engine searches for all four samples, with reviewed true and false, were accepted by the client evidence validator. Lantern produced gain `100`; patched Lantern, Pearl and default resource-restoring Ember exhausted with no finding.
- Node smoke checks passed for local draft round-trip, a fixed unreviewed challenge round-trip, oversize and malformed fragment rejection, corrupt draft recovery failure, and trace-tampering rejection.
- Manual Chrome interaction verified the original profit cycle, single-step replay, an edited reward and old-trace comparison, fresh no-finding analysis, a finite one-time reward, deliberate fixed sharing and editable forks, and a novel six-resource JSON economy with cancellation and retry. Reducing its state budget produced an explicit partial-result state. Browser error checks were empty.

## Boundaries

The visualization uses fixed station categories; arbitrary custom economies are fully searchable but do not generate new geography. Google Fonts is progressive visual enhancement, with system fallbacks when offline. Core functionality does not depend on that request. There is no service worker or offline installation guarantee; offline operation assumes the app assets are already available. Successful search and a replay prove properties of the interpreted model, never correspondence with an actual running economy.
