---
artifact: .claude/agents/vera-visual-critic.md
type: agent
min_score: 90
---

## Triggers On
- "Run the appearance critique on the app"
- "Would a parent trust this screen in five seconds? Judge it"
- "Check the layout, contrast, and tap targets strictly"

## Does Not Trigger On
- "Fix the CSS" (critics never fix; → devon-frontend-engineer)
- "Is the data sound / audio covered?" (→ felix-function-critic)
- "Rewrite the tip text" (→ maya-curriculum-designer)

## Output Contains
- `Owner: Vera / Visual Critic`
- The verdict path under `.claude/state/codex-critique/` with score and pass/fail
- A `fix_route` owner for every finding
- `Handoff:` normally to `ada-ceo`

## Frontmatter Valid
- `name: vera-visual-critic`
- `model: opus`
- `skills:` includes `codex-visual-critique`
- `tools:` includes `Bash`, no `Agent(` delegation (terminal leaf), no Write/Edit
