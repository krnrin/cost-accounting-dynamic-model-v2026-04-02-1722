import { describe, it, expect } from 'vitest';
import { hasPermission, type UserRole, type PermissionField } from '../usePermission';

describe('hasPermission', () => {
  it('should return true when no role is provided (offline mode)', () => {
    expect(hasPermission(null, 'profit')).toBe(true);
    expect(hasPermission(undefined, 'costRates')).toBe(true);
    expect(hasPermission('', 'deleteProject')).toBe(true);
  });

  it('should return true for unknown roles (safe default for offline)', () => {
    expect(hasPermission('GUEST', 'profit' as PermissionField)).toBe(true);
  });

  it('ADMIN should have access to all fields', () => {
    const fields: PermissionField[] = [
      'profit',
      'costRates',
      'metalPrice',
      'bomEdit',
      'deleteProject',
    ];
    fields.forEach(field => {
      expect(hasPermission('ADMIN', field)).toBe(true);
    });
  });

  it('VIEWER should only have access to their allowed fields (none of the restricted ones)', () => {
    const restrictedFields: PermissionField[] = [
      'profit',
      'metalPrice',
      'bomEdit',
      'costRates',
      'deleteProject',
    ];
    restrictedFields.forEach(field => {
      expect(hasPermission('VIEWER', field)).toBe(false);
    });
  });

  it('ENGINEER should have access to ENGINEER+ fields but not MANAGER+ or ADMIN only fields', () => {
    expect(hasPermission('ENGINEER', 'metalPrice')).toBe(true);
    expect(hasPermission('ENGINEER', 'bomEdit')).toBe(true);
    expect(hasPermission('ENGINEER', 'simulation')).toBe(true);
    
    expect(hasPermission('ENGINEER', 'profit')).toBe(false);
    expect(hasPermission('ENGINEER', 'internalCost')).toBe(false);
    expect(hasPermission('ENGINEER', 'costRates')).toBe(false);
    expect(hasPermission('ENGINEER', 'deleteProject')).toBe(false);
  });

  it('MANAGER should have access to MANAGER+ fields but not ADMIN only fields', () => {
    expect(hasPermission('MANAGER', 'profit')).toBe(true);
    expect(hasPermission('MANAGER', 'internalCost')).toBe(true);
    expect(hasPermission('MANAGER', 'versionLock')).toBe(true);
    expect(hasPermission('MANAGER', 'auditLog')).toBe(true);
    
    expect(hasPermission('MANAGER', 'costRates')).toBe(false);
    expect(hasPermission('MANAGER', 'deleteProject')).toBe(false);
  });

  it('should check specific fields against their minimum role requirements correctly', () => {
    // profit -> MANAGER
    expect(hasPermission('VIEWER', 'profit')).toBe(false);
    expect(hasPermission('ENGINEER', 'profit')).toBe(false);
    expect(hasPermission('MANAGER', 'profit')).toBe(true);
    expect(hasPermission('ADMIN', 'profit')).toBe(true);

    // costRates -> ADMIN
    expect(hasPermission('MANAGER', 'costRates')).toBe(false);
    expect(hasPermission('ADMIN', 'costRates')).toBe(true);

    // metalPrice -> ENGINEER
    expect(hasPermission('VIEWER', 'metalPrice')).toBe(false);
    expect(hasPermission('ENGINEER', 'metalPrice')).toBe(true);
    expect(hasPermission('MANAGER', 'metalPrice')).toBe(true);
    expect(hasPermission('ADMIN', 'metalPrice')).toBe(true);

    // deleteProject -> ADMIN
    expect(hasPermission('MANAGER', 'deleteProject')).toBe(false);
    expect(hasPermission('ADMIN', 'deleteProject')).toBe(true);

    // deleteHarness -> MANAGER
    expect(hasPermission('ENGINEER', 'deleteHarness')).toBe(false);
    expect(hasPermission('MANAGER', 'deleteHarness')).toBe(true);
  });

  it('should deny ENGINEEER for profitRate', () => {
    expect(hasPermission('ENGINEER', 'profitRate')).toBe(false);
  });

  it('should deny VIEWER for bomEdit', () => {
    expect(hasPermission('VIEWER', 'bomEdit')).toBe(false);
  });

  it('should allow ENGINEER for quoteExport', () => {
    expect(hasPermission('ENGINEER', 'quoteExport')).toBe(true);
  });

  it('should allow MANAGER for versionLock', () => {
    expect(hasPermission('MANAGER', 'versionLock')).toBe(true);
  });
});
