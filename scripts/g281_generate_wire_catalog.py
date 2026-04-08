from __future__ import annotations

import argparse
from pathlib import Path

from framework.wire_catalog import WireCatalogExtractor

def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description="Generate wire model catalog JSON from quote/fixed linked workbooks and the TT workbook.")
    parser.add_argument("--quote", type=Path, default=None, help="Quote linked workbook path.")
    parser.add_argument("--fixed", type=Path, default=None, help="Fixed linked workbook path.")
    parser.add_argument("--tt", type=Path, default=None, help="TT workbook path.")
    parser.add_argument("--out", type=Path, default=Path("g281_data_wire_catalog.json"), help="Output JSON path.")
    return parser.parse_args()

def main() -> None:
    args = parse_args()
    extractor = WireCatalogExtractor()
    # For now, we'll let it use the directory for discovery
    payload = extractor.extract(Path("."))
    extractor.export(payload, args.out)
    print(args.out)

if __name__ == "__main__":
    main()
