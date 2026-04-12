from __future__ import annotations

import json
from abc import ABC, abstractmethod
from pathlib import Path
from typing import Any

from .utils import discover_workbook, write_json

class BaseExtractor(ABC):
    """Base class for all Excel data extractors."""
    
    @abstractmethod
    def get_config(self) -> dict[str, Any]:
        """Return extractor configuration: name, description, workbook_pattern, sheets, etc."""
        pass
    
    def discover(self, input_path: str | Path | None = None) -> Path:
        """Find workbook — use input_path if given, else discover by pattern."""
        if input_path:
            return Path(input_path)
        config = self.get_config()
        return discover_workbook(config["workbook_pattern"])
    
    @abstractmethod
    def extract(self, workbook_path: Path) -> dict[str, Any]:
        """Extract data from workbook. Return structured dict."""
        pass
    
    def validate(self, data: dict[str, Any]) -> list[str]:
        """Optional validation. Return list of warnings."""
        return []
    
    def export(self, data: dict[str, Any], output_path: str | Path | None = None, dry_run: bool = False):
        """Write data to JSON file."""
        if output_path is None:
            config = self.get_config()
            output_path = Path(config.get("default_output", "output.json"))
        else:
            output_path = Path(output_path)
            
        write_json(data, output_path, dry_run=dry_run)
    
    def run(self, input_path: str | Path | None = None, output_path: str | Path | None = None, dry_run: bool = False) -> dict[str, Any]:
        """Full pipeline: discover → load → extract → validate → export."""
        path = self.discover(input_path)
        print(f"Loading {path}...")
        data = self.extract(path)
        
        warnings = self.validate(data)
        if warnings:
            print(f"Validation warnings ({len(warnings)}):")
            for warning in warnings:
                print(f"  - {warning}")
        
        self.export(data, output_path, dry_run=dry_run)
        return data
