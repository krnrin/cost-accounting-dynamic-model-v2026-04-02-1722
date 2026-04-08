from __future__ import annotations

import argparse
from pathlib import Path

from framework.bom_validation import BomValidationExtractor

def main() -> None:
    parser = argparse.ArgumentParser(description="Generate BOM validation data.")
    parser.add_argument("--out", type=Path, default=Path("g281_data_bom_validation.json"), help="Output JSON path")
    args = parser.parse_args()

    extractor = BomValidationExtractor()
    payload = extractor.extract(Path("."))
    extractor.export(payload, args.out)
    print(args.out)

if __name__ == "__main__":
    main()
