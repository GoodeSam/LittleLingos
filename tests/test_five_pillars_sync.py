"""TDD: every agent and skill embeds the canonical Five Pillars block verbatim."""

from pathlib import Path
import unittest

from scripts.five_pillars import check_sync, render_block, extract_block

ROOT = Path(".")


class TestFivePillarsSync(unittest.TestCase):
    def test_all_embeds_match_canonical(self) -> None:
        passed, errors = check_sync(ROOT)
        self.assertTrue(passed, "\n".join(errors))

    def test_block_roundtrips(self) -> None:
        block = render_block()
        self.assertEqual(extract_block(f"prefix\n{block}\nsuffix"), block)


if __name__ == "__main__":
    unittest.main()
