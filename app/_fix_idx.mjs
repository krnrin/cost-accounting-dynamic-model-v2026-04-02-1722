import fs from "fs";
const path = "src/types/index.ts";
let content = fs.readFileSync(path, "utf8");
const oldBlock = `export type {\n  InternalTemplateResult,\n  NreData, ChangeCategory, ChangePricingResult, ChangeItem,\n  ChangeSummary, AnnualImpact, AnnualImpactYear,\n  MetalContract, MetalDelta, MetalEscalationResult, MetalSensitivityMatrix,\n  AnnualDropResult,\n} from './quote';`;
const newBlock = `export type {\n  TemplateType,\n  GeelyRates, GeelyTemplateResult, BydTemplateResult, GenericTemplateResult,\n  InternalTemplateResult, NreData, TemplatePreset,\n  QuoteSheetMeta, QuoteSheet,\n  ChangeCategory, ChangePricingResult, ChangeItem,\n  ChangeSummary, AnnualImpact, AnnualImpactYear,\n  MetalContract, MetalDelta, MetalEscalationResult, MetalSensitivityMatrix,\n  AnnualDropResult,\n} from './quote';`;
if (\!content.includes(oldBlock)) { console.error("oldBlock not found"); process.exit(1); }
content = content.replace(oldBlock, newBlock);
fs.writeFileSync(path, content, "utf8");
