#!/usr/bin/env python3
"""Validate the cross-reference fabric that binds the LittleLingos crew.

This is the enforcement engine for the "everything references everything"
requirement. It checks, across ``.claude/agents``, ``.claude/skills`` and
``.claude/rules``:

1. Every ``skills:`` entry in an agent resolves to a real
   ``.claude/skills/<name>/SKILL.md``.
2. Every skill is referenced by at least one agent (no orphan skills).
3. Every ``rules/NN-*.md`` path cited in any agent or skill body exists.
4. Every rule file is cited by at least one agent or skill (no orphan rules).
5. The role-map rule (``02-role-map.md``) names every agent.
"""

from __future__ import annotations

import argparse
import re
from pathlib import Path

SKILLS_BLOCK_RE = re.compile(r"^skills:\s*$(.*?)(?=^\S|\Z)", re.MULTILINE | re.DOTALL)
SKILL_ITEM_RE = re.compile(r"^\s*-\s*([a-z0-9-]+)\s*$", re.MULTILINE)
RULE_REF_RE = re.compile(r"(?:rules/)?(\d{2}-[a-z0-9-]+)\.md")
ROLE_MAP_RULE = "02-role-map"


def _frontmatter(text: str) -> str:
    lines = text.splitlines()
    if not lines or lines[0].strip() != "---":
        return ""
    for idx in range(1, len(lines)):
        if lines[idx].strip() == "---":
            return "\n".join(lines[1:idx])
    return ""


def _agent_skills(text: str) -> list[str]:
    fm = _frontmatter(text)
    block = SKILLS_BLOCK_RE.search(fm + "\n\nEND")
    if not block:
        return []
    return SKILL_ITEM_RE.findall(block.group(1))


def _agent_name(text: str) -> str | None:
    match = re.search(r"^name:\s*(.+?)\s*$", _frontmatter(text), re.MULTILINE)
    return match.group(1).strip() if match else None


def check_references(root: Path) -> tuple[bool, list[str]]:
    errors: list[str] = []
    agents_dir = root / ".claude" / "agents"
    skills_dir = root / ".claude" / "skills"
    rules_dir = root / ".claude" / "rules"

    agent_files = sorted(agents_dir.glob("*.md"))
    skill_dirs = sorted(p for p in skills_dir.glob("*") if (p / "SKILL.md").exists())
    rule_files = sorted(rules_dir.glob("*.md"))

    if not agent_files:
        return False, ["no agent files found"]

    existing_skills = {p.name for p in skill_dirs}
    existing_rules = {p.stem for p in rule_files}

    referenced_skills: set[str] = set()
    referenced_rules: set[str] = set()
    agent_names: list[str] = []

    # 1. agent -> skills resolve
    for path in agent_files:
        text = path.read_text(encoding="utf-8", errors="ignore")
        name = _agent_name(text)
        if name:
            agent_names.append(name)
        rel = path.relative_to(root).as_posix()
        for skill in _agent_skills(text):
            referenced_skills.add(skill)
            if skill not in existing_skills:
                errors.append(f"{rel}: references missing skill `{skill}`")
        for rule in RULE_REF_RE.findall(text):
            referenced_rules.add(rule)
            if rule not in existing_rules:
                errors.append(f"{rel}: cites missing rule `{rule}.md`")

    # rules cited inside skill bodies
    for sdir in skill_dirs:
        text = (sdir / "SKILL.md").read_text(encoding="utf-8", errors="ignore")
        rel = (sdir / "SKILL.md").relative_to(root).as_posix()
        for rule in RULE_REF_RE.findall(text):
            referenced_rules.add(rule)
            if rule not in existing_rules:
                errors.append(f"{rel}: cites missing rule `{rule}.md`")

    # 2. no orphan skills
    for skill in sorted(existing_skills - referenced_skills):
        errors.append(f"orphan skill `{skill}`: not referenced by any agent")

    # 4. no orphan rules (00-five-pillars is foundational; skip the orphan test
    #    for it since it is embedded, not cited by path)
    for rule in sorted(existing_rules - referenced_rules):
        if rule.startswith("00-"):
            continue
        errors.append(f"orphan rule `{rule}.md`: not cited by any agent or skill")

    # 5. role-map names every agent
    role_map = rules_dir / f"{ROLE_MAP_RULE}.md"
    if role_map.exists():
        rm_text = role_map.read_text(encoding="utf-8", errors="ignore")
        for name in agent_names:
            if name not in rm_text:
                errors.append(f"{ROLE_MAP_RULE}.md: does not name agent `{name}`")
    else:
        errors.append(f"missing role-map rule `{ROLE_MAP_RULE}.md`")

    return not errors, errors


def _cli(argv: list[str] | None = None) -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--root", type=Path, default=Path("."))
    args = parser.parse_args(argv)
    passed, errors = check_references(args.root)
    if passed:
        print("PASS: cross-reference fabric is intact.")
        return 0
    print("FAIL: cross-reference issues found.")
    for error in errors:
        print(f"  - {error}")
    return 1


if __name__ == "__main__":
    raise SystemExit(_cli())
