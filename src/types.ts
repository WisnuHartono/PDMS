export type StatusCode = 'IFR' | 'IFA' | 'IFC' | 'IFP' | 'IFI' | (string & {})

export interface StatusDef {
  code: StatusCode
  label: string
  color: string
}

export type ReviewResult = 'Pending' | 'Approved' | 'Approved with comments' | 'Rejected'

export interface BannerLogo {
  show: boolean
  bg?: 'white' | 'glass' | 'none'
  clearWhite?: boolean
  shadow?: number // bayangan logo 0-100
  sharp?: number // ketajaman (kontras & saturasi) 0-100
  halo?: boolean // garis tepi putih tipis di sekeliling logo
  pos: 'left' | 'center' | 'right'
  size: number // tinggi logo (px)
  row?: 'title' | 'top' // 'title' (bawaan): sejajar judul; 'top': baris sendiri di atas judul
  valign?: 'start' | 'center' | 'end' // rata vertikal terhadap judul (row = title)
  dx?: number // geser horizontal (px)
  dy?: number // geser vertikal (px)
}

export interface TextStyleCfg {
  font: string // id dari FONT_OPTIONS
  custom?: string // nama huruf bila font = 'custom'
  size: number // px
  weight: number
  color: string // '' = otomatis (putih di header sidebar)
  italic: boolean
  upper: boolean // HURUF BESAR
  spacing: number // jarak antar huruf (px, bisa desimal)
}
export interface SideText { name: TextStyleCfg; tagline: TextStyleCfg }
export const DEFAULT_SIDETEXT: SideText = {
  name: { font: 'system', size: 21, weight: 800, color: '', italic: false, upper: false, spacing: 0.3 },
  tagline: { font: 'system', size: 11, weight: 500, color: '', italic: false, upper: false, spacing: 0 },
}

export interface SideLogo {
  size: number // sisi kotak logo (px) 32-96
  bg: 'white' | 'glass' | 'none' | 'color' // latar kotak logo
  bgColor?: string // untuk bg 'color'
  bgOpacity?: number // 0-100: kepekatan latar kotak
  opacity?: number // 20-100: kepekatan logo (lebih kecil = transparan)
  radius?: number // 0-50 (%) kebulatan sudut
  shadow?: number // 0-100 bayangan kotak
  glow?: number // 0-100 cahaya di sekeliling logo
  bright?: number // 50-160 (%) kecerahan
  contrast?: number // 50-160 (%) kontras
  border?: boolean // bingkai putih tipis
}
export const DEFAULT_SIDELOGO: Required<Omit<SideLogo, 'bgColor'>> & { bgColor?: string } = { size: 56, bg: 'white', bgOpacity: 100, opacity: 100, radius: 25, shadow: 50, glow: 0, bright: 100, contrast: 100, border: true }

export interface SideStyle {
  bg?: string // 'theme' (ikut tema) | id preset warna | 'custom'
  c1?: string // warna atas (custom)
  c2?: string // warna bawah (custom)
  angle?: number // arah gradasi (derajat)
  pattern?: string // 'none' | id pola
  patternOpacity?: number // 3-40 (%)
  patternScale?: number // 50-250 (%)
  art?: string // 'none' | id siluet vektor
  artOpacity?: number // 4-60 (%)
  artSize?: number // 60-220 (%)
  image?: string // gambar/siluet/vektor unggahan (data URL)
  imgOpacity?: number // 5-100 (%)
  imgPos?: 'bottom' | 'top' | 'center' | 'cover'
}
export const DEFAULT_SIDESTYLE: Required<Omit<SideStyle, 'c1' | 'c2' | 'image'>> = { bg: 'theme', angle: 180, pattern: 'none', patternOpacity: 12, patternScale: 100, art: 'none', artOpacity: 20, artSize: 100, imgOpacity: 30, imgPos: 'bottom' }

export interface BannerSettings {
  client: BannerLogo
  contractor: BannerLogo
  bg: 'white' | 'glass' | 'none'
  theme?: BannerTheme
}

export interface BannerTheme {
  preset: string // 'auto' (warna proyek) | id preset | 'custom'
  c1?: string
  c2?: string
  angle?: number
  pattern?: 'none' | 'dots' | 'grid' | 'diagonal' | 'waves' | 'circles'
  image?: string // gambar latar (data URL)
  dim?: number // gelapkan gambar 0-90 (%)
  imgOpacity?: number // kekuatan gambar 10-100 (%); lebih kecil = gambar lebih transparan (menyatu dengan warna tema)
  scrim?: number // pelindung teks 0-90 (%): bayangan gelap dari kiri/bawah di belakang judul
  text?: 'light' | 'dark'
}

export interface ProjectPic {
  id: string
  name: string
  func: string // fungsi, mis. Reviewer / Approver / Engineer
  position: string // jabatan
  company?: string
  email?: string
  phone?: string
  disciplines: string[] // kosong = semua disiplin
  active: boolean
}

export interface Project {
  id: string
  code: string
  name: string
  client: string
  contractor: string
  location: string
  manager: string
  description: string
  startDate: string
  endDate: string
  color: string
  archived: boolean
  createdAt: string
  numberPrefix: string
  numberPadding: number
  contractNo?: string
  contractDate?: string
  contractValue?: string
  clientLogo?: string
  contractorLogo?: string
  banner?: BannerSettings
  picList?: ProjectPic[]
  contractFile?: { name: string; size: number; mime: string; key: string; driveFileId?: string; storage?: StorageMap }
  driveFolderId?: string
}

export type StorageDest = 'local' | 'drive' | 'webdav'

export interface StorageResult {
  ok: boolean
  path: string
  at: string
  error?: string
  id?: string
}

