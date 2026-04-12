export interface AuditLog {
  id: string;
  userId: string;
  projectId: string | null;
  action: 'CREATE' | 'UPDATE' | 'DELETE' | 'STATUS_CHANGE';
  entity: 'project' | 'harness' | 'bom' | 'quote' | 'version' | 'scenario' | 'change' | 'tracking' | 'pricing' | 'setting' | 'alert';
  entityId: string;
  details: string | null;
  createdAt: string;
  user: {
    id: string;
    name: string;
    email: string;
  };
}
