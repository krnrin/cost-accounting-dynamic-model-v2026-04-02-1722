/**
 * useChangeTrail Hook (C22 — Issue #68)
 * 
 * React Hook for scenario change trail management
 */

import { useState, useCallback, useMemo } from 'react';
import {
  attemptTransition,
  buildTimeline,
  getAllowedActions,
  createChangeEvent,
  type ScenarioState,
  type ChangeEvent,
  type ChangeTimeline,
  type StateTransitionRule,
  type ChangeAction,
} from '@/engine/scenario_change_trail';

export interface UseChangeTrailReturn {
  currentState: ScenarioState;
  events: ChangeEvent[];
  timeline: ChangeTimeline | null;
  allowedActions: StateTransitionRule[];
  pendingApproval: ChangeEvent | null;

  transition: (targetState: ScenarioState, reason: string, userId: string) => { success: boolean; needsApproval?: boolean; error?: string };
  recordEvent: (action: ChangeAction, details: Record<string, unknown>, reason: string, userId: string) => void;
  approveTransition: (userId: string) => void;
  rejectTransition: (userId: string, reason: string) => void;
  refreshTimeline: () => void;
}

export function useChangeTrail(
  scenarioId: string,
  initialState: ScenarioState = 'draft',
  initialEvents: ChangeEvent[] = [],
): UseChangeTrailReturn {
  const [currentState, setCurrentState] = useState<ScenarioState>(initialState);
  const [events, setEvents] = useState<ChangeEvent[]>(initialEvents);
  const [pendingApproval, setPendingApproval] = useState<ChangeEvent | null>(null);
  const [timeline, setTimeline] = useState<ChangeTimeline | null>(null);

  const allowedActions = useMemo(() => getAllowedActions(currentState), [currentState]);

  const transition = useCallback((targetState: ScenarioState, reason: string, userId: string) => {
    const result = attemptTransition(scenarioId, userId, currentState, targetState, reason);
    if ('error' in result) {
      return { success: false, error: result.error };
    }
    if (result.needsApproval) {
      setPendingApproval(result.event);
      return { success: true, needsApproval: true };
    }
    setEvents(prev => [...prev, result.event]);
    setCurrentState(targetState);
    return { success: true };
  }, [scenarioId, currentState]);

  const recordEvent = useCallback((action: ChangeAction, details: Record<string, unknown>, reason: string, userId: string) => {
    const event = createChangeEvent(scenarioId, userId, action, details, reason);
    setEvents(prev => [...prev, event]);
  }, [scenarioId]);

  const approveTransition = useCallback((userId: string) => {
    if (!pendingApproval) return;
    const approvalEvent = createChangeEvent(
      scenarioId, userId, 'approve',
      { approvedEventId: pendingApproval.id },
      `审批通过: ${pendingApproval.action}`,
    );
    setEvents(prev => [...prev, pendingApproval, approvalEvent]);
    if (pendingApproval.toState) setCurrentState(pendingApproval.toState);
    setPendingApproval(null);
  }, [scenarioId, pendingApproval]);

  const rejectTransition = useCallback((userId: string, reason: string) => {
    if (!pendingApproval) return;
    const rejectEvent = createChangeEvent(
      scenarioId, userId, 'reject',
      { rejectedEventId: pendingApproval.id },
      reason,
    );
    setEvents(prev => [...prev, rejectEvent]);
    setPendingApproval(null);
  }, [scenarioId, pendingApproval]);

  const refreshTimeline = useCallback(() => {
    setTimeline(buildTimeline(scenarioId, currentState, events));
  }, [scenarioId, currentState, events]);

  return {
    currentState, events, timeline, allowedActions, pendingApproval,
    transition, recordEvent, approveTransition, rejectTransition, refreshTimeline,
  };
}

export default useChangeTrail;
