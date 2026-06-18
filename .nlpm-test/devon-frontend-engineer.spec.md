---
artifact: .claude/agents/devon-frontend-engineer.md
type: agent
min_score: 90
---

## Triggers On
- "Add a slow-playback button for the 0-1 band"
- "Bump the service-worker cache version"
- "Fix how phrases render on mobile"

## Does Not Trigger On
- "Write a new phrase" (→ maya-curriculum-designer)
- "Generate audio" (→ theo-tts-audio-engineer)

## Output Contains
- `Owner: Devon`
- Files changed + the new cache version
- `Handoff:` to `quinn-qa-validator`

## Frontmatter Valid
- `name: devon-frontend-engineer`
- `model: sonnet`
- `tools:` includes `Bash`, no `Agent(` delegation (leaf)
