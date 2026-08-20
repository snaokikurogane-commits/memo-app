from __future__ import annotations

import argparse
import csv
import json
import unicodedata
from collections import Counter, defaultdict
from difflib import SequenceMatcher
from pathlib import Path
from typing import Any

from extract_rosters import normalize_name


NAME_COLUMNS = ("canonical_name", "printed_name", "name", "氏名", "名前")


def basic_surface(value: str) -> str:
    return "".join(unicodedata.normalize("NFKC", str(value or "")).split()).replace("（", "").replace("）", "").replace("(", "").replace(")", "")


def load_payload(path: Path) -> list[dict[str, Any]]:
    if path.suffix.lower() == ".csv":
        with path.open("r", encoding="utf-8-sig", newline="") as stream:
            return list(csv.DictReader(stream))
    payload = json.loads(path.read_text(encoding="utf-8"))
    if isinstance(payload, list):
        return payload
    if isinstance(payload.get("sheets"), list):
        preferred = next((sheet for sheet in payload["sheets"] if sheet.get("name") == "人物マスタ"), None)
        if preferred and preferred.get("rows"):
            headers = [str(value or "") for value in preferred["rows"][0]]
            return [dict(zip(headers, row)) for row in preferred["rows"][1:]]
    for key in ("rows", "people", "data"):
        if isinstance(payload.get(key), list):
            return payload[key]
    raise ValueError(f"Rows were not found in {path}")


def name_from_row(row: dict[str, Any]) -> str:
    for key in NAME_COLUMNS:
        if row.get(key):
            return str(row[key])
    return ""


def build_references(staging: list[dict[str, Any]], existing: list[dict[str, Any]]) -> list[dict[str, str]]:
    references = []
    for row in staging:
        if row.get("review_status") == "auto_candidate":
            references.append({"name": str(row.get("printed_name", "")), "source": str(row.get("fiscal_year", "digital_pdf")), "fiscal_year": str(row.get("fiscal_year", ""))})
    for row in existing:
        name = name_from_row(row)
        if name:
            references.append({"name": name, "source": "existing_sheet", "fiscal_year": str(row.get("fiscal_year") or row.get("年度") or "")})
    counts = Counter((normalize_name(item["name"]), item.get("fiscal_year", ""), item["source"]) for item in references)
    for reference in references:
        reference["ambiguous_same_year"] = counts[(normalize_name(reference["name"]), reference.get("fiscal_year", ""), reference["source"])] > 1
    unique = {}
    for reference in references:
        key = (normalize_name(reference["name"]), reference["source"], reference["name"], reference.get("fiscal_year", ""))
        unique[key] = reference
    return list(unique.values())


def reconcile_row(row: dict[str, Any], by_normalized: dict[str, list[dict[str, str]]], references: list[dict[str, str]]) -> dict[str, Any]:
    result = dict(row)
    source_name = str(row.get("printed_name", ""))
    key = normalize_name(source_name)
    exact = by_normalized.get(key, [])
    unique_exact_names = sorted({item["name"] for item in exact})
    if exact and not any(item.get("ambiguous_same_year") for item in exact):
        preferred = next((item for item in exact if item["source"] != "existing_sheet"), exact[0])
        candidate = preferred["name"]
        match_type = "formatting_only" if basic_surface(source_name) == basic_surface(candidate) else "normalized_variant"
        result.update(suggested_name=candidate, match_type=match_type, match_confidence=1.0, candidate_sources=sorted({item["source"] for item in exact}))
        return result
    if exact:
        result.update(suggested_name="", match_type="multiple_candidates", match_confidence=1.0, candidate_sources=sorted({item["source"] for item in exact}), candidate_names=unique_exact_names)
        return result
    scored = []
    for reference in references:
        candidate_key = normalize_name(reference["name"])
        if not candidate_key:
            continue
        score = SequenceMatcher(None, key, candidate_key).ratio()
        scored.append((score, reference["name"], reference["source"]))
    scored.sort(reverse=True)
    best = scored[0] if scored else (0.0, "", "")
    second_score = scored[1][0] if len(scored) > 1 else 0.0
    if best[0] >= 0.82 and best[0] - second_score >= 0.06:
        result.update(suggested_name=best[1], match_type="fuzzy_needs_visual_review", match_confidence=round(best[0], 3), candidate_sources=[best[2]])
    else:
        result.update(suggested_name="", match_type="unmatched_needs_visual_review", match_confidence=round(best[0], 3), candidate_sources=[])
    return result


