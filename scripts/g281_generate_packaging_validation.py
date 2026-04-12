from __future__ import annotations

import argparse
from pathlib import Path

from framework.packaging import PackagingValidationExtractor

def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description="Generate packaging validation data from quote/fixed E281 workbooks.")
    parser.add_argument("--quote", type=Path, default=None, help="Quote workbook path")
    parser.add_argument("--fixed", type=Path, default=None, help="Fixed workbook path")
    parser.add_argument("--out", type=Path, default=Path("g281_data_packaging_validation.json"), help="Output JSON path")
    return parser.parse_args()

def main() -> None:
    args = parse_args()
    extractor = PackagingValidationExtractor()
    
    from framework.utils import discover_workbook
    q = args.quote or discover_workbook("报价核算")
    f = args.fixed or discover_workbook("定点核算")
    
    payload = extractor.build_payload(q, f)
    extractor.export(payload, args.out)
    print(args.out)

if __name__ == "__main__":
    main()
