import { apiClient } from './apiClient';

type ExportType = 'excel' | 'pdf';

type ExportPayload = {
  projectId?: string;
  quoteId?: string;
};

function getToken(): string | null {
  try {
    const raw = localStorage.getItem('auth-storage');
    if (!raw) return null;
    return JSON.parse(raw)?.state?.token || null;
  } catch {
    return null;
  }
}

function downloadBlob(blob: Blob, filename: string) {
  const url = window.URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  window.setTimeout(() => {
    document.body.removeChild(link);
    window.URL.revokeObjectURL(url);
  }, 200);
}

function filenameFromDisposition(header: string | null, fallback: string) {
  if (!header) return fallback;
  const utf8Match = header.match(/filename="?([^";]+)"?/i);
  if (!utf8Match?.[1]) return fallback;
  try {
    return decodeURIComponent(utf8Match[1]);
  } catch {
    return utf8Match[1];
  }
}

export async function downloadExport(type: ExportType, payload: ExportPayload, fallbackName: string) {
  const token = getToken();
  const response = await fetch(`/api/export/${type}`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: JSON.stringify(payload),
  });

  if (!response.ok) {
    let message = '导出失败';
    try {
      const json = await response.json();
      message = json.error || message;
    } catch {
      // ignore
    }
    throw new Error(message);
  }

  const blob = await response.blob();
  const filename = filenameFromDisposition(response.headers.get('content-disposition'), fallbackName);
  downloadBlob(blob, filename);
}

export async function exportProjectExcel(projectId: string) {
  await downloadExport('excel', { projectId }, 'project-export.xlsx');
}

export async function exportProjectPdf(projectId: string) {
  await downloadExport('pdf', { projectId }, 'project-report.pdf');
}

export async function exportQuoteExcel(quoteId: string) {
  await downloadExport('excel', { quoteId }, 'quote-export.xlsx');
}

export async function exportQuotePdf(quoteId: string) {
  await downloadExport('pdf', { quoteId }, 'quote-report.pdf');
}

export async function assertExportApi() {
  await apiClient('/projects');
}
