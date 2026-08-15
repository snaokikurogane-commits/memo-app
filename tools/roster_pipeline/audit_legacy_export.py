from __future__ import annotations

import argparse
import json
from collections import Counter, defaultdict
from pathlib import Path
from typing import Any

from extract_rosters import normalize_name


def text(value: Any) -> str:
    return str(value or "").strip()


def table_from_export(payload: dict[str, Any], sheet_name: str) -> list[dict[str, Any]]:
    sheet = next((item for item in payload.get("sheets", []) if item.get("name") == sheet_name), None)
    if not sheet or not sheet.get("rows"):
        return []
    headers = [str(value or "") for value in sheet["rows"][0]]
    return [dict(zip(headers, row)) for row in sheet["rows"][1:]]


def main() -> int:
    parser = argparse.ArgumentParser(description="Audit the current workbook export before v2 migration.")
    parser.add_argument("--workbook-export", type=Path, required=True)
    parser.add_argument("--staging", type=Path, required=True)
    parser.add_argument("--output", type=Path, required=True)
    args = parser.parse_args()
    workbook = json.loads(args.workbook_export.read_text(encoding="utf-8"))
    staging_payload = json.loads(args.staging.read_text(encoding="utf-8"))
    staging = staging_payload.get("rows", [])
    masters = table_from_export(workbook, "人物マスタ")
    memos = table_from_export(workbook, "メモ履歴")
    groups: dict[str, list[dict[str, Any]]] = defaultdict(list)
    for row in masters:
        groups[normalize_name(text(row.get("名前")))].append(row)
    ambiguous = {
        key: values
        for key, values in groups.items()
        if key and any(count > 1 for count in Counter(str(row.get("年度", "")) for row in values).values())
    }
    safe_keys = {key for key in groups if key and key not in ambiguous}
    named_memos = [row for row in memos if text(row.get("名前"))]
    matched_memos = [row for row in named_memos if normalize_name(text(row.get("名前"))) in safe_keys]
    ambiguous_memos = [row for row in named_memos if normalize_name(text(row.get("名前"))) in ambiguous]
    unmatched_memos = [row for row in named_memos if normalize_name(text(row.get("名前"))) not in groups]
    blank_name_memos = [row for row in memos if not text(row.get("名前")) and text(row.get("メモ内容（話題・キーワード）"))]

    pdf_by_year: dict[str, set[str]] = defaultdict(set)
    for row in staging:
        pdf_by_year[str(row.get("fiscal_year", ""))].add(normalize_name(str(row.get("printed_name", ""))))
    sheet_by_year: dict[str, set[str]] = defaultdict(set)
    for row in masters:
        sheet_by_year[str(row.get("年度", ""))].add(normalize_name(str(row.get("名前", ""))))
    comparison = {}
    for year in sorted(set(pdf_by_year) | set(sheet_by_year)):
        pdf_names = pdf_by_year[year]
        sheet_names = sheet_by_year[year]
        comparison[year] = {
            "pdf_unique_names": len(pdf_names),
            "sheet_unique_names": len(sheet_names),
            "normalized_overlap": len(pdf_names & sheet_names),
            "pdf_only": len(pdf_names - sheet_names),
            "sheet_only": len(sheet_names - pdf_names),
        }
    report = {
        "source_sheets": {sheet.get("name", ""): max(0, len(sheet.get("rows", [])) - 1) for sheet in workbook.get("sheets", [])},
        "master": {
            "rows": len(masters),
            "by_year": dict(sorted(Counter(str(row.get("年度", "")) for row in masters).items())),
            "safe_unique_people": len(safe_keys),
            "ambiguous_same_year_name_keys": len(ambiguous),
            "ambiguous_master_rows": sum(len(values) for values in ambiguous.values()),
            "events_with_date": sum(bool(row.get("イベント日")) for row in masters),
            "events_with_label": sum(bool(row.get("イベント名")) for row in masters),
        },
        "memo_history": {
            "rows": len(memos),
            "nonblank_memos": sum(bool(text(row.get("メモ内容（話題・キーワード）"))) for row in memos),
            "named_rows": len(named_memos),
            "auto_linkable": len(matched_memos),
            "ambiguous_person": len(ambiguous_memos),
            "unmatched_person": len(unmatched_memos),
            "blank_person_name_with_memo": len(blank_name_memos),
            "unmatched_names": sorted({text(row.get("名前")) for row in unmatched_memos}),
        },
        "pdf_sheet_comparison": comparison,
    }
    args.output.parent.mkdir(parents=True, exist_ok=True)
    args.output.write_text(json.dumps(report, ensure_ascii=False, indent=2), encoding="utf-8")
    public_summary = dict(report)
    public_summary["memo_history"] = {key: value for key, value in report["memo_history"].items() if key != "unmatched_names"}
    print(json.dumps(public_summary, ensure_ascii=True, indent=2))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
