---
artifact: .claude/agents/leo-linguist.md
type: agent
min_score: 90
---

## Triggers On
- "Is this English what a native parent would say?"
- "Does this phrase fit the 0-1 band?"
- "Audit these phrases for translation-ese"

## Does Not Trigger On
- "Write a new phrase set" (→ maya-curriculum-designer)
- "Polish the Chinese wording" (→ nina-native-editor)

## Output Contains
- `Owner: Leo`
- A findings list with a pass/block decision
- `Handoff:` naming the next owner

## Frontmatter Valid
- `name: leo-linguist`
- `model: opus`
- `skills:` includes `age-appropriateness-audit`
- `tools:` has no `Agent(` delegation (leaf)
