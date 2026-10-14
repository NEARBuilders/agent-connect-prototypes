# agent-connect-experiments

Demo/product experiments for the [NEAR Intents Agent API](https://github.com/NEAR-Intents-Agent-API/skills)
("Agent Connect") — the API that gives every AI agent its own agent account on NEAR Intents,
governed by rules its owner signs once with their wallet: policies (actions, assets, limits, USD
budgets, timelocks, schedules, approval, freeze), revocable per-agent grant tokens, and
confidential balances.

**The thesis:** give an agent a pool of money it can transact under your direction or
autonomously, knowing it will operate within guardrails you signed.

## Browsing the experiments

Open `docs/index.html` in a browser — a built site of all experiments grouped by theme
(Treasury, Commerce, Trading, Infrastructure, Conversational, Security). The sources are
`docs/NN-slug.md` files, indexed in [`docs/README.md`](docs/README.md). Ideas that didn't make
the main list live in [`docs/additional.md`](docs/additional.md), killed ideas included with
their kill notes.

## The idea audit

Ideas arrive in chat and get audited hard through four gates before they touch `docs/`:

1. **Relevance kill-test** — would the idea work just as well with a plain API-key wallet? If
   removing the signed policies, grants, budgets, timelocks, approvals and confidential balances
   doesn't change the demo, it's not an Agent Connect idea.
2. **Demo target** — the 1-minute video beat-by-beat, the minimal demo surface, and the single
   moment the human *sees* the guardrail bite.
3. **Aha test** — one sentence a skeptical viewer would repeat. Generic "agents + crypto" fails;
   the rule biting live passes.
4. **Integration seam** — the real-but-simple isolated prototype: one artifact (script, tiny
   BFF, MCP server, or skill), compiling SDK snippets, constraints cited from the API docs.

Verdicts: **PASS** → new numbered experiment, **FAIL** → kill note in `additional.md`,
**RESHAPE** → reframe and re-run. The full protocol — including the grilling-style question
rounds and the ready-to-send reply template — is in [AGENTS.md](AGENTS.md).

## Running it yourself

Clone the repo and open it in any AGENTS.md-aware agent harness (opencode, Claude Code, Codex,
Cursor, …). The audit loads automatically — type an idea in chat and the agent will run the
gates, grill you in rounds, and write the verdict to `docs/`.

The audit is also packaged as an installable skill: copy
[`.agents/skills/agent-connect-audit/`](.agents/skills/agent-connect-audit/SKILL.md) into your
own `.agents/skills/` (or `~/.claude/skills/`) to use it outside this repo.

Bundled skills this repo uses (from Matt Pocock's skill set): `grilling` (the round-based
interview protocol), `improve` and `codebase-design` (the aggressive quality bar). They live in
[`.agents/skills/`](.agents/skills).

## Rebuilding the site

```sh
node scripts/build-experiments-html.mjs
```

Regenerates `docs/index.html` from the experiment markdown files. Run it after any write to
`docs/` and confirm it exits cleanly.

## Source of truth

The API's source of truth is the
[skills repo](https://github.com/NEAR-Intents-Agent-API/skills) — start at
`near-intents-agent-api/SKILL.md`, then the `references/` files. The hosted API
(`https://api.agentsonintents.com`) is mainnet with real funds: build with small amounts and
dedicated owner accounts.
