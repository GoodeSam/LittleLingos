---
artifact: .claude/agents/maya-curriculum-designer.md
type: agent
min_score: 90
---

## Triggers On
- "Write the phrases for the doctor-visit scenario"
- "Extend the park scenario's 2-3 band"
- "Add tier and why/next/fallback to these phrases"

## Does Not Trigger On
- "Confirm this English is native parent-speak" (→ leo-linguist)
- "Run the deploy gate" (→ quinn-qa-validator)

## Output Contains
- `Owner: Maya`
- Phrase objects with `id`/`en`/`zh`/`tip`
- `Handoff:` to `leo-linguist` and/or `nina-native-editor`

## Frontmatter Valid
- `name: maya-curriculum-designer`
- `model: opus`
- `skills:` includes `phrase-authoring`
- `tools:` includes `Agent(leo-linguist)` and `Agent(nina-native-editor)`
