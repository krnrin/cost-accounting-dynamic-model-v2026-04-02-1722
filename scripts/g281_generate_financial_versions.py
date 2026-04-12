from __future__ import annotations

import argparse
from pathlib import Path

from framework.financial_versions import FinancialVersionsExtractor

def main() -> None:
    parser = argparse.ArgumentParser(description="Generate exact financial version data from E281 quote/fixed workbooks.")
    parser.add_argument("--out", default="g281_data_financial_versions.json", help="Output JSON path.")
    args = parser.parse_args()

    extractor = FinancialVersionsExtractor()
    payload = extractor.extract(Path("."))
    extractor.export(payload, args.out)
    print(args.out)

if __name__ == "__main__":
    main()
