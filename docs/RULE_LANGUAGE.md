# Rule language v1

The executable intermediate representation is strict JSON. `src/domain/model.ts` is its runtime definition. Complete valid files are in `examples/` after `npm run evaluate`. This is deliberately a finite, declarative language, not JavaScript, a general policy language or a sandbox for generated code.

## Model fields

| Field | Meaning |
|---|---|
| `schemaVersion` | Exactly `1`. Unknown versions fail closed. |
| `name`, `description` | Display metadata. |
| `source` | Original untrusted prose, at most 30,000 characters. |
| `currency` | Display label and decimal scale 0–6. Values everywhere else use integer minor units. |
| `resources` | At most 24 named state variables. Kinds `item`, `stock`, `flag`, `counter` affect display, not semantics. Each has an explicit positive integer capacity ≤ 1,000,000. Use max 1 for flags. |
| `rules` | At most 48 source clauses, each with a unique ID and `text` occurring literally in `source`. |
| `actions` | At most 48 finite action variants, described below. |
| `initial` | Exact nonnegative currency string, one integer value for every resource, and a turn counter. Starting state is configurable and part of the model hash. |
| `maxTurns` | A positive integer ceiling, or explicit `null` for uncapped turns. Never silently infer uncapped time. |
| `assumptions` | Unconfirmed interpretations. An empty list is not proof of semantic fidelity; review is still required. |

Resource/rule/action identifiers are lowercase ASCII letters followed by lowercase letters, numbers or underscores, maximum 40 characters. Duplicate and reserved names fail. Unknown properties fail. Source anchoring proves provenance, not that the compiler understood the source correctly.

## Action fields

```json
{
  "id": "buy_discount",
  "label": "Buy with guild seal",
  "kind": "buy",
  "ruleIds": ["market", "limits"],
  "requires": [{"field": "seal", "op": "eq", "value": "1"}],
  "currencyDelta": "-800",
  "deltas": {"ore": 1, "glass": 1, "seal": -1}
}
```

This fragment illustrates an action; a complete model must define all referenced resources and source rules. Guards are a conjunction of `gte`, `lte`, `eq`. A guard field is `currency` or a declared resource. Values are canonical signed integer strings: no exponent notation, decimal point, leading zero or negative zero. Currency uses `BigInt`; no currency computation uses binary floating point.

All effects occur atomically after guards pass. Implicit checks enforce nonnegative currency, each resource's lower bound and capacity, and the turn cap. Every action advances one turn. Only constant integer effects exist. Omitted resource effects are zero. The complete action is rejected if any bound fails; nothing is partially applied. Each replay step records explicit guards and every implicit bound.

Inventory is bounded per item, not by a shared weight formula. Model a shared-slot budget with an additional resource consumed on acquisition and restored on disposal. Finite stock, cooldown phases, eligibility, consumables and action counts similarly require explicit resources and corresponding guards/deltas on every relevant action. This avoids invisible history. No arbitrary temporal expressions or implicit reset exist.

Discounts use separately enumerated guarded action variants. Purchases of quantities one and two are separate actions; parameter enumeration is finite and explicit. Trace parameters are currently `{}` because the selected variant contains every parameter. Rewards that need a prior craft use an explicit receipt flag, not narrative engine memory. One-time rewards consume a nonreplenishable token. Action limits consume a quota or increment a bounded counter.

Currency or stock caps must be explicit. For a currency upper cap C with delta D, add a guard `currency lte C-D` to every positive-currency action. These guards exclude that sequence from the v1 repeatability proof class. Unlimited supply must be stated in source and reviewed; the absence of a stock variable alone never justifies that interpretation.

## Objectives and guarantees

`{mode: "shortest" | "highest-gain", minGain: "1", restoreResources: true}` compares final currency to initial currency and optionally restores **all** resource variables. It does not mean just inventory. Shortest BFS stops at the first satisfying depth. Highest gain exhausts a depth bound unless interrupted by a time, state or numeric budget. Ties follow input action order.

Currency-deduplicated or projected states are not merged. The key includes currency, every resource, and turn. Search budgets never quietly become economy rules. Maximum search configuration: 40 actions deep, 100,000 states, 15 seconds. Runtime amounts are capped at 256 digits and turn representations at 1,000,000 for operational safety; hitting these is an incomplete `numeric-limit`, not a finite-world proof. Cycle certificates reason algebraically over mathematical integers, not infinite runtime storage.

Only positive-gain traces returning all non-currency resources, with uncapped unreadable turns and exclusively lower-bound currency guards, qualify for the v1 repeatability induction. See [the proof contract](CONTRACT.md).

## Prose and editing

Astra proposes this JSON and a separate list of ambiguities and strategies. The adapter validates it before exposing it. The user must review it; source changes do not automatically rewrite verified findings. Editing raw model JSON must update source clauses as well as their compiled effects. A source mismatch is rejected; a semantic mismatch can only be caught by review or external tests. Every changed byte in the canonical model changes the SHA-256 version.

Unsupported: randomness, concurrent agents, hidden external stock, arbitrary functions, percentage rounding without explicit finite alternatives, variable-rate effects, universal quantifiers, refunds without fully specified eligibility, external clocks and cooldowns, running software, real payments, contracts and legal interpretation.
