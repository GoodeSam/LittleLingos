"""TDD: the crew delegation graph is a bounded DAG rooted at ada-ceo."""

from pathlib import Path
import tempfile
import unittest

from scripts.check_agent_graph import check_graph

AGENTS = Path(".claude/agents")


def _write_agent(path: Path, name: str, tools: str) -> None:
    path.write_text(
        "\n".join(
            ["---", f"name: {name}", "description: test", f"tools: {tools}",
             "model: sonnet", "---", "", f"# {name}", ""]
        ),
        encoding="utf-8",
    )


class TestAgentGraph(unittest.TestCase):
    def test_repo_graph_passes(self) -> None:
        passed, errors = check_graph(AGENTS)
        self.assertTrue(passed, "\n".join(errors))

    def test_root_is_ceo(self) -> None:
        _, errors = check_graph(AGENTS, root_agent="does-not-exist")
        self.assertTrue(any("Missing required root" in e for e in errors))

    def test_cycle_rejected(self) -> None:
        with tempfile.TemporaryDirectory() as d:
            a = Path(d)
            _write_agent(a / "root.md", "ada-ceo", "Agent(x), Read")
            _write_agent(a / "x.md", "x", "Agent(ada-ceo), Read")
            passed, errors = check_graph(a)
            self.assertFalse(passed)
            self.assertTrue(any("Cycle detected" in e for e in errors))

    def test_depth_overflow_rejected(self) -> None:
        with tempfile.TemporaryDirectory() as d:
            a = Path(d)
            _write_agent(a / "root.md", "ada-ceo", "Agent(b), Read")
            _write_agent(a / "b.md", "b", "Agent(c), Read")
            _write_agent(a / "c.md", "c", "Agent(e), Read")
            _write_agent(a / "e.md", "e", "Read")
            passed, errors = check_graph(a, max_depth=2)
            self.assertFalse(passed)
            self.assertTrue(any("Depth limit exceeded" in e for e in errors))

    def test_critics_are_leaves(self) -> None:
        """rules/08: the critics judge, they never delegate."""
        for critic in ("felix-function-critic", "vera-visual-critic"):
            text = (AGENTS / f"{critic}.md").read_text(encoding="utf-8")
            tools_line = next(
                line for line in text.splitlines() if line.startswith("tools:")
            )
            self.assertNotIn("Agent(", tools_line, f"{critic} must be a leaf")


if __name__ == "__main__":
    unittest.main()
