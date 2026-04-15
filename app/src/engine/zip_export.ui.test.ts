import { describe, it, expect, vi, beforeEach } from 'vitest';
import { exportProjectZip } from './zip_export';
import JSZip from 'jszip';
import * as projectIO from './project_io';

// Mock JSZip
vi.mock('jszip', () => {
  return {
    default: vi.fn().mockImplementation(() => ({
      file: vi.fn(),
      generateAsync: vi.fn().mockResolvedValue(new Blob(['test'], { type: 'application/zip' })),
    })),
  };
});

// Mock project_io
vi.mock('./project_io', () => ({
  exportProjectPackage: vi.fn(),
}));

// Mock db
vi.mock('@/data/db', () => ({
  db: {
    importLogs: {
      where: vi.fn().mockReturnThis(),
      equals: vi.fn().mockReturnThis(),
      toArray: vi.fn().mockResolvedValue([]),
    },
    versions: {
      where: vi.fn().mockReturnThis(),
      equals: vi.fn().mockReturnThis(),
      toArray: vi.fn().mockResolvedValue([]),
    },
    quoteSnapshots: {
      where: vi.fn().mockReturnThis(),
      equals: vi.fn().mockReturnThis(),
      toArray: vi.fn().mockResolvedValue([]),
    },
  },
}));

vi.mock('./quote_snapshot', () => ({
  compareQuoteSnapshots: vi.fn().mockReturnValue({
    paramDiffs: [{ field: 'laborRate', label: '人工费率', valueA: 28.6, valueB: 30.1 }],
    resultDiffs: [{ harnessId: 'H1', field: 'deliveredPrice', label: '到厂价', valueA: 100, valueB: 102, change: 2, changeRate: 0.02 }],
  }),
}));

// Mock URL and document
global.URL.createObjectURL = vi.fn().mockReturnValue('blob:url');
global.URL.revokeObjectURL = vi.fn();

describe('zip_export', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('exports project zip with required files', async () => {
    const mockPackage = {
      project: { meta: { projectName: 'Test Project' }, config: { costRates: {}, metalPrices: {} } },
      harnesses: [{ harnessId: 'H1', harnessName: 'Harness 1', input: { bom: [] } }],
      quotes: [],
    };
    (projectIO.exportProjectPackage as any).mockResolvedValue(mockPackage);

    // Mock document.createElement
    const mockAnchor = {
      click: vi.fn(),
      href: '',
      download: '',
    };
    const createElementSpy = vi.spyOn(document, 'createElement').mockReturnValue(mockAnchor as any);
    const appendChildSpy = vi.spyOn(document.body, 'appendChild').mockImplementation(() => ({} as any));

    await exportProjectZip('p1');

    const zipInstance = vi.mocked(JSZip).mock.results[0].value;
    
    expect(zipInstance.file).toHaveBeenCalledWith('project.json', expect.any(String));
    expect(zipInstance.file).toHaveBeenCalledWith('bom_data.json', expect.any(String));
    expect(zipInstance.file).toHaveBeenCalledWith('usage/README.md', expect.stringContaining('# 使用说明'));
    expect(zipInstance.generateAsync).toHaveBeenCalledWith({ type: 'blob' });
    
    expect(mockAnchor.download).toContain('Test Project');
    expect(mockAnchor.click).toHaveBeenCalled();
    
    createElementSpy.mockRestore();
    appendChildSpy.mockRestore();
  });

  it('handles empty project gracefully', async () => {
    (projectIO.exportProjectPackage as any).mockResolvedValue({
      project: null,
      harnesses: [],
      quotes: [],
    });

    await exportProjectZip('empty');

    const zipInstance = vi.mocked(JSZip).mock.results[0].value;
    expect(zipInstance.file).toHaveBeenCalledWith('project.json', expect.stringContaining('"project": null'));
  });

  it('exports quote snapshots and verification report when history exists', async () => {
    const mockPackage = {
      project: { meta: { projectName: 'Test Project' }, config: { costRates: {}, metalPrices: {} } },
      harnesses: [],
      quotes: [{ id: 'q1' }],
    };
    (projectIO.exportProjectPackage as any).mockResolvedValue(mockPackage);

    const { db } = await import('@/data/db');
    (db.quoteSnapshots.toArray as any).mockResolvedValue([
      {
        id: 'qs1',
        quoteId: 'q1',
        scenarioId: 's1',
        projectId: 'p1',
        version: 1,
        label: 'v1',
        createdAt: '2026-04-16T01:00:00.000Z',
        params: { costRates: {}, metalPrices: { copper: 1, aluminum: 2 } },
        results: { harnessResults: [], totalMaterialCost: 0, totalExFactoryPrice: 0, totalDeliveredPrice: 100, totalCopperWeight: 0, totalAluminumWeight: 0 },
      },
      {
        id: 'qs2',
        quoteId: 'q2',
        scenarioId: 's1',
        projectId: 'p1',
        version: 2,
        label: 'v2',
        createdAt: '2026-04-16T02:00:00.000Z',
        params: { costRates: {}, metalPrices: { copper: 1, aluminum: 2 } },
        results: { harnessResults: [], totalMaterialCost: 0, totalExFactoryPrice: 0, totalDeliveredPrice: 102, totalCopperWeight: 0, totalAluminumWeight: 0 },
      },
    ]);

    const mockAnchor = {
      click: vi.fn(),
      href: '',
      download: '',
    };
    const createElementSpy = vi.spyOn(document, 'createElement').mockReturnValue(mockAnchor as any);
    const appendChildSpy = vi.spyOn(document.body, 'appendChild').mockImplementation(() => ({} as any));

    await exportProjectZip('p1');

    const zipInstance = vi.mocked(JSZip).mock.results[0].value;
    expect(zipInstance.file).toHaveBeenCalledWith('quote_snapshots.json', expect.any(String));
    expect(zipInstance.file).toHaveBeenCalledWith(
      'verification/quote_snapshot_diff_v1_to_v2.md',
      expect.stringContaining('# Quote Snapshot Verification Report'),
    );
    expect(zipInstance.file).toHaveBeenCalledWith(
      'usage/README.md',
      expect.stringContaining('## 最新报价快照中的工厂费率来源'),
    );
    expect(zipInstance.file).toHaveBeenCalledWith(
      'usage/README.md',
      expect.stringContaining('工厂费率来源: 未记录'),
    );
    expect(zipInstance.file).toHaveBeenCalledWith(
      'usage/README.md',
      expect.stringContaining('## 最新报价快照中的工厂费率来源'),
    );
    expect(zipInstance.file).toHaveBeenCalledWith(
      'usage/README.md',
      expect.stringContaining('工厂费率来源: 未记录'),
    );

    createElementSpy.mockRestore();
    appendChildSpy.mockRestore();
  });
});
