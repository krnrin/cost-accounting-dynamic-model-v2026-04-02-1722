from __future__ import annotations

import argparse
import sys
from pathlib import Path
from typing import Type

# Add the current directory to sys.path to allow importing from 'framework'
sys.path.append(str(Path(__file__).parent))

from framework.base import BaseExtractor
from framework.labor import LaborValidationExtractor
from framework.packaging import PackagingValidationExtractor
from framework.capital import CapitalValidationExtractor
from framework.bom_versions import BomVersionsExtractor
from framework.bom_validation import BomValidationExtractor
from framework.wire_catalog import WireCatalogExtractor
from framework.config_sheets import ConfigSheetsExtractor
from framework.financial_versions import FinancialVersionsExtractor
from framework.bom_workbook import BomWorkbookExtractor

class ExtractCLI:
    def __init__(self):
        self.extractors: dict[str, Type[BaseExtractor]] = {
            "labor": LaborValidationExtractor,
            "packaging": PackagingValidationExtractor,
            "capital": CapitalValidationExtractor,
            "bom_versions": BomVersionsExtractor,
            "bom_validation": BomValidationExtractor,
            "wire_catalog": WireCatalogExtractor,
            "config_sheets": ConfigSheetsExtractor,
            "financial_versions": FinancialVersionsExtractor,
            "bom_workbook": BomWorkbookExtractor,
        }

    def register(self, name: str, extractor_cls: Type[BaseExtractor]):
        self.extractors[name] = extractor_cls

    def run(self):
        parser = argparse.ArgumentParser(description="Unified Excel Data Extraction Framework")
        parser.add_argument("--type", choices=sorted(self.extractors.keys()), help="Type of extraction to perform")
        parser.add_argument("--input", help="Input workbook path or directory")
        parser.add_argument("--output", help="Output JSON path")
        parser.add_argument("--dry-run", action="store_true", help="Perform a dry run without writing output")
        parser.add_argument("--list", action="store_true", help="List all available extractors")

        args = parser.parse_args()

        if args.list:
            print("Available extractors:")
            for name in sorted(self.extractors.keys()):
                config = self.extractors[name]().get_config()
                print(f"  - {name:20} : {config.get('description', 'No description')}")
            return

        if not args.type:
            parser.print_help()
            return

        extractor_cls = self.extractors[args.type]
        extractor = extractor_cls()
        
        try:
            extractor.run(
                input_path=args.input,
                output_path=args.output,
                dry_run=args.dry_run
            )
        except Exception as e:
            print(f"Error during extraction: {e}")
            import traceback
            traceback.print_exc()
            sys.exit(1)

if __name__ == "__main__":
    cli = ExtractCLI()
    cli.run()
