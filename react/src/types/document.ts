export type DocumentCategory = 'payslip' | 'contract' | 'certificate' | 'other';

export interface EmployeeDocument {
  id: string;
  employeeId: string;
  employeeName: string;
  employeeEmail: string;
  title: string;
  category: DocumentCategory;
  categoryLabel: string;
  description: string;
  fileName: string;
  uploadedByName?: string | null;
  createdAt: Date;
  updatedAt: Date;
}

export const DOCUMENT_CATEGORY_LABELS: Record<DocumentCategory, string> = {
  payslip: 'Fiche de paie',
  contract: 'Contrat',
  certificate: 'Attestation',
  other: 'Autre',
};

export const DOCUMENT_CATEGORIES: DocumentCategory[] = [
  'payslip',
  'contract',
  'certificate',
  'other',
];
