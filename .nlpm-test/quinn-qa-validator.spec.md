---
artifact: .claude/agents/quinn-qa-validator.md
type: agent
min_score: 90
---

## Triggers On
- "Run the deploy gate"
- "Validate scenarios.js before release"
- "Is this batch ready to deploy?"

## Does Not Trigger On
- "Fix the duplicate id" (routes back to → maya-curriculum-designer)
- "Rewrite the Chinese" (→ nina-native-editor)

## Output Contains
- `Owner: Quinn`
- A pass/veto decision with exact failing items and their routes
- `Handoff:` naming the owner of any failure, or "none — ready for deploy gate"

## Frontmatter Valid
- `name: quinn-qa-validator`
- `model: sonnet`
- `skills:` includes `scenario-schema-validation`
- `tools:` includes `Bash`, no `Agent(` delegation (terminal leaf)
