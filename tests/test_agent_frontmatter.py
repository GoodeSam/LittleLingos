"""TDD: every agent file has valid, complete frontmatter and a matching spec."""

from pathlib import Path
import unittest

from scripts.operating_validators import validate_agent_frontmatter

AGENTS = Path(".claude/agents")
SPECS = Path(".nlpm-test")
EXPECTED_AGENTS = {
    "scout-product-lead",
    "maya-curriculum-designer",
    "leo-linguist",
    "nina-native-editor",
    "theo-tts-audio-engineer",
    "devon-frontend-engineer",
    "quinn-qa-validator",
}


class TestAgentFrontmatter(unittest.TestCase):
    def test_expected_agents_exist(self) -> None:
        found = {p.stem for p in AGENTS.glob("*.md")}
        self.assertEqual(EXPECTED_AGENTS, found & EXPECTED_AGENTS,
                         f"missing: {EXPECTED_AGENTS - found}")

    def test_frontmatter_valid(self) -> None:
        for path in AGENTS.glob("*.md"):
            issues = validate_agent_frontmatter(path.read_text(encoding="utf-8"))
            self.assertEqual(issues, [], f"{path.name}: {issues}")

    def test_every_agent_has_spec(self) -> None:
        for path in AGENTS.glob("*.md"):
            spec = SPECS / f"{path.stem}.spec.md"
            self.assertTrue(spec.exists(), f"missing spec for {path.stem}")


if __name__ == "__main__":
    unittest.main()
