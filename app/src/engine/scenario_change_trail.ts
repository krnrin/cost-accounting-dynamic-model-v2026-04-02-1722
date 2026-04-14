/**
 * Scenario Change Trail (C22 — Issue #68)
 * 
 * 场景冻结/发布/变更轨迹
 * - 场景状态机: draft → frozen → published → archived
 * - 每次变更记录事件(who/when/what/why)
 * - 变更回放: 按时间线查看历史事件
 */

// ─── Types ───

export type ScenarioState = 'draft' | 'frozen' | 'published' | 'archived';

export interface ChangeEvent {
  id: string;
  scenarioId: string;
  timestamp: string;
  userId: string;
  action: ChangeAction;
  fromState?: ScenarioState;
  toState?: ScenarioState;
  details: Record<string, unknown>;
  reason: string;
}

export type ChangeAction =
  | 'create'
  | 'update_param'
  | 'update_bom'
  | 'freeze'
  | 'unfreeze'
  | 'publish'
  | 'archive'
  | 'restore'
  | 'clone'
  | 'approve'
  | 'reject';

export interface StateTransitionRule {
  from: ScenarioState;
  to: ScenarioState;
  action: ChangeAction;
  requiresApproval: boolean;
  requiresReason: boolean;
}

export interface ChangeTimeline {
  scenarioId: string;
  currentState: ScenarioState;
  events: ChangeEvent[];
  stateHistory: Array<{ state: ScenarioState; enteredAt: string; duration: number | null }>;
}

// ─── Valid Transitions ───

const VALID_TRANSITIONS: StateTransitionRule[] = [
  { from: 'draft', to: 'frozen', action: 'freeze', requiresApproval: false, requiresReason: true },
  { from: 'frozen', to: 'draft', action: 'unfreeze', requiresApproval: true, requiresReason: true },
  { from: 'frozen', to: 'published', action: 'publish', requiresApproval: true, requiresReason: false },
  { from: 'published', to: 'archived', action: 'archive', requiresApproval: false, requiresReason: true },
  { from: 'archived', to: 'draft', action: 'restore', requiresApproval: true, requiresReason: true },
];

// ─── Core Functions ───

/** Check if a state transition is valid */
export function canTransition(from: ScenarioState, to: ScenarioState): StateTransitionRule | null {
  return VALID_TRANSITIONS.find(t => t.from === from && t.to === to) || null;
}

/** Record a change event */
export function createChangeEvent(
  scenarioId: string,
  userId: string,
  action: ChangeAction,
  details: Record<string, unknown> = {},
  reason: string = '',
  fromState?: ScenarioState,
  toState?: ScenarioState,
): ChangeEvent {
  return {
    id: `evt-${scenarioId}-${Date.now().toString(36)}`,
    scenarioId,
    timestamp: new Date().toISOString(),
    userId,
    action,
    fromState,
    toState,
    details,
    reason,
  };
}

/** Attempt a state transition, returns event or null if invalid */
export function attemptTransition(
  scenarioId: string,
  userId: string,
  currentState: ScenarioState,
  targetState: ScenarioState,
  reason: string,
): { event: ChangeEvent; needsApproval: boolean } | { error: string } {
  const rule = canTransition(currentState, targetState);
  if (!rule) {
    return { error: `不允许从 ${currentState} 转换到 ${targetState}` };
  }
  if (rule.requiresReason && !reason.trim()) {
    return { error: '此状态变更需要提供原因' };
  }

  const event = createChangeEvent(
    scenarioId, userId, rule.action,
    { transition: `${currentState} → ${targetState}` },
    reason, currentState, targetState,
  );

  return { event, needsApproval: rule.requiresApproval };
}

/** Build timeline from events */
export function buildTimeline(
  scenarioId: string,
  currentState: ScenarioState,
  events: ChangeEvent[],
): ChangeTimeline {
  const sorted = [...events]
    .filter(e => e.scenarioId === scenarioId)
    .sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime());

  // Build state history
  const stateHistory: ChangeTimeline['stateHistory'] = [];
  let lastState: ScenarioState = 'draft';
  let lastTime = sorted[0]?.timestamp || new Date().toISOString();

  for (const evt of sorted) {
    if (evt.toState && evt.toState !== lastState) {
      const duration = new Date(evt.timestamp).getTime() - new Date(lastTime).getTime();
      stateHistory.push({ state: lastState, enteredAt: lastTime, duration });
      lastState = evt.toState;
      lastTime = evt.timestamp;
    }
  }
  // Current state (no end duration)
  stateHistory.push({ state: currentState, enteredAt: lastTime, duration: null });

  return { scenarioId, currentState, events: sorted, stateHistory };
}

/** Get allowed next actions from current state */
export function getAllowedActions(currentState: ScenarioState): StateTransitionRule[] {
  return VALID_TRANSITIONS.filter(t => t.from === currentState);
}
