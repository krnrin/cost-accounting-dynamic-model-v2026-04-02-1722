from __future__ import annotations

import argparse
import json
from copy import deepcopy
from pathlib import Path
from typing import Any


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(
        description="Merge extracted version seed JSON files into g281_data_master.json."
    )
    parser.add_argument(
        "--master",
        type=Path,
        default=Path("g281_data_master.json"),
        help="Master JSON file to update.",
    )
    parser.add_argument(
        "--seed-glob",
        default="tmp/version_seed_*.json",
        help="Glob pattern for extracted seed JSON files.",
    )
    parser.add_argument(
        "--out",
        type=Path,
        default=None,
        help="Output path. Defaults to overwrite --master.",
    )
    return parser.parse_args()


def load_json(path: Path) -> dict[str, Any]:
    return json.loads(path.read_text(encoding="utf-8"))


def deep_merge(target: dict[str, Any], patch: dict[str, Any]) -> dict[str, Any]:
    for key, value in patch.items():
        if isinstance(value, dict) and isinstance(target.get(key), dict):
            deep_merge(target[key], value)
        else:
            target[key] = deepcopy(value)
    return target


def merge_seed(master: dict[str, Any], seed: dict[str, Any], seed_path: Path) -> None:
    group = seed.get("group")
    versions = seed.get("versions")
    if not group or not isinstance(versions, dict):
        raise ValueError(f"{seed_path} missing required group/versions structure")

    master_versions = master.setdefault("versions", {})
    group_versions = master_versions.setdefault(group, {})

    for version_key, version_payload in versions.items():
        if not isinstance(version_payload, dict):
            continue
        existing = deepcopy(group_versions.get(version_key, {}))
        group_versions[version_key] = deep_merge(existing, version_payload)


def main() -> None:
    args = parse_args()
    master_path = args.master
    output_path = args.out or master_path
    master = load_json(master_path)

    seed_paths = sorted(Path(".").glob(args.seed_glob))
    if not seed_paths:
        raise FileNotFoundError(f"No seed files found for {args.seed_glob}")

    for seed_path in seed_paths:
        merge_seed(master, load_json(seed_path), seed_path)

    output_path.write_text(
        json.dumps(master, ensure_ascii=False, indent=2),
        encoding="utf-8",
    )
    print(output_path)


if __name__ == "__main__":
    main()
