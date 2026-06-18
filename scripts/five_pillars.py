#!/usr/bin/env python3
"""Canonical source of the LittleLingos "Five Pillars" over-rules.

Every agent and every skill embeds an identical copy of the rendered block
between the GENERATED markers. ``scripts/sync_five_pillars.py`` writes the
copies; ``check_sync`` verifies they have not drifted. This mirrors the
GoodeSam project's five-over-rules discipline.
"""

from __future__ import annotations

import re
from pathlib import Path

START = "<!-- GENERATED:five-pillars:start -->"
END = "<!-- GENERATED:five-pillars:end -->"

# The five pillars. Order is load-bearing — the rendered block numbers them.
PILLARS: tuple[tuple[str, str], ...] = (
    (
        "Native speech, never translation.",
        "Every English phrase must be what a native-speaking parent would "
        "actually say to a child in the moment — never a word-for-word "
        "rendering of the Chinese.",
    ),
    (
        "Age governs everything.",
        "Language, sentence length, and the kind of interaction must fit the "
        "child's age band (0-1, 1-2, 2-3, 3-6). A phrase right for 3-6 can be "
        "wrong for 0-1.",
    ),
    (
        "Actionable in the moment.",
        "Every phrase ships with a parent tip that ties the words to a "
        "physical action or daily routine, so language is learned in context, "
        "not memorized cold.",
    ),
    (
        "Bilingual alignment.",
        "The Chinese must carry the same warmth and intent as the English for "
        "the parent reading it — accurate and natural, not literal.",
    ),
    (
        "Clean handoff.",
        "Every deliverable states its age band(s), schema completeness, open "
        "questions, and the next owner.",
    ),
)


def render_block() -> str:
    """Return the full block including the GENERATED markers."""
    lines = [START]
    for idx, (title, body) in enumerate(PILLARS, start=1):
        lines.append(f"{idx}. **{title}** {body}")
    lines.append(END)
    return "\n".join(lines)


def extract_block(text: str) -> str | None:
    """Return the block (markers inclusive) found in ``text`` or ``None``."""
    match = re.search(re.escape(START) + r".*?" + re.escape(END), text, re.DOTALL)
    return match.group(0) if match else None


def check_sync(root: Path) -> tuple[bool, list[str]]:
    """Verify every agent and skill embeds the canonical block verbatim."""
    canonical = render_block()
    errors: list[str] = []
    targets: list[Path] = sorted((root / ".claude" / "agents").glob("*.md"))
    targets += sorted((root / ".claude" / "skills").glob("*/SKILL.md"))
    if not targets:
        return False, ["no agents or skills found to check"]
    for path in targets:
        text = path.read_text(encoding="utf-8", errors="ignore")
        found = extract_block(text)
        rel = path.relative_to(root).as_posix()
        if found is None:
            errors.append(f"{rel}: missing five-pillars GENERATED block")
        elif found.strip() != canonical.strip():
            errors.append(f"{rel}: five-pillars block has drifted from canonical")
    return not errors, errors
