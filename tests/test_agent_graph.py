"""TDD: the crew delegation graph is a bounded DAG rooted at scout-product-lead."""

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

    def test_root_is_scout(self) -> None:
        _, errors = check_graph(AGENTS, root_agent="does-not-exist")
        self.assertTrue(any("Missing required root" in e for e in errors))

    def test_cycle_rejected(self) -> None:
        with tempfile.TemporaryDirectory() as d:
            a = Path(d)
            _write_agent(a / "root.md", "scout-product-lead", "Agent(x), Read")
            _write_agent(a / "x.md", "x", "Agent(scout-product-lead), Read")
            passed, errors = check_graph(a)
            self.assertFalse(passed)
            self.assertTrue(any("Cycle detected" in e for e in errors))

    def test_depth_overflow_rejected(self) -> None:
        with tempfile.TemporaryDirectory() as d:
            a = Path(d)
            _write_agent(a / "root.md", "scout-product-lead", "Agent(b), Read")
            _write_agent(a / "b.md", "b", "Agent(c), Read")
            _write_agent(a / "c.md", "c", "Agent(e), Read")
            _write_agent(a / "e.md", "e", "Read")
            passed, errors = check_graph(a, max_depth=2)
            self.assertFalse(passed)
            self.assertTrue(any("Depth limit exceeded" in e for e in errors))


if __name__ == "__main__":
    unittest.main()
