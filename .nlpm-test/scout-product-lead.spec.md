---
artifact: .claude/agents/scout-product-lead.md
type: agent
min_score: 90
---

## Triggers On
- "Plan the next LittleLingos scenario"
- "What should we build next, and who owns it?"
- "Scope a doctor-visit scenario across all bands"

## Does Not Trigger On
- "Is this English natural?" (→ leo-linguist)
- "Generate the audio for these phrases" (→ theo-tts-audio-engineer)

## Output Contains
- `Owner: Scout`
- `Handoff:` naming a direct child agent
- A routing decision, not authored content

## Frontmatter Valid
- `name: scout-product-lead`
- `description:` with a `Use when` trigger
- `model: opus`
- `tools:` includes `Agent(maya-curriculum-designer)` and `Agent(quinn-qa-validator)`
