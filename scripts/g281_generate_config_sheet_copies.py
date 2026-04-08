from __future__ import annotations

import argparse
from pathlib import Path

from framework.config_sheets import ConfigSheetsExtractor

def main() -> None:
    parser = argparse.ArgumentParser(description="Copy config sheets to JSON.")
    parser.add_argument("--out", type=Path, default=Path("g281_data_config_sheet_copies.json"), help="Output JSON path")
    args = parser.parse_args()

    extractor = ConfigSheetsExtractor()
    payload = extractor.extract(Path("."))
    extractor.export(payload, args.out)
    print(args.out)

if __name__ == "__main__":
    main()
