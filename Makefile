# ============================================================
# Makefile — 统一 Python 数据管道
# 用法: make data  (生成全部 JSON 数据文件)
# ============================================================

PYTHON ?= python3
SCRIPTS := scripts
DATA    := data

# 源 Excel 文件 (根目录)
SOURCE_QUOTE   := 吉利E281报价核算.xlsx
SOURCE_FIXED   := 吉利E281定点核算.xlsx
SOURCE_BOM_Q   := G281项目\ 报价BOM\ V03-12.4.xlsx
SOURCE_BOM_F   := G281\ 国内项目\ 定点BOM\ V06-2026.01.20【变更履历待更新】.xlsx
SOURCE_TT      := G281\ TT_实际开线长度已回填.xlsx
SOURCE_PROTO   := G281高压协议价.xlsx

.PHONY: data clean help

help:
	@echo 'make data    — 从 Excel 生成全部 JSON 数据文件到 data/ 目录'
	@echo 'make clean   — 删除 data/ 下所有生成的 JSON'
	@echo ''
	@echo '单独生成:'
	@echo '  make bom-validation'
	@echo '  make bom-versions'
	@echo '  make bom-workbook-copies'
	@echo '  make capital-validation'
	@echo '  make config-sheet-copies'
	@echo '  make financial-versions'
	@echo '  make labor-validation'
	@echo '  make packaging-validation'
	@echo '  make wire-catalog'

data: bom-validation bom-versions bom-workbook-copies capital-validation \
      config-sheet-copies financial-versions labor-validation \
      packaging-validation wire-catalog
	@echo '\n✅ 全部数据文件已生成到 $(DATA)/'

bom-validation:
	$(PYTHON) $(SCRIPTS)/g281_generate_bom_validation.py

bom-versions:
	$(PYTHON) $(SCRIPTS)/g281_generate_bom_versions.py

bom-workbook-copies:
	$(PYTHON) $(SCRIPTS)/g281_generate_bom_workbook_copies.py

capital-validation:
	$(PYTHON) $(SCRIPTS)/g281_generate_capital_validation.py

config-sheet-copies:
	$(PYTHON) $(SCRIPTS)/g281_generate_config_sheet_copies.py

financial-versions:
	$(PYTHON) $(SCRIPTS)/g281_generate_financial_versions.py

labor-validation:
	$(PYTHON) $(SCRIPTS)/g281_generate_labor_validation.py

packaging-validation:
	$(PYTHON) $(SCRIPTS)/g281_generate_packaging_validation.py

wire-catalog:
	$(PYTHON) $(SCRIPTS)/g281_generate_wire_catalog.py

clean:
	rm -f $(DATA)/g281_data_*.json
	@echo '已清理生成的数据文件'
