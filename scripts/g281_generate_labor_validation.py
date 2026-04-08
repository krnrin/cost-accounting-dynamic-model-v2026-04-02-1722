from __future__ import annotations

import argparse
from pathlib import Path

from framework.labor import LaborValidationExtractor

def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description="Generate labor validation data from quote/fixed E281 workbooks.")
    parser.add_argument("--quote", type=Path, default=None, help="Quote workbook path")
    parser.add_argument("--fixed", type=Path, default=None, help="Fixed workbook path")
    parser.add_argument("--out", type=Path, default=Path("g281_data_labor_validation.json"), help="Output JSON path")
    return parser.parse_args()

def main() -> None:
    args = parse_args()
    extractor = LaborValidationExtractor()
    
    # Custom run for backward compatibility since BaseExtractor.run takes one path
    quote_path = args.quote or extractor.discover()
    fixed_path = args.fixed or extractor.discover() # This is a bit loose but discover() finds nuclear patterns
    
    # We'll just call the payload builder directly or use extract with a clever trick
    # Actually, let's just use the extractor's build_payload
    from framework.utils import discover_workbook
    q = args.quote or discover_workbook("报价核算")
    f = args.fixed or discover_workbook("定点核算")
    
    payload = extractor.build_payload(q, f)
    extractor.export(payload, args.out)
    print(args.out)

if __name__ == "__main__":
    main()
