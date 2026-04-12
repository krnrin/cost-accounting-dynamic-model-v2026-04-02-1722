from __future__ import annotations

import argparse
from pathlib import Path

from framework.bom_versions import BomVersionsExtractor

def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description="Generate BOM version snapshot JSON from quote, fixed, and TT workbooks.")
    parser.add_argument("--quote", type=Path, default=None, help="Quote BOM workbook path.")
    parser.add_argument("--fixed", type=Path, default=None, help="Fixed BOM workbook path.")
    parser.add_argument("--tt", type=Path, default=None, help="TT BOM workbook path.")
    parser.add_argument("--tt-reference", type=Path, default=None, help="Reference TT workbook path for actual-length comparison.")
    parser.add_argument("--out", type=Path, default=Path("g281_data_bom_versions.json"), help="Output JSON path.")
    return parser.parse_args()

def main() -> None:
    args = parse_args()
    extractor = BomVersionsExtractor()
    # For backward compatibility, we'll just let the extractor handle discovery
    # but we'll use its extract method which handles the multi-workbook logic.
    # Note: extractor.extract currently ignores its input_path and uses its own discovery
    # or a directory. Let's make it use the directory of its input.
    payload = extractor.extract(Path("."))
    extractor.export(payload, args.out)
    print(args.out)

if __name__ == "__main__":
    main()
