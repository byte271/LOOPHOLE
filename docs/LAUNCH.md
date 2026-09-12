# Launch demo and challenge verification

## A demo based on executable behavior

1. **Show the rules, not a teaser page.** Open The Lantern Guild. Explain the economy's intended objective: no positive currency gain while restoring all non-currency state.
2. **Review the model.** Show the guild seal, maker receipt, uncapped turns, explicit inexhaustible sources, and source-linked guarded actions. Confirm the interpretation only after reviewing those commitments.
3. **Find a loophole.** Run the actual BFS. The UI shows actual discovered/explored counts. The default original economy reaches the objective in four actions, not a manufactured progress animation.
4. **Play the evidence.** The avatar visits the material seller, forge, guild and exchange according to the trace. Step through balances: 10.00 → 2.00 → 2.00 → 5.00 → 11.00. Point out receipt consumption and seal restoration. Every action's guards and limits are inspected.
5. **Explain why it repeats.** All named resources return. Turns are explicitly uncapped and unreadable by guards. Extra currency preserves all currency lower bounds. That is the supported induction, not an inventory-only heuristic.
6. **Change a rule.** Reduce the maker reward to 1.00 in both source and action delta. Show the new content version. The old action sequence remains legal but is no longer an exploit: it loses 1.00. Run a fresh search and state the exact explored depth, not “fixed forever.”
7. **Show a negative and a finite case.** Stillwater exhausts its finite horizon with no gain. Emberworks gives 0.05 once when full resource restoration is disabled; the welcome token is gone and no infinite-profit certificate is issued.
8. **Hand over a proof artifact.** Export JSON and run `npm run verify -- path.json --coverage` in another terminal. Deliberately alter a recorded balance and show verification reject it.
9. **Invite the challenge.** Ask “Can you write an economy LOOPHOLE cannot break?” Explicitly share a pinned snapshot; explain that a recipient forks it to edit.

An Astra segment must use a configured server key and actual unseen prose. Show real ambiguity messages and review the resulting model. If the call fails, show the failure and use the JSON editor. Do not splice in prerecorded interpretation output and call it live.

## Current official references checked during this build

- [OpenAI model documentation](https://developers.openai.com/api/docs/models/gpt-6-astra) confirms `gpt-6-astra`, Responses API support, structured outputs, and the documented standard token prices. The model alias can change underneath it; exports pin engine/model content, while provider usage records the selected alias.
- [OpenAI's challenge announcement](https://community.openai.com/t/gpt-6-astra-challenge-on-product-hunt/1396727), published September 11, 2026, states: build with Astra and launch on Product Hunt by September 18, 2026.
- [Product Hunt's contest page](https://www.producthunt.com/contests/gpt-6-astra-challenge) was reachable, but the text available to this build only exposed its headline and prize summary, not comprehensive eligibility, judging, timezone, legal or submission terms.

These sources do not prove this product has been submitted, qualifies, will win, or is publicly deployed. No prize is promised. Recheck complete official terms and deadline timezone in the intended submission account before making any eligibility or submission claim. Finish live held-out evaluations, hosted security review and real deployment testing before calling the release launch-ready.
