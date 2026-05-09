from __future__ import annotations

import argparse
import json

from .config import AppConfig
from .services import (
    build_demo_bundle,
    export_bundle,
    load_cached_audit,
    load_cached_bundle,
)


def main() -> int:
    parser = argparse.ArgumentParser(description="Smart Truck Interhack prototype CLI")
    subparsers = parser.add_subparsers(dest="command", required=True)

    audit_cmd = subparsers.add_parser("audit", help="Build and print the repository audit.")
    audit_cmd.add_argument("--json", action="store_true", help="Print the audit as JSON.")
    audit_cmd.add_argument(
        "--recompute",
        action="store_true",
        help="Recompute the audit from raw Excel files instead of reading the cached artifact.",
    )

    demo_cmd = subparsers.add_parser("demo", help="Build a demo optimization bundle.")
    demo_cmd.add_argument("--date", dest="planning_date", help="Planning date in ISO format.")
    demo_cmd.add_argument("--export", action="store_true", help="Write generated JSON artifacts to disk.")
    demo_cmd.add_argument(
        "--recompute",
        action="store_true",
        help="Recompute the bundle from raw Excel files instead of reading the cached artifact.",
    )

    args = parser.parse_args()
    config = AppConfig.discover()

    if args.command == "audit":
        if args.recompute:
            bundle = build_demo_bundle(config)
            payload = bundle.audit.to_dict()
        else:
            payload = load_cached_audit(config)
        if args.json:
            print(json.dumps(payload, indent=2, ensure_ascii=False))
        else:
            print(f"SHEETS: {len(payload['sheets'])}")
            for sheet in payload["sheets"]:
                print(
                    f"- {sheet['workbook']} / {sheet['sheet']} -> "
                    f"{sheet['row_count']} rows, {sheet['column_count']} cols, {sheet['classification']}"
                )
            print("WARNINGS:")
            for warning in payload["warnings"]:
                print(f"  - {warning}")
        return 0

    if args.command == "demo":
        if args.export:
            outputs = export_bundle(config, planning_date=args.planning_date)
            print(json.dumps({key: str(value) for key, value in outputs.items()}, indent=2))
        elif args.recompute:
            bundle = build_demo_bundle(config, planning_date=args.planning_date)
            print(json.dumps(bundle.to_dict(), indent=2, ensure_ascii=False))
        else:
            print(json.dumps(load_cached_bundle(config), indent=2, ensure_ascii=False))
        return 0

    return 1