def build_audit(rows: list[dict[str, Any]], references: list[dict[str, str]]) -> dict[str, Any]:
    matched_reference_keys = {normalize_name(row.get("suggested_name", "")) for row in rows if row.get("suggested_name")}
    sheet_only = sorted({item["name"] for item in references if item["source"] == "existing_sheet" and normalize_name(item["name"]) not in matched_reference_keys})
    by_year = Counter(str(row.get("fiscal_year", "")) for row in rows)
    by_organization = Counter(f"{row.get('fiscal_year', '')} | {row.get('organization', '')}" for row in rows)
    classifications = Counter(str(row.get("match_type", "")) for row in rows)
    identity_history: dict[str, list[dict[str, str]]] = defaultdict(list)
    for row in rows:
        identity = normalize_name(row.get("suggested_name") or row.get("printed_name", ""))
        item = {"fiscal_year": str(row.get("fiscal_year", "")), "organization": str(row.get("organization", "")), "name": str(row.get("suggested_name") or row.get("printed_name", ""))}
        if item not in identity_history[identity]:
            identity_history[identity].append(item)
    transitions = [history for history in identity_history.values() if len({item["fiscal_year"] for item in history}) > 1]
    return {
        "total_rows": len(rows),
        "by_year": dict(sorted(by_year.items())),
        "by_organization": dict(sorted(by_organization.items())),
        "classifications": dict(sorted(classifications.items())),
        "needs_visual_review": sum(str(row.get("review_status", "")) != "auto_candidate" for row in rows),
        "unresolved_name_matches": sum("review" in str(row.get("match_type", "")) or row.get("match_type") == "multiple_candidates" for row in rows),
        "sheet_only_names": sheet_only,
        "cross_year_transition_candidates": transitions,
    }


def main() -> int:
    parser = argparse.ArgumentParser(description="Compare OCR staging rows with digital-PDF and optional existing-sheet names.")
    parser.add_argument("--staging", type=Path, required=True)
    parser.add_argument("--existing", type=Path, help="Optional CSV or JSON export of the current spreadsheet.")
    parser.add_argument("--output", type=Path, required=True)
    args = parser.parse_args()
    staging = load_payload(args.staging)
    existing = load_payload(args.existing) if args.existing else []
    references = build_references(staging, existing)
    by_normalized: dict[str, list[dict[str, str]]] = defaultdict(list)
    for reference in references:
        by_normalized[normalize_name(reference["name"])].append(reference)
    reconciled = [reconcile_row(row, by_normalized, references) if row.get("review_status") != "auto_candidate" else dict(row, suggested_name=row.get("printed_name", ""), match_type="digital_source", match_confidence=1.0, candidate_sources=[row.get("fiscal_year", "")]) for row in staging]
    args.output.mkdir(parents=True, exist_ok=True)
    (args.output / "reconciled-staging.json").write_text(json.dumps({"schema_version": 2, "kind": "roster_import_preview", "rows": reconciled}, ensure_ascii=False, indent=2), encoding="utf-8")
    audit = build_audit(reconciled, references)
    (args.output / "reconciliation-audit.json").write_text(json.dumps(audit, ensure_ascii=False, indent=2), encoding="utf-8")
    columns = ["fiscal_year", "organization", "department", "role", "printed_name", "suggested_name", "match_type", "match_confidence", "source_pdf", "source_page", "review_status"]
    with (args.output / "review.csv").open("w", encoding="utf-8-sig", newline="") as stream:
        writer = csv.DictWriter(stream, fieldnames=columns, extrasaction="ignore")
        writer.writeheader()
        writer.writerows(reconciled)
    print(json.dumps({key: value for key, value in audit.items() if key not in ("sheet_only_names", "cross_year_transition_candidates")}, ensure_ascii=True, indent=2))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
