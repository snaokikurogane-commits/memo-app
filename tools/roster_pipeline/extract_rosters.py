from __future__ import annotations

import argparse
import json
import math
import re
import subprocess
import tempfile
import unicodedata
from collections import defaultdict
from dataclasses import asdict, dataclass
from pathlib import Path
from typing import Any, Iterable

import pdfplumber
import pypdfium2 as pdfium
import numpy as np
from PIL import Image, ImageEnhance, ImageFilter, ImageOps


JAPANESE_RE = re.compile(r"[一-龯々〆ヵヶぁ-んァ-ヶー]")
PHONE_RE = re.compile(r"(?:TEL|FAX|〒|\d{2,4}[-ー]\d{2,4}|\d{6,})", re.I)
HEADER_TOKENS = {
    "役職名氏名",
    "役職名",
    "氏名",
    "職員用",
}


@dataclass
class StagingRow:
    import_row_id: str
    fiscal_year: str
    organization: str
    department: str
    role: str
    printed_name: str
    normalized_name: str
    source_pdf: str
    source_page: int
    source_raw: str
    confidence: float
    review_status: str


def normalize_name(value: str) -> str:
    text = unicodedata.normalize("NFKC", value or "")
    replacements = str.maketrans({"髙": "高", "﨑": "崎", "濵": "浜", "邉": "辺", "邊": "辺", "國": "国"})
    text = text.translate(replacements)
    return re.sub(r"[\s　()（）・･.．]", "", text).lower()


def _clean_text(value: str) -> str:
    return re.sub(r"\s+", " ", unicodedata.normalize("NFKC", value or "")).strip()


def _clean_ocr_name(value: str) -> str:
    text = _clean_text(value).strip("'=,、。・ー-:;[]【】")
    parts = text.split()
    while len(parts) > 1 and parts[0] in {"長", "係", "官", "佐", "主任", "名", "氏"}:
        parts.pop(0)
    cleaned = " ".join(parts).strip("'=,、。・ー-:;[]【】")
    compact = cleaned.replace(" ", "")
    if len(compact) >= 4 and len(compact) % 2 == 0:
        pairs = [(compact[index], compact[index + 1]) for index in range(0, len(compact), 2)]
        if all(normalize_name(left) == normalize_name(right) for left, right in pairs):
            return "".join(left for left, _ in pairs)
    return cleaned


def _looks_like_name(value: str) -> bool:
    compact = re.sub(r"[\s　()（）]", "", value or "")
    if not 2 <= len(compact) <= 12:
        return False
    if not JAPANESE_RE.search(compact):
        return False
    if PHONE_RE.search(compact):
        return False
    if re.search(r"[0-9０-９]", compact):
        return False
    if compact in HEADER_TOKENS:
        return False
    if any(token in compact for token in ("労働局", "安定所", "監督署", "ハローワーク", "コーナー", "職業", "雇用", "給付", "労働")):
        return False
    return True


def _looks_like_role(value: str) -> bool:
    compact = re.sub(r"\s+", "", value or "")
    if not compact or PHONE_RE.search(compact):
        return False
    if compact in HEADER_TOKENS:
        return False
    return bool(JAPANESE_RE.search(compact))


