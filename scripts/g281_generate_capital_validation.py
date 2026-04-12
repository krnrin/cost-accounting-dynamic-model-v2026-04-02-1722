from __future__ import annotations

import argparse
from pathlib import Path

from framework.capital import CapitalValidationExtractor

def main() -> None:
    parser = argparse.ArgumentParser(description="Generate capital validation data from E281 quote/fixed workbooks.")
    parser.add_argument("--quote", type=Path, default=None, help="Quote workbook path.")
    parser.add_argument("--fixed", type=Path, default=None, help="Fixed workbook path.")
    parser.add_argument("--out", type=Path, default=Path("g281_data_capital_validation.json"), help="Output json path.")
    args = parser.parse_args()

    extractor = CapitalValidationExtractor()
    from framework.utils import discover_workbook
    q = args.quote or discover_workbook("报价核算")
    f = args.fixed or discover_workbook("定点核算")
    
    payload = extractor.build_payload(q, f)
    extractor.export(payload, args.out)
    
    print(args.out)
    for scope_id in payload["scopeOrder"]:
        summary = payload["comparisons"][scope_id]["summary"]
        delta_str = f"{float(summary['deltaAmount']):,.2f}" if summary['deltaAmount'] is not None else "-"
        print(
            f"{scope_id}: quote {summary['quoteCount']} / fixed {summary['fixedCount']} / "
            f"matched {summary['matchedCount']} / deltaAmount {delta_str}"
        )

if __name__ == "__main__":
    main()