export type StorageMap = Partial<Record<StorageDest, StorageResult>>

export interface StorageSettings {
  pathTemplate: string
  fileTemplate: string
  local: boolean
  drive: boolean
  webdav: { enabled: boolean; url: string; username: string }
}

export interface Revision {
  id: string
  rev: string
  status: StatusCode
  issuedDate: string
  dueDate: string
  notes: string
  fileName?: string
  fileSize?: number
  fileMime?: string
  fileKey?: string
  driveFileId?: string
  storage?: StorageMap
  pic?: string
  picDate?: string
  holder?: string // posisi dokumen saat ini (kosong = otomatis)
  lastStatus?: string
  trsNo?: string
  reviewResult: ReviewResult
  reviewComment: string
  reviewedDate?: string
  transmittalId?: string
  createdBy: string
}

export interface Doc {
  id: string
  projectId: string
  number: string
  title: string
  discipline: string
  category: string
  paper?: string // ukuran kertas dokumen (A4, A3, ...)
  createdAt: string
  revisions: Revision[]
}

export interface Transmittal {
  id: string
  projectId: string
  number: string
  date: string
  from: string
  to: string
  subject: string
  notes: string
  toEmail?: string
  ccEmail?: string
  items: { docId: string; revId: string }[]
}

export interface LogEntry {
  id: string
  ts: string
  projectId?: string
  docId?: string
  user: string
  action: string
  detail: string
  device?: string // browser · OS · jenis perangkat
  ip?: string // IP publik (hanya bila diaktifkan administrator)
}

export type Permission =
  | 'project.manage' | 'doc.create' | 'doc.edit' | 'doc.delete' | 'revision.issue'
  | 'review.record' | 'transmittal.manage' | 'export' | 'logs.view' | 'settings.manage' | 'users.manage'

export interface Role {
  id: string
  name: string
  description: string
  permissions: Permission[]
  builtIn?: boolean
  projectScoped?: boolean // peran wajib dibatasi pada proyek yang ditugaskan
}

export interface DashPrefs {
  widgets: { id: string; visible: boolean; span: 4 | 6 | 8 | 12 }[]
  compact: boolean
  hero: boolean
  collapsed: string[]
}

export interface User {
  id: string
  username: string
  name: string
  email: string
  phone: string
  position: string
  department: string
  company: string
  employeeId: string
  note: string
  photo?: string
  roleId: string
  active: boolean
  allowedProjects: 'all' | string[]
  pw: { hash: string; salt: string; iter: number }
  mustChange: boolean
  createdAt: string
  lastLogin?: string
  failedAttempts: number
  lockedUntil?: string
  totpSecret?: string
  totpEnabled?: boolean
  resetPw?: { hash: string; salt: string; iter: number; exp: string } // sandi sementara hasil 'lupa sandi'
  lastResetReq?: string
  dashPrefs?: DashPrefs
}

export interface RecoverySettings {
  enabled: boolean
  emailUrl: string
  emailAuth: string
  whatsappUrl: string
  whatsappAuth: string
  validMinutes: number
}

export interface FontSettings {
  body: string // id jenis huruf isi
  bodyCustom?: string
  size: number // px
  bodyWeight: number
  head: string // id jenis huruf judul / header
  headCustom?: string
  headWeight: number
  headScale: number // % ukuran judul
}

export interface ReportSettings {
  reviewer: string
  workdays: 5 | 6
  holidays: string[]
  highlightNewDays: number
  paper: 'A4' | 'A3'
  period: 'daily' | 'weekly' | 'monthly'
  scope: 'outstanding' | 'activity' | 'all'
  lastStatuses: { code: string; label: string }[]
}

export interface Settings {
  googleClientId: string
  theme: 'light' | 'dark' | 'auto'
  statuses: StatusDef[]
  disciplines: string[]
  categories: string[]
  palette?: { preset: string; custom?: Partial<Record<'bg' | 'card' | 'text' | 'muted' | 'line' | 'pri', string>> } // tema warna aplikasi
  sideLogo?: SideLogo // tampilan logo di header sidebar
  sideStyle?: SideStyle // latar, pola, dan siluet sidebar
  googleLogin?: boolean // izinkan masuk ke aplikasi dengan akun Google (email harus cocok dengan pengguna)
  logIp?: boolean // catat IP publik di log aktivitas (lewat layanan luar)
  sideText?: Partial<SideText> // gaya huruf nama & kepanjangan aplikasi di sidebar
  removedRoles?: string[] // peran bawaan tambahan yang sudah dihapus pengguna
  numbering?: import('./numbering').NumberingSettings // pola penomoran dokumen
  revisionScheme: 'alpha' | 'numeric'
  defaultReviewDays: number
  autoSync: boolean
  organization: string
  report: ReportSettings
  storage: StorageSettings
  appName: string
  appTagline: string
  appLogo: string
  accentColor: string
  font?: FontSettings
  orgAddress: string
  orgPhone: string
  orgEmail: string
  orgWebsite: string
  loginMessage: string
  emailTemplate?: { subject: string; body: string } // template email transmittal
  categoryStatuses?: Record<string, string[]> // batas status per jenis dokumen; kosong = semua status
  copyright?: string // teks hak cipta di halaman login; kosong = otomatis
  appInfo?: string // deskripsi singkat aplikasi di halaman login; kosong = bawaan
  recovery?: RecoverySettings
  footerText: string
  sessionTimeoutMin: number
  maxAttempts: number
  lockMinutes: number
  minPasswordLength: number
}

export interface AppState {
  version: 1
  updatedAt: string
  settings: Settings
  projects: Project[]
  documents: Doc[]
  transmittals: Transmittal[]
  logs: LogEntry[]
  users: User[]
  roles: Role[]
  currentProjectId?: string
}
