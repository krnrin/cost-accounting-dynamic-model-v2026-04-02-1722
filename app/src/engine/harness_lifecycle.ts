/**
 * 线束生命周期工具 — 处理场景内单线束提前 EOP
 */
import type { VolumeSchedule } from '@/types/project';

/** 按线束 EOP 年份裁剪产量计划，EOP 后年份产量归零 */
export function clampVolumesToEop(
  volumes: VolumeSchedule[],
  eopYear: number | null,
): VolumeSchedule[] {
  if (eopYear == null) return volumes;
  return volumes.map(v => ({
    ...v,
    volume: v.year <= eopYear ? v.volume : 0,
  }));
}

/** 计算线束有效生命周期年数 */
export function effectiveLifecycleYears(
  scenarioLifecycleYears: number,
  eopYear: number | null,
): number {
  if (eopYear == null) return scenarioLifecycleYears;
  return Math.min(eopYear, scenarioLifecycleYears);
}
