import { defaultNumbering } from './numbering'
import type { AppState, Permission, Role, Settings } from './types'

export const defaultSettings: Settings = {
  googleClientId: (import.meta.env.VITE_GOOGLE_CLIENT_ID as string) || '',
  theme: 'auto',
  statuses: [
    { code: 'IFR', label: 'Issued For Review', color: '#d97706' },
    { code: 'IFA', label: 'Issued For Approval', color: '#7c3aed' },
    { code: 'IFC', label: 'Issued For Construction', color: '#16a34a' },
    { code: 'IFP', label: 'Issued For Purchase', color: '#0891b2' },
    { code: 'IFI', label: 'Issued For Information', color: '#64748b' },
    { code: 'TQ', label: 'Technical Query', color: '#be185d' },
  ],
  disciplines: ['Sipil', 'Struktur', 'Mekanikal', 'Perpipaan', 'Elektrikal', 'Instrument', 'Proses', 'HSE', 'Umum'],
  categories: ['Drawing', 'Specification', 'Calculation', 'Datasheet', 'Report', 'Procedure', 'Method Statement', 'Inspection & Test Plan', 'Vendor Document', 'Manual', 'As-Built', 'Minutes of Meeting', 'Correspondence'],
  numbering: defaultNumbering(),
  revisionScheme: 'alpha',
  defaultReviewDays: 14,
  autoSync: true,
  organization: '',
  report: {
    reviewer: 'PDM Zona III',
    workdays: 5,
    holidays: [],
    highlightNewDays: 7,
    paper: 'A4',
    period: 'weekly',
    scope: 'outstanding',
    lastStatuses: [
      { code: 'R', label: 'Dalam review' },
      { code: 'A', label: 'Disetujui' },
      { code: 'C', label: 'Dikembalikan dengan komentar' },
      { code: 'X', label: 'Ditolak' },
    ],
  },
  storage: {
    pathTemplate: '{projectcode} - {project}/{discipline}/{category}',
    fileTemplate: '{docnumber}-{title}-{status}',
    local: true,
    drive: true,
    webdav: { enabled: false, url: '', username: '' },
  },
  appName: 'DocControl',
  appTagline: 'Kontrol Dokumen Proyek',
  appLogo: '',
  accentColor: '#1d4ed8',
  orgAddress: '',
  orgPhone: '',
  orgEmail: '',
  orgWebsite: '',
  loginMessage: '',
  footerText: '',
  sessionTimeoutMin: 30,
  maxAttempts: 5,
  lockMinutes: 10,
  minPasswordLength: 12,
}

export const PERMISSIONS: [Permission, string][] = [
  ['project.manage', 'Kelola proyek (buat, ubah, arsip, hapus)'],
  ['doc.create', 'Mencatat dokumen baru'],
  ['doc.edit', 'Mengubah data dokumen'],
  ['doc.delete', 'Menghapus dokumen / revisi'],
  ['revision.issue', 'Menerbitkan revisi & status (IFR/IFA/IFC/IFP/IFI)'],
  ['review.record', 'Mencatat hasil review'],
  ['transmittal.manage', 'Kelola transmittal'],
  ['export', 'Ekspor data (CSV)'],
  ['logs.view', 'Melihat log aktivitas'],
  ['settings.manage', 'Mengubah pengaturan aplikasi & backup'],
  ['users.manage', 'Kelola pengguna & peran'],
]
const ALL = PERMISSIONS.map(([p]) => p)

export const defaultRoles = (): Role[] => [
  { id: 'admin', name: 'Administrator', description: 'Akses penuh ke semua fitur dan pengaturan', permissions: ALL, builtIn: true },
  {
    id: 'doc_control', name: 'Document Control', description: 'Mengelola register, revisi, status, dan transmittal dokumen', builtIn: true,
    permissions: ['doc.create', 'doc.edit', 'doc.delete', 'revision.issue', 'review.record', 'transmittal.manage', 'export', 'logs.view'],
  },
  {
    id: 'doc_control_project', name: 'Document Control Proyek', description: 'Document control yang hanya menangani proyek yang ditugaskan kepadanya', builtIn: true, projectScoped: true,
    permissions: ['doc.create', 'doc.edit', 'revision.issue', 'review.record', 'transmittal.manage', 'export', 'logs.view'],
  },
  { id: 'engineer', name: 'Engineer / Author', description: 'Membuat dokumen dan menerbitkan revisi', permissions: ['doc.create', 'doc.edit', 'revision.issue', 'export'] },
  { id: 'reviewer', name: 'Reviewer', description: 'Mencatat hasil review dokumen', permissions: ['review.record', 'export'] },
  { id: 'viewer', name: 'Viewer', description: 'Hanya melihat data', permissions: [] },
]

export const emptyState = (): AppState => ({
  version: 1,
  updatedAt: new Date(0).toISOString(),
  settings: defaultSettings,
  projects: [],
  documents: [],
  transmittals: [],
  logs: [],
  users: [],
  roles: defaultRoles(),
})
