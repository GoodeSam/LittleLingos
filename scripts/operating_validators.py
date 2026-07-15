#!/usr/bin/env python3
"""Shared validators for agent frontmatter and phrase-schema integrity.

Used by both the PostToolUse hooks and the pytest suite so the hook and the
test agree on a single definition of "valid". Mirrors GoodeSam's
``scripts/operating_validators.py`` split.
"""

from __future__ import annotations

import re
from pathlib import Path

SLUG_RE = re.compile(r"^[a-z0-9-]+$")
REQUIRED_AGENT_FIELDS = ("name", "description", "tools", "model")
VALID_MODELS = {"opus", "sonnet", "haiku"}


def frontmatter(text: str) -> str:
    lines = text.splitlines()
    if not lines or lines[0].strip() != "---":
        return ""
    for idx in range(1, len(lines)):
        if lines[idx].strip() == "---":
            return "\n".join(lines[1:idx])
    return ""


def validate_agent_frontmatter(text: str) -> list[str]:
    """Return a list of issues with an agent file's frontmatter (empty = ok)."""
    issues: list[str] = []
    fm = frontmatter(text)
    if not fm:
        return ["missing YAML frontmatter"]

    fields: dict[str, str] = {}
    for line in fm.splitlines():
        m = re.match(r"^([a-zA-Z_]+):\s*(.*)$", line)
        if m:
            fields[m.group(1)] = m.group(2).strip()

    for field in REQUIRED_AGENT_FIELDS:
        if field not in fields:
            issues.append(f"missing `{field}`")

    name = fields.get("name", "")
    if name and not SLUG_RE.match(name):
        issues.append("`name` must be lowercase letters, digits, and hyphens only")

    model = fields.get("model", "")
    if model and model not in VALID_MODELS:
        issues.append(f"`model` must be one of {sorted(VALID_MODELS)}, got `{model}`")

    desc = fields.get("description", "")
    if desc and "use when" not in desc.lower():
        issues.append("`description` should contain a `Use when` trigger phrase")

    return issues


# --- phrase-schema (scenarios.js) lightweight checks ------------------------

PHRASE_RE = re.compile(r"\{\s*id:\s*\"([^\"]+)\"")
REQUIRED_PHRASE_KEYS = ("id", "en", "zh", "tip")


def scan_phrase_objects(js_source: str) -> list[dict[str, str]]:
    """Best-effort extraction of phrase object literals from scenarios.js.

    Returns one dict per phrase with the keys it could parse. This is a
    heuristic scanner for the warn-mode hook, NOT the authoritative gate —
    ``validate-scenarios.js`` (run via Node) remains the deploy gate.
    """
    phrases: list[dict[str, str]] = []
    # Match individual { id:"..", en:"..", ... } blocks up to the closing brace.
    for block in re.finditer(r"\{\s*id:\s*\"[^}]*?\}", js_source, re.DOTALL):
        body = block.group(0)
        entry: dict[str, str] = {}
        for key in ("id", "en", "zh", "tip", "tier", "why", "next", "fallback"):
            m = re.search(rf'{key}\s*:\s*"((?:[^"\\]|\\.)*)"', body)
            if m:
                entry[key] = m.group(1)
        if "id" in entry:
            phrases.append(entry)
    return phrases


def phrase_schema_issues(js_source: str) -> list[str]:
    """Return warnings about phrases missing required keys or empty values."""
    issues: list[str] = []
    for entry in scan_phrase_objects(js_source):
        pid = entry.get("id", "?")
        for key in REQUIRED_PHRASE_KEYS:
            if key not in entry or not entry[key].strip():
                issues.append(f"phrase `{pid}`: missing/empty `{key}`")
    return issues
