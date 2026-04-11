;(function (global) {
  'use strict';

  function cloneSteps(plan) {
    const steps = Array.isArray(plan && plan.plannedSteps) ? plan.plannedSteps : [];
    return steps.map((step, index) => ({
      key: step.phase || step.key || `step-${index + 1}`,
      label: step.label || step.phase || `步骤 ${index + 1}`,
      description: step.description || '',
      impacts: Array.isArray(step.impacts) ? step.impacts.slice() : [],
      status: 'pending',
      completedAt: '',
      note: '',
    }));
  }

  function findNextPendingIndex(steps) {
    return steps.findIndex((step) => step.status === 'pending');
  }

  function buildWizardState(plan) {
    const steps = cloneSteps(plan);
    const nextIndex = findNextPendingIndex(steps);
    return {
      status: steps.length ? 'ready' : 'idle',
      currentIndex: nextIndex >= 0 ? nextIndex : null,
      steps,
      changeSet: plan && plan.changeSet ? plan.changeSet : null,
      summary: plan && plan.summary ? plan.summary : null,
      createdAt: new Date().toISOString(),
    };
  }

  function getCurrentStep(state) {
    if (!state || state.currentIndex == null) return null;
    return state.steps && state.steps[state.currentIndex] ? state.steps[state.currentIndex] : null;
  }

  function confirmCurrentStep(state, options) {
    const nextState = state || null;
    const safeOptions = options || {};
    const current = getCurrentStep(nextState);
    if (!current) return nextState;
    current.status = 'completed';
    current.completedAt = safeOptions.completedAt || new Date().toISOString();
    current.note = safeOptions.note || '';
    const nextIndex = findNextPendingIndex(nextState.steps || []);
    nextState.currentIndex = nextIndex >= 0 ? nextIndex : null;
    nextState.status = nextIndex >= 0 ? 'ready' : 'completed';
    return nextState;
  }

  function cancelWizard(state, options) {
    const nextState = state || null;
    if (!nextState) return nextState;
    nextState.status = 'cancelled';
    nextState.cancelledAt = (options && options.at) || new Date().toISOString();
    nextState.cancelReason = (options && options.reason) || '';
    return nextState;
  }

  function wizardHasPendingSteps(state) {
    return Boolean(state && Array.isArray(state.steps) && state.steps.some((step) => step.status === 'pending'));
  }

  global.G281BomSyncWizard = {
    buildWizardState,
    getCurrentStep,
    confirmCurrentStep,
    cancelWizard,
    wizardHasPendingSteps,
  };
})(typeof globalThis !== 'undefined' ? globalThis : typeof window !== 'undefined' ? window : this);
