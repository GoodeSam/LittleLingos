"""TDD: the real product data (scenarios.js) passes the deploy gate, and the
Python phrase scanner agrees with the Node validator on a clean file.

This wires the crew's QA harness to the actual LittleLingos artifact, so the
test suite guards the product, not just the agent definitions.
"""

from pathlib import Path
import subprocess
import unittest

from scripts.operating_validators import phrase_schema_issues

ROOT = Path(".")
SCENARIOS = ROOT / "scenarios.js"


class TestScenariosValid(unittest.TestCase):
    def test_node_validator_passes(self) -> None:
        result = subprocess.run(
            ["node", "validate-scenarios.js"],
            cwd=ROOT, capture_output=True, text=True,
        )
        self.assertEqual(result.returncode, 0, result.stdout + result.stderr)

    def test_python_scanner_finds_no_schema_gaps(self) -> None:
        issues = phrase_schema_issues(SCENARIOS.read_text(encoding="utf-8"))
        self.assertEqual(issues, [], f"first gaps: {issues[:5]}")


if __name__ == "__main__":
    unittest.main()
