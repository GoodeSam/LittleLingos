#!/usr/bin/env python3
"""Validate the LittleLingos agent delegation graph.

The crew is a bounded DAG rooted at ``scout-product-lead`` with a maximum
delegation depth of 2. Delegation edges are declared in agent frontmatter as
``Agent(child-name)`` entries inside the ``tools:`` field. Adapted from the
GoodeSam ``check_agent_graph.py``.
"""

from __future__ import annotations

import argparse
import re
from collections import deque
from dataclasses import dataclass
from pathlib import Path

NAME_RE = re.compile(r"^\s*name:\s*(.+?)\s*$")
TOOLS_RE = re.compile(r"^\s*tools:\s*(.+?)\s*$")
AGENT_CALL_RE = re.compile(r"Agent\(([^)]*)\)")

ROOT_AGENT = "scout-product-lead"
MAX_DEPTH = 2


@dataclass(frozen=True)
class AgentSpec:
    name: str
    delegates: tuple[str, ...]
    path: Path


def _frontmatter(text: str) -> str:
    lines = text.splitlines()
    if not lines or lines[0].strip() != "---":
        return ""
    for idx in range(1, len(lines)):
        if lines[idx].strip() == "---":
            return "\n".join(lines[1:idx])
    return ""


def _field(frontmatter: str, regex: re.Pattern[str]) -> str:
    for line in frontmatter.splitlines():
        match = regex.match(line)
        if match:
            return match.group(1).strip()
    return ""


def _delegates(tools: str) -> tuple[str, ...]:
    out: list[str] = []
    for call in AGENT_CALL_RE.findall(tools):
        out.extend(part.strip() for part in call.split(",") if part.strip())
    return tuple(out)


def load_agents(agents_dir: Path) -> dict[str, AgentSpec]:
    agents: dict[str, AgentSpec] = {}
    for path in sorted(agents_dir.glob("*.md")):
        fm = _frontmatter(path.read_text(encoding="utf-8", errors="ignore"))
        name = _field(fm, NAME_RE)
        if not name:
            continue
        agents[name] = AgentSpec(name, _delegates(_field(fm, TOOLS_RE)), path)
    return agents


def _find_cycles(graph: dict[str, tuple[str, ...]]) -> list[list[str]]:
    state: dict[str, int] = {node: 0 for node in graph}
    stack: list[str] = []
    cycles: list[list[str]] = []

    def dfs(node: str) -> None:
        state[node] = 1
        stack.append(node)
        for nxt in graph[node]:
            if nxt not in graph:
                continue
            if state[nxt] == 0:
                dfs(nxt)
            elif state[nxt] == 1:
                cycles.append(stack[stack.index(nxt):] + [nxt])
        stack.pop()
        state[node] = 2

    for node in graph:
        if state[node] == 0:
            dfs(node)
    return cycles


def check_graph(
    agents_dir: Path, root_agent: str = ROOT_AGENT, max_depth: int = MAX_DEPTH
) -> tuple[bool, list[str]]:
    agents = load_agents(agents_dir)
    errors: list[str] = []
    if root_agent not in agents:
        return False, [f"Missing required root agent `{root_agent}`."]

    graph = {name: spec.delegates for name, spec in agents.items()}
    for name, delegates in graph.items():
        for child in delegates:
            if child not in graph:
                errors.append(f"`{name}` delegates to unknown agent `{child}`.")

    for cycle in _find_cycles(graph):
        errors.append(f"Cycle detected: {' -> '.join(cycle)}")

    depth: dict[str, int] = {root_agent: 0}
    queue: deque[str] = deque([root_agent])
    while queue:
        node = queue.popleft()
        for child in graph.get(node, ()):
            if child not in depth:
                depth[child] = depth[node] + 1
                queue.append(child)

    too_deep = sorted((n, d) for n, d in depth.items() if d > max_depth)
    if too_deep:
        errors.append(
            f"Depth limit exceeded from `{root_agent}` (max {max_depth}): "
            + ", ".join(f"{n}={d}" for n, d in too_deep)
        )

    for parent, children in graph.items():
        if parent not in depth:
            continue
        for child in children:
            if child in depth and depth[child] <= depth[parent]:
                errors.append(
                    f"Back-edge/cross-layer edge disallowed: `{parent}` -> `{child}`."
                )

    unreachable = sorted(n for n in agents if n not in depth)
    if unreachable:
        errors.append(
            f"Agents unreachable from `{root_agent}`: {', '.join(unreachable)}"
        )
    return not errors, errors


def _cli(argv: list[str] | None = None) -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--agents-dir", type=Path, default=Path(".claude/agents"))
    parser.add_argument("--root-agent", default=ROOT_AGENT)
    parser.add_argument("--max-depth", type=int, default=MAX_DEPTH)
    args = parser.parse_args(argv)
    passed, errors = check_graph(args.agents_dir, args.root_agent, args.max_depth)
    if passed:
        print("PASS: agent delegation graph is acyclic and depth-bounded.")
        return 0
    print("FAIL: agent delegation graph constraints violated.")
    for error in errors:
        print(f"  - {error}")
    return 1


if __name__ == "__main__":
    raise SystemExit(_cli())
