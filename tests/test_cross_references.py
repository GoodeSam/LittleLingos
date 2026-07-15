"""TDD: the agents/skills/rules cross-reference fabric resolves with no orphans."""

from pathlib import Path
import unittest

from scripts.check_cross_references import check_references

ROOT = Path(".")


class TestCrossReferences(unittest.TestCase):
    def test_fabric_intact(self) -> None:
        passed, errors = check_references(ROOT)
        self.assertTrue(passed, "\n".join(errors))


if __name__ == "__main__":
    unittest.main()
