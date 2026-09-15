import { apiFetch, apiFetchBlob, parseDate } from './client';
import {
  DocumentCategory,
  EmployeeDocument,
} from '@/types/document';

interface ApiEmployeeDocument {
  id: number;
  employee: number;
  employee_name: string;
  employee_email?: string;
  title: string;
  category: DocumentCategory;
  category_label: string;
  description?: string;
  file_name?: string | null;
  uploaded_by_name?: string | null;
  created_at: string;
  updated_at: string;
}

function mapDocument(row: ApiEmployeeDocument): EmployeeDocument {
  return {
    id: String(row.id),
    employeeId: String(row.employee),
    employeeName: row.employee_name,
    employeeEmail: row.employee_email || '',
    title: row.title,
    category: row.category,
    categoryLabel: row.category_label,
    description: row.description || '',
    fileName: row.file_name || 'document',
    uploadedByName: row.uploaded_by_name,
    createdAt: parseDate(row.created_at) || new Date(row.created_at),
    updatedAt: parseDate(row.updated_at) || new Date(row.updated_at),
  };
}

export interface ListDocumentsParams {
  employeeId?: string;
  category?: DocumentCategory | 'all';
  search?: string;
}

export async function listEmployeeDocuments(
  params: ListDocumentsParams = {},
): Promise<EmployeeDocument[]> {
  const query = new URLSearchParams();
  if (params.employeeId) query.set('employee_id', params.employeeId);
  if (params.category && params.category !== 'all') {
    query.set('category', params.category);
  }
  if (params.search?.trim()) query.set('search', params.search.trim());
  const qs = query.toString();
  const data = await apiFetch<ApiEmployeeDocument[]>(
    `/employee-documents/${qs ? `?${qs}` : ''}`,
  );
  return data.map(mapDocument);
}

function buildFormData(payload: {
  employeeId?: string;
  title: string;
  category: DocumentCategory;
  description?: string;
  file?: File | null;
}): FormData {
  const formData = new FormData();
  if (payload.employeeId) {
    formData.append('employee_id', payload.employeeId);
  }
  formData.append('title', payload.title);
  formData.append('category', payload.category);
  formData.append('description', payload.description || '');
  if (payload.file) {
    formData.append('file', payload.file);
  }
  return formData;
}

export async function createEmployeeDocument(payload: {
  employeeId: string;
  title: string;
  category: DocumentCategory;
  description?: string;
  file: File;
}): Promise<EmployeeDocument> {
  const data = await apiFetch<ApiEmployeeDocument>('/employee-documents/', {
    method: 'POST',
    body: buildFormData(payload),
  });
  return mapDocument(data);
}

export async function updateEmployeeDocument(
  id: string,
  payload: {
    employeeId?: string;
    title: string;
    category: DocumentCategory;
    description?: string;
    file?: File | null;
  },
): Promise<EmployeeDocument> {
  const data = await apiFetch<ApiEmployeeDocument>(`/employee-documents/${id}/`, {
    method: 'PATCH',
    body: buildFormData(payload),
  });
  return mapDocument(data);
}

export async function deleteEmployeeDocument(id: string): Promise<void> {
  await apiFetch<void>(`/employee-documents/${id}/`, { method: 'DELETE' });
}

function triggerBrowserDownload(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = filename;
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  URL.revokeObjectURL(url);
}

export async function downloadEmployeeDocument(
  doc: EmployeeDocument,
  options: { inline?: boolean } = {},
): Promise<void> {
  const qs = options.inline ? '?inline=1' : '';
  const { blob, filename } = await apiFetchBlob(
    `/employee-documents/${doc.id}/download/${qs}`,
  );
  const name = filename || doc.fileName || 'document';

  if (options.inline) {
    const url = URL.createObjectURL(blob);
    window.open(url, '_blank', 'noopener,noreferrer');
    // Revoke after the new tab has had time to load.
    window.setTimeout(() => URL.revokeObjectURL(url), 60_000);
    return;
  }

  triggerBrowserDownload(blob, name);
}
