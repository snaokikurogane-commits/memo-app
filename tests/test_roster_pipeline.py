import importlib.util
import sys
import unittest
from pathlib import Path

from PIL import Image, ImageDraw


MODULE_PATH = Path(__file__).parents[1] / "tools" / "roster_pipeline" / "extract_rosters.py"
SPEC = importlib.util.spec_from_file_location("extract_rosters", MODULE_PATH)
MODULE = importlib.util.module_from_spec(SPEC)
assert SPEC.loader is not None
sys.modules[SPEC.name] = MODULE
SPEC.loader.exec_module(MODULE)

RECONCILE_PATH = Path(__file__).parents[1] / "tools" / "roster_pipeline" / "reconcile_rosters.py"
RECONCILE_SPEC = importlib.util.spec_from_file_location("reconcile_rosters", RECONCILE_PATH)
RECONCILE = importlib.util.module_from_spec(RECONCILE_SPEC)
assert RECONCILE_SPEC.loader is not None
sys.modules[RECONCILE_SPEC.name] = RECONCILE
RECONCILE_SPEC.loader.exec_module(RECONCILE)


class RosterPipelineTests(unittest.TestCase):
    def test_normalize_name_handles_spaces_and_variant_glyphs(self):
        self.assertEqual(MODULE.normalize_name("（髙﨑　國彦）"), "高崎国彦")

    def test_name_filter_rejects_contact_details(self):
        self.assertFalse(MODULE._looks_like_name("TEL089-123-4567"))
        self.assertFalse(MODULE._looks_like_name("松山市若草町4-3"))
        self.assertFalse(MODULE._looks_like_name("松山公共職業安定所"))
        self.assertTrue(MODULE._looks_like_name("渡邉 彰彦"))

    def test_role_filter(self):
        self.assertTrue(MODULE._looks_like_role("職業紹介係長"))
        self.assertFalse(MODULE._looks_like_role("FAX 089-123-4567"))


    def test_reconciliation_never_auto_accepts_a_fuzzy_name(self):
        references = [{"name": "山田太郎一郎", "source": "令和8年度"}]
        result = RECONCILE.reconcile_row(
            {"printed_name": "山田太朗一郎", "review_status": "needs_review"},
            {"山田太郎一郎": references},
            references,
        )
        self.assertEqual(result["match_type"], "fuzzy_needs_visual_review")

    def test_detect_name_divider_follows_a_slightly_slanted_rule(self):
        image = Image.new("RGB", (300, 600), "white")
        draw = ImageDraw.Draw(image)
        draw.line((176, 0, 184, 599), fill="black", width=2)
        divider, density = MODULE._detect_name_divider(image, 0.5)
        self.assertGreater(density, 0.18)
        self.assertAlmostEqual(divider / image.width, 0.6, delta=0.03)

    def test_ocr_name_cleanup_removes_a_leaked_role_token(self):
        self.assertEqual(MODULE._clean_ocr_name("長 常盤 剛史"), "常盤 剛史")
        self.assertEqual(MODULE._clean_ocr_name("'高田 典幸"), "高田 典幸")
        self.assertEqual(MODULE._clean_ocr_name("山山下下夏夏規規"), "山下夏規")


if __name__ == "__main__":
    unittest.main()
