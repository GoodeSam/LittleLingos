---
artifact: .claude/agents/nina-native-editor.md
type: agent
min_score: 90
---

## Triggers On
- "Polish the Chinese for these phrases"
- "Does the zh match the warmth of the en?"
- "Tighten this English idiom"

## Does Not Trigger On
- "Decide which band this phrase belongs to" (→ maya / leo)
- "Generate the audio" (→ theo-tts-audio-engineer)

## Output Contains
- `Owner: Nina`
- Polished en/zh pairs with a pass/block decision
- `Handoff:` naming the next owner

## Frontmatter Valid
- `name: nina-native-editor`
- `model: sonnet`
- `skills:` includes `bilingual-naturalness-audit`
- `tools:` has no `Agent(` delegation (leaf)
