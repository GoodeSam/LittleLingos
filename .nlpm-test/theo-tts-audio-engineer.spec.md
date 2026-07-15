---
artifact: .claude/agents/theo-tts-audio-engineer.md
type: agent
min_score: 90
---

## Triggers On
- "Generate audio for these cleared phrases"
- "Do the 0-1 phrases have slow word-by-word audio?"
- "Report audio coverage gaps"

## Does Not Trigger On
- "Rewrite this phrase" (→ maya-curriculum-designer)
- "Run the deploy gate" (→ quinn-qa-validator)

## Output Contains
- `Owner: Theo`
- Files written + a coverage table (id → normal? slow_wbw?)
- `Handoff:` to `quinn-qa-validator`

## Frontmatter Valid
- `name: theo-tts-audio-engineer`
- `model: sonnet`
- `skills:` includes `tts-audio-generation`
- `tools:` includes `Bash`, no `Agent(` delegation (leaf)
