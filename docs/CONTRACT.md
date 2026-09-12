# LOOPHOLE domain contract v1

The model proposes. The engine verifies. This release models small deterministic, turn-based fictional economies, not running implementations. All accepted findings are relative to an explicitly reviewed model.

## Semantic commitments

- Currency is an integer string of minor units, evaluated using BigInt. No currency floats, randomized effects, executable expressions, scripts, network actions, or user code.
- Named non-currency resources encode items, stock, eligibility flags, consumables and counters. Each is an integer from zero through an explicit maximum. Every action is a constant additive vector with explicit conjunctive guards. Conditional prices and rewards are represented by distinct guarded actions, never ambiguous priority rules.
- Every action costs exactly one turn. The turn increases monotonically. A nullable maxTurns explicitly declares whether turns are capped. Turns cannot be read by arbitrary guards; this makes uncapped time semantically inert.
- Currency cannot be negative. Guards reference currency or declared resources with gte/lte/eq. Actions have finite IDs and no runtime parameters; all choices must be enumerated as finite variants. Every action references source clauses that occur literally in the original source. Null stock is never inferred: inexhaustible supply must be stated in source.
- Input runtime validation rejects undeclared fields, duplicate IDs, dangling references, malformed amounts, overlarge models, invalid initial states and unsupported schema versions. No unknown terms are silently compiled. Unresolved assumptions prohibit definitive findings and cycle certification.
- A model version is SHA-256 over canonical semantic model JSON, including its source and initial state. Immutable transitions and complete replay traces bind findings to that version and engine version.

## Objective and search

The objective is an explicitly configured minimum currency gain, optionally requiring restoration of every non-currency resource. Shortest means minimum number of actions from the initial state. Highest gain means maximum among reachable states within an action-depth bound if that bound is fully exhausted; partial exploration never claims global optimality.

Breadth-first graph search uses the entire exact state, including turn and currency, as its deduplication key. No currency dominance or projected-state pruning is permitted. Depth, state, time and numeric-size budgets are operational limits, not economy rules. Stops report their cause. Exhaustion refers only to the stated depth-bounded reachable graph when no operational limit interrupted traversal.

## Certification supported class

A certificate proves a profitable sequence returns every non-currency resource to its starting value, the model is reviewed and has no unresolved assumptions, maxTurns is explicitly null, and each currency guard in the sequence is a lower bound (gte). Effects are constant. Therefore adding the positive gain to the initial currency preserves all guards and resource bounds and shifts every subsequent currency balance by the same amount; induction proves repeatability for mathematical integer currency. A turn is intentionally not restored only when it is uncapped and cannot affect any action. Finite stock and benefit flags cannot be projected away. Currency equality/upper bounds or capped turns withhold the certificate, even when a particular sequence might be repeatable under a stronger proof system.

## Trust boundaries

Trace verification independently executes the action IDs and compares all recorded preconditions, before/after states, references and deltas. It trusts neither the search result nor model prose explanations. Export verification validates the complete schema, version, objective, trace and recomputed certificate. A correctly replayed trace proves a counterexample in this interpreted model only. It does not establish correspondence with a real implementation or guarantee no other exploits after a patch.

Search runs in a disposable browser Worker with explicit caps. Stale results are rejected by run ID and pinned version. Drafts stay in local browser storage. Sharing is an explicit immutable snapshot encoded in a URL fragment, not server publication; recipients can inspect everything in that snapshot. Model credentials stay on the server. AI interpretation is provisional until reviewed; no key means no AI result, not a simulated result.
