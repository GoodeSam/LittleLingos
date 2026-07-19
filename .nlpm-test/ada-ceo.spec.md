---
artifact: .claude/agents/ada-ceo.md
type: agent
min_score: 90
---

## Triggers On
- "Build me a new supermarket scenario, end to end"
- "Is the product good enough to ship? Run the whole loop"
- Any human request to the crew (single Company-of-One interface)

## Does Not Trigger On
- "Write the phrases for bath time" (Ada routes; → scout-product-lead → maya)
- "Is this English natural?" (→ leo-linguist via the pipeline)
- "Judge the layout" (Ada dispatches → vera-visual-critic, never judges herself)

## Output Contains
- `Owner: Ada / CEO`
- A `Critique:` line with felix + vera scores and the round count
- `Handoff:` per rules/06-handoff-discipline.md

## Frontmatter Valid
- `name: ada-ceo`
- `model: opus`
- `tools:` includes `Agent(scout-product-lead)`, `Agent(felix-function-critic)`, `Agent(vera-visual-critic)` and no Write/Edit/Bash (routes, never builds)
