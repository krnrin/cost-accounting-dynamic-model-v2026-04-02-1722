/**
 * ChangeOrderWizard — 变更单向导（占位组件）
 */

import type { ChangeOrder } from '@/engine/change_verification';

export interface ChangeOrderWizardProps {
  visible: boolean;
  onClose: () => void;
  onSubmit: (order: ChangeOrder) => void;
  availableParts?: string[];
}

export default function ChangeOrderWizard(_props: ChangeOrderWizardProps) {
  return null;
}
