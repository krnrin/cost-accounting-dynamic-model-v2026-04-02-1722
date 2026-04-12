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
  },
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
});