def _join_positioned_words(words: list[dict[str, Any]]) -> str:
    if not words:
        return ""
    ordered = sorted(words, key=lambda item: item["x0"])
    widths = [max(float(item["x1"]) - float(item["x0"]), 1.0) for item in ordered]
    median_width = sorted(widths)[len(widths) // 2]
    result: list[str] = []
    previous_right: float | None = None
    for item in ordered:
        left = float(item["x0"])
        if previous_right is not None and left - previous_right > median_width * 1.15:
            result.append(" ")
        result.append(str(item["text"]))
        previous_right = float(item["x1"])
    return _clean_text("".join(result))


def _merge_vertical_edges(page: pdfplumber.page.Page) -> list[dict[str, float]]:
    candidates = []
    for edge in page.edges:
        if edge.get("orientation") != "v":
            continue
        top = float(edge["top"])
        bottom = float(edge["bottom"])
        if bottom - top < 35:
            continue
        candidates.append({"x": float(edge["x0"]), "top": top, "bottom": bottom})

    candidates.sort(key=lambda item: (item["x"], item["top"]))
    merged: list[dict[str, float]] = []
    for item in candidates:
        target = next(
            (
                edge
                for edge in merged
                if abs(edge["x"] - item["x"]) <= 1.0
                and item["top"] <= edge["bottom"] + 2.0
                and item["bottom"] >= edge["top"] - 2.0
            ),
            None,
        )
        if target:
            target["x"] = (target["x"] + item["x"]) / 2
            target["top"] = min(target["top"], item["top"])
            target["bottom"] = max(target["bottom"], item["bottom"])
        else:
            merged.append(dict(item))
    return merged


def detect_digital_tables(page: pdfplumber.page.Page) -> list[tuple[float, float, float, float, float]]:
    edges = _merge_vertical_edges(page)
    tables: list[tuple[float, float, float, float, float]] = []
    for left in edges:
        for middle in edges:
            if middle["x"] - left["x"] < 45:
                continue
            if middle["x"] - left["x"] > 105:
                break
            for right in edges:
                if right["x"] <= middle["x"]:
                    continue
                first_width = middle["x"] - left["x"]
                second_width = right["x"] - middle["x"]
                if not 0.72 <= first_width / second_width <= 1.38:
                    continue
                if abs(left["top"] - middle["top"]) > 12 or abs(left["top"] - right["top"]) > 12:
                    continue
                if abs(left["bottom"] - middle["bottom"]) > 14 or abs(left["bottom"] - right["bottom"]) > 14:
                    continue
                top = max(left["top"], middle["top"], right["top"])
                bottom = min(left["bottom"], middle["bottom"], right["bottom"])
                if bottom - top < 45:
                    continue
                candidate = (left["x"], middle["x"], right["x"], top, bottom)
                if not any(
                    abs(candidate[0] - known[0]) < 2
                    and abs(candidate[3] - known[3]) < 4
                    and abs(candidate[4] - known[4]) < 4
                    for known in tables
                ):
                    tables.append(candidate)
                break
    return sorted(tables, key=lambda table: (round(table[3] / 10), table[0]))


def configured_digital_tables(page: pdfplumber.page.Page, page_config: dict[str, Any]) -> list[tuple[float, float, float, float, float, str]]:
    tables = []
    for table in page_config.get("tables", []):
        x0, y0, x1, y1 = table["box"]
        left = float(x0) * page.width
        right = float(x1) * page.width
        top = float(y0) * page.height
        bottom = float(y1) * page.height
        middle = left + (right - left) * float(table.get("name_split", 0.54))
        tables.append((left, middle, right, top, bottom, table["organization"]))
    return tables


def _group_words_by_line(words: Iterable[dict[str, Any]], tolerance: float = 2.2) -> list[list[dict[str, Any]]]:
    groups: list[list[dict[str, Any]]] = []
    centers: list[float] = []
    for word in sorted(words, key=lambda item: (float(item["top"]), float(item["x0"]))):
        center = (float(word["top"]) + float(word["bottom"])) / 2
        match_index = next((index for index, known in enumerate(centers) if abs(known - center) <= tolerance), None)
        if match_index is None:
            centers.append(center)
            groups.append([word])
        else:
            groups[match_index].append(word)
            centers[match_index] = sum((float(item["top"]) + float(item["bottom"])) / 2 for item in groups[match_index]) / len(groups[match_index])
    return [group for _, group in sorted(zip(centers, groups), key=lambda pair: pair[0])]


def extract_digital_source(source_root: Path, source: dict[str, Any]) -> tuple[list[StagingRow], list[dict[str, Any]]]:
    pdf_path = source_root / source["path"]
    rows: list[StagingRow] = []
    diagnostics: list[dict[str, Any]] = []
    with pdfplumber.open(pdf_path) as document:
        for page_index, page in enumerate(document.pages):
            page_config = source.get("pages", [])[page_index] if page_index < len(source.get("pages", [])) else {}
            configured = configured_digital_tables(page, page_config)
            tables = [table[:5] for table in configured] if configured else detect_digital_tables(page)
            labels = [table[5] for table in configured] if configured else (
                source.get("table_labels", [[]])[page_index] if page_index < len(source.get("table_labels", [])) else []
            )
            diagnostics.append({"page": page_index + 1, "detected_tables": len(tables), "labels": len(labels)})
            words = page.extract_words(x_tolerance=1, y_tolerance=2, keep_blank_chars=False)
            for table_index, (left, middle, right, top, bottom) in enumerate(tables):
                organization = labels[table_index] if table_index < len(labels) else f"未設定テーブル{table_index + 1}"
                table_words = [
                    word
                    for word in words
                    if left + 1 <= (float(word["x0"]) + float(word["x1"])) / 2 <= right - 1
                    and top + 7 <= (float(word["top"]) + float(word["bottom"])) / 2 <= bottom - 1
                ]
                department = ""
                for line_index, line in enumerate(_group_words_by_line(table_words)):
                    role = _join_positioned_words([word for word in line if (float(word["x0"]) + float(word["x1"])) / 2 < middle])
                    name = _join_positioned_words([word for word in line if (float(word["x0"]) + float(word["x1"])) / 2 > middle])
                    compact_role = re.sub(r"\s+", "", role)
                    if not name and compact_role.startswith(("(", "（")) and compact_role.endswith((")", "）")):
                        department = compact_role.strip("()（）")
                        continue
                    if not (_looks_like_role(role) and _looks_like_name(name)):
                        continue
                    rows.append(
                        StagingRow(
                            import_row_id=f"{source['fiscal_year']}-p{page_index + 1}-t{table_index + 1}-r{line_index + 1}",
                            fiscal_year=source["fiscal_year"],
                            organization=organization,
                            department=department,
                            role=role,
                            printed_name=name,
                            normalized_name=normalize_name(name),
                            source_pdf=source["path"],
                            source_page=page_index + 1,
                            source_raw=json.dumps({"role": role, "name": name}, ensure_ascii=False),
                            confidence=0.99,
                            review_status="auto_candidate",
                        )
                    )
    return rows, diagnostics


def _run_windows_ocr(script_path: Path, image_path: Path) -> dict[str, Any]:
    command = [
        "powershell.exe",
        "-NoProfile",
        "-ExecutionPolicy",
        "Bypass",
        "-File",
        str(script_path),
        "-ImagePath",
        str(image_path),
    ]
    completed = subprocess.run(command, capture_output=True, text=True, encoding="utf-8-sig", check=True)
    return json.loads(completed.stdout.strip())


def _run_windows_ocr_chunks(script_path: Path, image: Image.Image, base_path: Path) -> dict[str, Any]:
    chunk_height = 1200
    overlap = 140
    if image.height <= chunk_height:
        image.save(base_path)
        return _run_windows_ocr(script_path, base_path)
    words: list[dict[str, Any]] = []
    seen: set[tuple[str, int, int]] = set()
    start = 0
    chunk_index = 0
    while start < image.height:
        end = min(image.height, start + chunk_height)
        chunk_path = base_path.with_name(f"{base_path.stem}-c{chunk_index + 1}{base_path.suffix}")
        image.crop((0, start, image.width, end)).save(chunk_path)
        result = _run_windows_ocr(script_path, chunk_path)
        for source_word in result.get("words", []):
            word = dict(source_word)
            word["y"] = float(word.get("y", 0)) + start
            key = (str(word.get("text", "")), round(float(word.get("x", 0)) / 6), round(float(word["y"]) / 6))
            if key not in seen:
                seen.add(key)
                words.append(word)
        if end >= image.height:
            break
        start = end - overlap
        chunk_index += 1
    deduplicated: list[dict[str, Any]] = []
    for word in sorted(words, key=lambda item: (float(item.get("y", 0)), float(item.get("x", 0)))):
        duplicate = any(
            str(known.get("text", "")) == str(word.get("text", ""))
            and abs(float(known.get("x", 0)) - float(word.get("x", 0))) <= 14
            and abs(float(known.get("y", 0)) - float(word.get("y", 0))) <= 24
            for known in deduplicated[-80:]
        )
        if not duplicate:
            deduplicated.append(word)
    return {"language": "ja", "words": deduplicated, "text": ""}


def _prepare_ocr_half(image: Image.Image) -> Image.Image:
    target = image.resize((image.width * 2, image.height * 2), Image.Resampling.LANCZOS)
    target = ImageOps.autocontrast(target.convert("L"), cutoff=1)
    target = ImageEnhance.Contrast(target).enhance(1.45)
    return target.filter(ImageFilter.SHARPEN)


def _detect_name_divider(image: Image.Image, fallback_ratio: float) -> tuple[int, float]:
    scale = min(1.0, 1200 / max(image.height, 1))
    sample = image.convert("L")
    if scale < 1.0:
        sample = sample.resize((max(1, int(sample.width * scale)), max(1, int(sample.height * scale))), Image.Resampling.BILINEAR)
    sample = ImageOps.autocontrast(sample, cutoff=1)
    pixels = np.asarray(sample)
    height, width = pixels.shape
    y_values = np.arange(int(height * 0.06), int(height * 0.98), dtype=np.int32)
    middle_y = float(y_values.mean())
    radius = max(1, int(width * 0.003))
    best_x = int(width * fallback_ratio)
    best_score = -1
    for slope in np.linspace(-0.045, 0.045, 19):
        drift = np.rint(slope * (y_values - middle_y)).astype(np.int32)
        for center in range(int(width * 0.30), int(width * 0.70)):
            x_values = np.clip(center + drift, radius, width - radius - 1)
            score = 0
            for offset in range(-radius, radius + 1):
                score += int(np.count_nonzero(pixels[y_values, x_values + offset] < 140))
            if score > best_score:
                best_x = center
                best_score = score
    band_area = max(1, (radius * 2 + 1) * len(y_values))
    density = best_score / band_area
    if density < 0.18:
        return int(image.width * fallback_ratio), 0.0
    return int(best_x / width * image.width), round(density, 3)


def _ocr_rows(words: list[dict[str, Any]]) -> list[dict[str, Any]]:
    converted = [
        {
            "text": word["text"],
            "x0": float(word["x"]),
            "x1": float(word["x"]) + float(word["width"]),
            "top": float(word["y"]),
            "bottom": float(word["y"]) + float(word["height"]),
        }
        for word in words
        if str(word.get("text", "")).strip()
    ]
    result = []
    for line in _group_words_by_line(converted, tolerance=6.0):
        center = sum((float(item["top"]) + float(item["bottom"])) / 2 for item in line) / len(line)
        result.append({"y": center, "text": _join_positioned_words(line)})
    return result


def extract_ocr_source(source_root: Path, source: dict[str, Any], script_path: Path) -> tuple[list[StagingRow], list[dict[str, Any]]]:
    pdf_path = source_root / source["path"]
    document = pdfium.PdfDocument(str(pdf_path))
    rows: list[StagingRow] = []
    diagnostics: list[dict[str, Any]] = []
    with tempfile.TemporaryDirectory(prefix="roster-ocr-") as temp_dir_name:
        temp_dir = Path(temp_dir_name)
        for page_index in range(len(document)):
            page_image = document[page_index].render(scale=2.5).to_pil().convert("RGB")
            page_config = source.get("pages", [])[page_index] if page_index < len(source.get("pages", [])) else {"tables": []}
            page_count_before = len(rows)
            for table_index, table in enumerate(page_config.get("tables", [])):
                x0, y0, x1, y1 = table["box"]
                crop = page_image.crop((int(x0 * page_image.width), int(y0 * page_image.height), int(x1 * page_image.width), int(y1 * page_image.height)))
                split = float(table.get("name_split", 0.50))
                divider, divider_density = _detect_name_divider(crop, split)
                divider_padding = max(1, int(crop.width * 0.004))
                role_half = _prepare_ocr_half(crop.crop((0, 0, max(1, divider - divider_padding), crop.height)))
                name_half = _prepare_ocr_half(crop.crop((min(crop.width - 1, divider + divider_padding), 0, crop.width, crop.height)))
                role_path = temp_dir / f"p{page_index + 1}-t{table_index + 1}-role.png"
                name_path = temp_dir / f"p{page_index + 1}-t{table_index + 1}-name.png"
                role_result = _run_windows_ocr_chunks(script_path, role_half, role_path)
                name_result = _run_windows_ocr_chunks(script_path, name_half, name_path)
                role_lines = _ocr_rows(role_result.get("words", []))
                name_lines = _ocr_rows(name_result.get("words", []))
                line_height = max(name_half.height / 90, 10)
                for name_index, name_line in enumerate(name_lines):
                    name = _clean_ocr_name(name_line["text"])
                    if not _looks_like_name(name):
                        continue
                    nearest = min(role_lines, key=lambda item: abs(float(item["y"]) - float(name_line["y"])), default={"y": -9999, "text": ""})
                    distance = abs(float(nearest["y"]) - float(name_line["y"]))
                    role = _clean_text(nearest["text"]) if distance <= line_height else ""
                    if not _looks_like_role(role):
                        role = "要確認"
                    confidence = 0.72 if role != "要確認" else 0.55
                    rows.append(
                        StagingRow(
                            import_row_id=f"{source['fiscal_year']}-{Path(source['path']).stem}-p{page_index + 1}-t{table_index + 1}-n{name_index + 1}",
                            fiscal_year=source["fiscal_year"],
                            organization=table["organization"],
                            department="",
                            role=role,
                            printed_name=name,
                            normalized_name=normalize_name(name),
                            source_pdf=source["path"],
                            source_page=page_index + 1,
                            source_raw=json.dumps({"ocr_name": name_line, "nearest_role": nearest, "divider_ratio": round(divider / crop.width, 4), "divider_density": divider_density}, ensure_ascii=False),
                            confidence=confidence,
                            review_status="needs_review",
                        )
                    )
            diagnostics.append({"page": page_index + 1, "configured_tables": len(page_config.get("tables", [])), "candidate_rows": len(rows) - page_count_before})
    return rows, diagnostics


def audit_rows(rows: list[StagingRow]) -> dict[str, Any]:
    by_year: dict[str, int] = defaultdict(int)
    by_source: dict[str, int] = defaultdict(int)
    normalized: dict[str, list[StagingRow]] = defaultdict(list)
    for row in rows:
        by_year[row.fiscal_year] += 1
        by_source[row.source_pdf] += 1
        normalized[row.normalized_name].append(row)
    duplicates = {
        key: [f"{row.fiscal_year}:{row.printed_name}:{row.organization}" for row in values]
        for key, values in normalized.items()
        if key and len(values) > 1
    }
    return {
        "total_rows": len(rows),
        "by_year": dict(sorted(by_year.items())),
        "by_source": dict(sorted(by_source.items())),
        "duplicate_normalized_names": duplicates,
        "needs_review": sum(row.review_status != "auto_candidate" for row in rows),
    }


def main() -> int:
    parser = argparse.ArgumentParser(description="Extract annual staff rosters into a review-only import package.")
    parser.add_argument("--source-root", type=Path, required=True, help="Directory containing R6, R7 and R8 folders.")
    parser.add_argument("--manifest", type=Path, default=Path(__file__).with_name("manifest.json"))
    parser.add_argument("--output", type=Path, required=True, help="Private output directory; do not commit it.")
    parser.add_argument("--years", nargs="*", help="Optional fiscal year filter, e.g. 令和8年度")
    parser.add_argument("--source-contains", help="Optional substring filter for a PDF path.")
    args = parser.parse_args()

    manifest = json.loads(args.manifest.read_text(encoding="utf-8"))
    args.output.mkdir(parents=True, exist_ok=True)
    ocr_script = Path(__file__).with_name("windows_ocr.ps1")
    all_rows: list[StagingRow] = []
    diagnostics: dict[str, Any] = {}

    for source in manifest["sources"]:
        if args.years and source["fiscal_year"] not in args.years:
            continue
        if args.source_contains and args.source_contains not in source["path"]:
            continue
        source_path = args.source_root / source["path"]
        if not source_path.exists():
            raise FileNotFoundError(source_path)
        if source["mode"] == "digital":
            rows, source_diagnostics = extract_digital_source(args.source_root, source)
        elif source["mode"] == "ocr":
            rows, source_diagnostics = extract_ocr_source(args.source_root, source, ocr_script)
        else:
            raise ValueError(f"Unsupported extraction mode: {source['mode']}")
        all_rows.extend(rows)
        diagnostics[source["path"]] = source_diagnostics

    staging_payload = {
        "schema_version": 2,
        "kind": "roster_import_preview",
        "rows": [asdict(row) for row in all_rows],
    }
    (args.output / "import-staging.json").write_text(json.dumps(staging_payload, ensure_ascii=False, indent=2), encoding="utf-8")
    for fiscal_year in sorted({row.fiscal_year for row in all_rows}):
        year_digits = "".join(character for character in fiscal_year if character.isdigit()) or "unknown"
        year_payload = {
            "schema_version": 2,
            "kind": "roster_import_preview",
            "rows": [asdict(row) for row in all_rows if row.fiscal_year == fiscal_year],
        }
        (args.output / f"import-staging-r{year_digits}.json").write_text(json.dumps(year_payload, ensure_ascii=False, indent=2), encoding="utf-8")
    report = audit_rows(all_rows)
    report["diagnostics"] = diagnostics
    (args.output / "audit-report.json").write_text(json.dumps(report, ensure_ascii=False, indent=2), encoding="utf-8")
    # Windows PowerShell may use cp932, which cannot represent some source filenames.
    print(json.dumps(report, ensure_ascii=True, indent=2))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
