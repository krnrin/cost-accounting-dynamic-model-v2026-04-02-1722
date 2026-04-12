from __future__ import annotations

import argparse
from datetime import datetime
from pathlib import Path
from typing import Any

from openpyxl import load_workbook

from .base import BaseExtractor

class ConfigSheetsExtractor(BaseExtractor):
    def get_config(self) -> dict[str, Any]:
        return {
            "name": "config_sheets",
            "description": "Config sheet copy management",
            "workbook_pattern": "核算",
            "default_output": "g281_data_config_sheet_copies.json",
        }

    def extract(self, input_path: Path) -> dict[str, Any]:
        return {
            "generatedAt": datetime.now().isoformat(),
            "versions": {}
        }
