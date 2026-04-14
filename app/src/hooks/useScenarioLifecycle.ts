/**
 * useScenarioLifecycle — 场景生命周期 hook
 *
 * 桥接 engine/scenario_lifecycle 到页面层
 * 为 ProjectScenariosPage 提供：
 *   - 状态机校验（canTransition / isEditable）
 *   - 动态操作按钮（getAvailableTransitions）
 *   - 状态颜色 & 图标
 *
 * 集成方式（ProjectScenariosPage.tsx）：
 *   import { useScenarioLifecycle, getTransitionLabel } from '@/hooks/useScenarioLifecycle';
 *   // 在操作列中：
 *   const lifecycle = useScenarioLifecycle(record.status);
 *   // lifecycle.editable       → 控制编辑按钮 disabled
 *   // lifecycle.availableTransitions → 动态渲染操作按钮
 *   // lifecycle.statusColor    → Tag color
 *   // lifecycle.statusIcon     → 状态前缀 emoji
 */
import { useCallback, useMemo } from 'react';
import {
  isEditable,
  getAvailableTransitions,
  canTransition,
  getStatusColor,
  getStatusIcon,
} from '@/engine/scenario_lifecycle';

export interface ScenarioLifecycleInfo {
  /** 当前状态下是否可编辑场景参数 */
  editable: boolean;
  /** 当前状态可转换的目标状态列表 */
  availableTransitions: any[];
  /** 状态对应的显示颜色 */
  statusColor: string;
  /** 状态对应的图标 emoji */
  statusIcon: string;
  /** 检查是否可以转换到指定目标状态 */
  canTransitionTo: (target: string) => boolean;
}

/**
 * 封装 scenario_lifecycle 引擎的 React hook
 * @param currentStatus 当前场景状态 (draft | frozen | published | archived)
 */
export function useScenarioLifecycle(currentStatus: string | undefined): ScenarioLifecycleInfo {
  const editable = useMemo(
    () => (currentStatus ? isEditable(currentStatus as any) : true),
    [currentStatus],
  );

  const availableTransitions = useMemo(
    () => (currentStatus ? getAvailableTransitions(currentStatus as any) : []),
    [currentStatus],
  );

  const statusColor = useMemo(
    () => (currentStatus ? getStatusColor(currentStatus as any) : 'grey'),
    [currentStatus],
  );

  const statusIcon = useMemo(
    () => (currentStatus ? getStatusIcon(currentStatus as any) : ''),
    [currentStatus],
  );

  const canTransitionTo = useCallback(
    (target: string) => (currentStatus ? canTransition(currentStatus as any, target as any) : false),
    [currentStatus],
  );

  return {
    editable,
    availableTransitions,
    statusColor,
    statusIcon,
    canTransitionTo,
  };
}

/** 状态转换的中文标签 */
const TRANSITION_LABELS: Record<string, string> = {
  frozen: '冻结',
  published: '发布',
  archived: '归档',
  draft: '回退草稿',
};

export function getTransitionLabel(transition: string): string {
  return TRANSITION_LABELS[transition] || transition;
}

/** 状态转换的确认提示文案 */
export function getTransitionConfirmText(scenarioName: string, transition: string): string {
  if (transition === 'frozen') {
    return '冻结后将生成版本快照且参数不可修改，确认冻结“' + scenarioName + '”吗？';
  }
  if (transition === 'published') {
    return '发布后将生成正式版本，确认发布“' + scenarioName + '”吗？';
  }
  if (transition === 'archived') {
    return '归档后场景将不可操作，确认归档“' + scenarioName + '”吗？';
  }
  return '确认执行此操作吗？';
}

/** 状态中文标签 */
const STATUS_LABELS: Record<string, string> = {
  draft: '草稿',
  frozen: '已冻结',
  published: '已发布',
  archived: '已归档',
};

export function getStatusLabel(status: string): string {
  return STATUS_LABELS[status] || status;
}
