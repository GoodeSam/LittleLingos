#!/usr/bin/env python3
"""Write the canonical Five Pillars block into every agent and skill.

Authoring workflow: drop the two marker lines into a new agent/skill, then run
this script to fill the block. ``scripts/five_pillars.check_sync`` (enforced by
``tests/test_five_pillars_sync.py``) guarantees no copy drifts afterward.
"""

from __future__ import annotations

import re
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
from scripts.five_pillars import START, END, render_block  # noqa: E402

BLOCK_RE = re.compile(re.escape(START) + r".*?" + re.escape(END), re.DOTALL)


def sync(root: Path) -> list[str]:
    block = render_block()
    touched: list[str] = []
    targets = sorted((root / ".claude" / "agents").glob("*.md"))
    targets += sorted((root / ".claude" / "skills").glob("*/SKILL.md"))
    for path in targets:
        text = path.read_text(encoding="utf-8", errors="ignore")
        if START not in text:
            continue
        new = BLOCK_RE.sub(lambda _: block, text)
        if new != text:
            path.write_text(new, encoding="utf-8")
            touched.append(path.relative_to(root).as_posix())
    return touched


if __name__ == "__main__":
    root = Path(__file__).resolve().parents[1]
    changed = sync(root)
    print("Synced:" if changed else "Nothing to sync.")
    for rel in changed:
        print(f"  - {rel}")
