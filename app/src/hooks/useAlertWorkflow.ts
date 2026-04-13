/**
 * useAlertWorkflow — 预警工作流 hook
 *
 * 桥接 engine/alert_workflow 到页面层
 * 为 AlertsPage 提供：
 *   - 客户端实时预警检测（runAlertChecks）
 *   - 严重度评估（evaluateSeverity）
 *   - 升级判断（shouldEscalate）
 *   - 默认规则集（DEFAULT_ALERT_RULES，7 条内置规则）
 *
 * 集成方式（AlertsPage.tsx）：
 *   import { useAlertWorkflow } from '@/hooks/useAlertWorkflow';
 *   const workflow = useAlertWorkflow();
 *   // 在 handleDetect 中增加客户端预检：
 *   //   const clientAlerts = workflow.runChecks(scenarioData);
 *   //   if (clientAlerts.length > 0) Toast.warning(...);
 *   // 在规则创建表单中预填内置规则：
 *   //   workflow.defaultRules.forEach(rule => ...)
 */
import { useCallback, useRef } from 'react';
import {
  evaluateSeverity,
  shouldEscalate,
  createAlertEvent,
  runAlertChecks,
  DEFAULT_ALERT_RULES,
} from '@/engine/alert_workflow';

export interface ClientAlertCheckResult {
  /** 检测出的预警事件列表 */
  alerts: ReturnType<typeof runAlertChecks>;
  /** 检测时间 */
  checkedAt: string;
  /** 使用的规则数量 */
  ruleCount: number;
}

/**
 * 封装 alert_workflow 引擎的 React hook
 */
export function useAlertWorkflow() {
  const lastCheckRef = useRef<ClientAlertCheckResult | null>(null);

  /**
   * 在客户端运行预警检测
   * 可以在服务端 detectAlerts 之前先做客户端预检
   * @param data 场景/项目数据（金属价格、成本、BOM 等）
   * @param customRules 自定义规则（可选，默认使用 DEFAULT_ALERT_RULES）
   */
  const runChecks = useCallback(
    (values: Record<string, number>, customRules?: Parameters<typeof runAlertChecks>[0]) => {
      const rules = customRules || DEFAULT_ALERT_RULES;
      const alerts = runAlertChecks(rules, values);
      const result: ClientAlertCheckResult = {
        alerts,
        checkedAt: new Date().toISOString(),
        ruleCount: Array.isArray(rules) ? rules.length : 0,
      };
      lastCheckRef.current = result;
      return result;
    },
    [],
  );

  /**
   * 评估单个指标的严重度
   * 可用于实时显示当前值的风险等级
   */
  const assessSeverity = useCallback(
    (...args: Parameters<typeof evaluateSeverity>) => {
      return evaluateSeverity(...args);
    },
    [],
  );

  /**
   * 判断预警事件是否需要升级
   * 用于在预警列表中标记超时未处理的事件
   */
  const checkEscalation = useCallback(
    (...args: Parameters<typeof shouldEscalate>) => {
      return shouldEscalate(...args);
    },
    [],
  );

  /**
   * 创建预警事件对象（客户端构造，可用于本地展示或批量提交）
   */
  const buildAlertEvent = useCallback(
    (...args: Parameters<typeof createAlertEvent>) => {
      return createAlertEvent(...args);
    },
    [],
  );

  return {
    /** 客户端预警检测 */
    runChecks,
    /** 严重度评估 */
    assessSeverity,
    /** 升级判断 */
    checkEscalation,
    /** 构建预警事件对象 */
    buildAlertEvent,
    /** 内置默认规则集（7 条规则：铜价、铝价异动、成本漂移、BOM用量异常、报价过期、场景过期、参数不一致） */
    defaultRules: DEFAULT_ALERT_RULES,
    /** 上次检测结果引用 */
    lastCheck: lastCheckRef,
  };
}

/**
 * 严重度对应的显示信息
 */
export const SEVERITY_DISPLAY: Record<string, { color: string; label: string; priority: number }> = {
  info: { color: 'blue', label: '提示', priority: 0 },
  warning: { color: 'orange', label: '预警', priority: 1 },
  critical: { color: 'red', label: '严重', priority: 2 },
};
