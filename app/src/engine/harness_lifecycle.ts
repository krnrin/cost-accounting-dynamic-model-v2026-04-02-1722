/**
 * 线束生命周期工具 — 处理场景内单线束提前 EOP 或延迟 SOP
 */
import type { VolumeSchedule } from '@/types/project';

/** 线束生命周期参数 */
export interface HarnessLifecycleParams {
  /** 场景生命周期年数 */
  scenarioLifecycleYears: number;
  /** 线束 SOP 年份 (相对于项目基准年的偏移，0=基准年) */
  startYear?: number;
  /** 线束 EOP 年份 (相对于项目基准年的偏移) */
  eopYear?: number | null;
}

/** 按线束 SOP/EOP 年份裁剪产量计划 */
export function clampVolumesToLifecycle(
  volumes: VolumeSchedule[],
  params: HarnessLifecycleParams,
): VolumeSchedule[] {
  const { startYear = 0, eopYear = null } = params;
  return volumes.map(v => ({
    ...v,
    volume: v.year >= startYear && (eopYear == null || v.year <= eopYear) ? v.volume : 0,
  }));
}

/** 按线束 EOP 年份裁剪产量计划，EOP 后年份产量归零 (legacy API) */
export function clampVolumesToEop(
  volumes: VolumeSchedule[],
  eopYear: number | null,
): VolumeSchedule[] {
  // [PR-045] 修复：提供默认的 scenarioLifecycleYears
  return clampVolumesToLifecycle(volumes, { scenarioLifecycleYears: volumes.length, eopYear });
}

/** 计算线束有效生命周期年数 */
export function effectiveLifecycleYears(
  params: HarnessLifecycleParams,
): number {
  const { scenarioLifecycleYears, startYear = 0, eopYear = null } = params;
  const effectiveStart = Math.max(0, startYear);
  const effectiveEnd = eopYear != null ? Math.min(eopYear, scenarioLifecycleYears - 1) : scenarioLifecycleYears - 1;
  return Math.max(0, effectiveEnd - effectiveStart + 1);
}

/** Legacy API: 计算线束有效生命周期年数 (仅 EOP) */
export function effectiveLifecycleYearsLegacy(
  scenarioLifecycleYears: number,
  eopYear: number | null,
): number {
  return effectiveLifecycleYears({ scenarioLifecycleYears, eopYear });
}
