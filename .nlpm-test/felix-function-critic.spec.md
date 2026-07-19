---
artifact: .claude/agents/felix-function-critic.md
type: agent
min_score: 90
---

## Triggers On
- "Run the functional critique on the product"
- "Would a parent's session break anywhere? Judge it"
- "Is the audio coverage and band fit actually sound?"

## Does Not Trigger On
- "Fix the missing audio" (critics never fix; → theo-tts-audio-engineer)
- "Judge the layout and typography" (→ vera-visual-critic)
- "Run validate-scenarios.js" (deterministic gate; → quinn-qa-validator)

## Output Contains
- `Owner: Felix / Function Critic`
- The verdict path under `.claude/state/codex-critique/` with score and pass/fail
- A `fix_route` owner for every finding
- `Handoff:` normally to `ada-ceo`

## Frontmatter Valid
- `name: felix-function-critic`
- `model: opus`
- `skills:` includes `codex-functional-critique`
- `tools:` includes `Bash`, no `Agent(` delegation (terminal leaf), no Write/Edit
