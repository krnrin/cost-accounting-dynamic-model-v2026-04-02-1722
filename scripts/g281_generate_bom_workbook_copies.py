from __future__ import annotations

import argparse
from pathlib import Path

from framework.bom_workbook import BomWorkbookExtractor

def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description="Copy BOM workbook sheets to JSON.")
    parser.add_argument("--source-dir", type=Path, default=Path("BOM核对"), help="Source directory")
    parser.add_argument("--quote-workbook", type=Path, default=None, help="Quote BOM workbook")
    parser.add_argument("--fixed-workbook", type=Path, default=None, help="Fixed BOM workbook")
    parser.add_argument("--output", type=Path, default=Path("g281_data_bom_workbook_copies.json"), help="Output JSON path")
    return parser.parse_args()

def main() -> None:
    args = parse_args()
    extractor = BomWorkbookExtractor()
    payload = extractor.extract(args.source_dir)
    extractor.export(payload, args.output)
    print(args.output)

if __name__ == "__main__":
    main()
