# Idea audit — NEAR Intents Agent API ("Agent Connect")

This repo holds demo/product experiments for the NEAR Intents Agent API. Ideas arrive in chat.
Before any idea touches `docs/`, it gets audited hard through the gates below. Your job is to be
aggressive: most ideas are not actually about Agent Connect, and the audit exists to find out
early.

## Source of truth

The API's source of truth is the skills repo:
<https://github.com/NEAR-Intents-Agent-API/skills>

Before auditing any idea, fetch and read it:

1. `near-intents-agent-api/SKILL.md` — rules, lifecycle, language paths
2. The `references/` files relevant to the idea — at minimum `concepts.md`, `policy.md`,
   `grants.md`, `executions.md`, `architecture.md`, `errors.md`, `status-and-recovery.md`

Hard rules:

- Every capability claim you make while auditing must trace to those docs. Never assume the API
  supports something; look it up or mark it as an open blocker question.
- The hosted API (`https://api.agentsonintents.com`) is mainnet with real funds. Any prototype
  guidance uses small amounts and dedicated owner accounts.
- Facts are your job (fetch docs, check the API), decisions are the user's.

## Audit protocol

Work the audit in rounds, grilling-style:

- Ask numbered questions, one round at a time, each with your recommended answer (`➡️`).
- Wait for answers before the next round. Answers reshape the questions — recompute and continue.
- When a question can be answered by reading the skills repo or the experiments in `docs/`, answer
  it yourself — never ask the user for a fact you can look up.
- Do not write any file until a verdict is reached and the user confirms it.

## The four gates

An idea only passes if it clears all four. Fail fast and say which gate killed it.

### Gate 1 — Relevance kill-test

Would the idea work just as well with a plain API-key wallet or a custodial account?

- If removing owner-signed policies, revocable per-grant tokens, USD budgets, timelocks, approval
  quorums, confidential (shielded) balances, destination whitelists, or the backend/owner/agent
  key separation does not change the demo, the idea fails here.
- Name the load-bearing capability: which specific Agent Connect mechanism does the idea depend on?
- Is the agent actually the autonomous actor transacting inside signed rules — or a mascot on a
  human-driven UI?
- If a load-bearing capability's support in the API is unclear, that is a blocker to resolve, not
  a hope to wave through.

### Gate 2 — Demo target

Concretely visualize the proof:

- The 1-minute video beat-by-beat: what is on screen at 0:00, 0:15, 0:30, 0:45.
- The minimal demo surface: a small UI (chat + wallet-signature moment + result) or a terminal
  script if no UI is needed. No framework tours.
- The single moment where the human *sees* the guardrail bite.

### Gate 3 — Aha test

State the aha in one sentence a skeptical viewer would repeat afterwards.

- If the aha is generic to "agents + crypto" rather than to *policy-governed* agency, it fails.
- The best ahas demonstrate the rule biting live: budget dropped to zero mid-demo, a grant
  revoked, a freeze, an approval prompt, a confidential balance invisible on-chain.

### Gate 4 — Integration seam

Sketch the real-but-simple, isolated prototype:

- Map the roles: who is the partner (`naa_` API key, backend), who is the owner (wallet signature
  in the browser), who is the agent (`ngt_` grant token).
- Name the one artifact: a runnable script, a tiny BFF server, an MCP server exposing
  swap/transfer/quote tools, or a skill for a general agent harness. One artifact, not a platform.
- SDK snippets must compile against the real API; cited constraints come from the skills docs
  (e.g. OW-14, `wallet-busy`, sign-message restrictions, fresh 1Click prices).
- The agent's intelligence is a comment in the snippet; the Agent Connect plumbing is the code.

## Verdicts and routing

- **PASS** — write a new numbered experiment `docs/NN-slug.md` in the house format below, and add
  its row to the table in `docs/README.md`.
- **FAIL** — append a `## [Killed] <idea> — <reason>` section to `docs/additional.md` with one
  paragraph: why it failed and what would have to change.
- **RESHAPE** — the idea survives but must be reframed; agree the reframe with the user, then
  re-run the gates before writing anything.

## Final reply template

Every audit ends its final response with a ready-to-send reply the user can use to open the
conversation with the idea's proposers:

```
here's a synopsis on the idea we discussed, and attached is a run-through audit on the agent
connect docs for how it might work.

The original idea:
<the idea as originally stated, verbatim>

Some adjustments to be most relevant in highlighting the capabilities of Agent Connect:

- <3–5 bullets>
```

Bullet rules — keep it simple, keep the user's voice:

- 3–5 bullets, one sentence each, plain English. No marketing polish, no invented catchphrases.
- Name the specific capability first ("the assets policy", "timelock", "budget",
  "max_actions_per_hour"), then what it does for *this* idea, then why it's stronger or different
  than the original.
- Open questions are stated as open questions ("there's open question on how X would work"),
  never waved through as settled.
- The "attached run-through audit" is the experiment doc on a PASS; on FAIL/RESHAPE it is the
  audit summary from the session.

## House experiment format

Every experiment file (`docs/NN-slug.md`) follows this shape:

````markdown
# Experiment NN — <Title>

**Proposer:** <name>
**Theme:** <Treasury | Commerce | Trading | Infrastructure | Conversational | Security>

## Details

**Build in such a way that…** <one paragraph pitching the demo, ending with the 60-second clip>

**For <actor>, to be able to <capability>.**

**To handle these use cases:**
- <use case>

**Variants (absorbed):** <folded-in ideas, if any>

## Configurations (specific to Agent Connect)

**Whitelist on an agreement that is made:** <the policy/grant shape in prose>

```ts
// compiling SDK snippet; comments show where the agent's intelligence plugs in
```

**Notes / constraints:** <real API blockers, cited from the skills docs>

## Outcomes

- The 60-second demo: <beat-by-beat>
- <the guardrail-bites moment>
- <the thesis the clip sells>
````

After writing to `docs/` (either verdict), run:

```
node scripts/build-experiments-html.mjs
```

to regenerate `docs/index.html`, and confirm it exits cleanly.
