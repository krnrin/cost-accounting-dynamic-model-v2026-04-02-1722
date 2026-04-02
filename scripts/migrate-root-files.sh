#!/usr/bin/env bash
set -euo pipefail

echo '=== Step 1: 创建目标目录 ==='
mkdir -p engine ui/modals core data scripts

echo '=== Step 2: JS 业务逻辑 → engine/ ==='
for pair in \
  'g281_bom_alignment_engine.js:engine/bom_alignment_engine.js' \
  'g281_bom_diff_engine.js:engine/bom_diff_engine.js' \
  'g281_bom_io.js:engine/bom_io.js' \
  'g281_bom_semantic_repo.js:engine/bom_semantic_repo.js' \
  'g281_bom_template_runtime.js:engine/bom_template_runtime.js'; do
  src="${pair%%:*}"; dst="${pair##*:}"
  [ -f "$src" ] && git mv "$src" "$dst" && echo "  $src → $dst"
done

echo '=== Step 3: JS 数据仓库 → core/ ==='
for pair in \
  'g281_factor_version_repo.js:core/factor_version_repo.js' \
  'g281_scenario_repo.js:core/scenario_repo.js'; do
  src="${pair%%:*}"; dst="${pair##*:}"
  [ -f "$src" ] && git mv "$src" "$dst" && echo "  $src → $dst"
done

echo '=== Step 4: JS UI 视图 → ui/ ==='
for pair in \
  'g281_bom_validation_view.js:ui/bom_validation_view.js' \
  'g281_capital_validation_view.js:ui/capital_validation_view.js' \
  'g281_labor_validation_view.js:ui/labor_validation_view.js' \
  'g281_packaging_validation_view.js:ui/packaging_validation_view.js' \
  'g281_factory_efficiency_view.js:ui/factory_efficiency_view.js' \
  'g281_operating_labor_rate_data.js:ui/operating_labor_rate_data.js'; do
  src="${pair%%:*}"; dst="${pair##*:}"
  [ -f "$src" ] && git mv "$src" "$dst" && echo "  $src → $dst"
done

echo '=== Step 5: CSS → ui/ ==='
for pair in \
  'g281_bom_validation.css:ui/bom_validation.css' \
  'g281_factory_efficiency_view.css:ui/factory_efficiency_view.css'; do
  src="${pair%%:*}"; dst="${pair##*:}"
  [ -f "$src" ] && git mv "$src" "$dst" && echo "  $src → $dst"
done

echo '=== Step 6: JSON 数据文件 → data/ ==='
for f in g281_data_*.json; do
  [ -f "$f" ] && git mv "$f" "data/$f" && echo "  $f → data/$f"
done

echo '=== Step 7: Python 脚本 → scripts/ ==='
for f in g281_generate_*.py; do
  [ -f "$f" ] && git mv "$f" "scripts/$f" && echo "  $f → scripts/$f"
done
for f in g281_apply_version_seed_data.py g281_merge_version_seed_data.py \
         g281_sync_connector_initial_quotes.py e281_sync_wire_prices.py \
         g281_build_runtime_bundle.ps1 g281_publish_versioned_release.ps1; do
  [ -f "$f" ] && git mv "$f" "scripts/$f" && echo "  $f → scripts/$f"
done

echo '=== Step 8: 清理 AI 会话产物 ==='
for f in MEMORY.md AGENTS.md; do
  [ -f "$f" ] && git rm "$f" && echo "  已删除 $f"
done
for d in .agents .trellis memory; do
  [ -d "$d" ] && git rm -r "$d" && echo "  已删除 $d/"
done

echo '=== Step 9: 移动大型生成文件 ==='
[ -f 'g281_data_bundle.js' ] && git mv 'g281_data_bundle.js' 'data/g281_data_bundle.js' && echo '  g281_data_bundle.js → data/'

echo '=== Step 10: 移动规划文档 ==='
[ -f 'g281_profit_model_plan.md' ] && git mv 'g281_profit_model_plan.md' 'docs/profit_model_plan.md' && echo '  已移动'

echo ''
echo '✅ 文件迁移完成！'
echo '接下来你需要：'
echo '  1. 手动更新 ui/dashboard.html 中的 <script> 和 <link> 路径'
echo '  2. 搜索替换所有 ../g281_ 引用为新路径'
echo '  3. git add -A && git commit -m "chore: migrate root g281_* files to modular directories"'
echo '  4. 本地测试 dashboard.html 是否正常加载'
