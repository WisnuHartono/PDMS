import { nextNumber } from './numbering'
import { useSyncExternalStore } from 'react'
import type { AppState, Doc, Permission, Project, Revision, Role, Settings, Transmittal, User } from './types'
import { defaultRoles, emptyState } from './defaults'
import { generatePassword, hashPassword, verifyPassword, verifyTotp } from './auth'
import { allowedStatuses } from './statusrules'
import { channelReady, normalizePhone, recoveryOf, sendVia, type RecoveryChannel } from './recovery'
import { loadLocal, saveLocal, putFile, getFile, deleteFile } from './db'
import * as drive from './drive'
import { addDays, nextRev, nowIso, today, uid } from './util'
import { demoState } from './demo'
import { clean, enabledDests, fileNameFor, folderSegments, saveEverywhere } from './storage'
import { deviceLabel, currentIp, refreshIp } from './device'
import type { StorageDest } from './types'

export interface Session {
  authUserId?: string
  user?: drive.GUser
  syncing: boolean
  lastSync?: string
  error?: string
}

interface Snapshot {
  state: AppState
  session: Session
}

function normalize(x: AppState): AppState {
  const base = emptyState()
  return {
    ...base,
    ...x,
    settings: {
      ...base.settings,
      ...x.settings,
      report: { ...base.settings.report, ...x.settings?.report },
      numbering: { ...base.settings.numbering!, ...x.settings?.numbering },
      storage: { ...base.settings.storage, ...x.settings?.storage, webdav: { ...base.settings.storage.webdav, ...x.settings?.storage?.webdav } },
    },
    users: x.users || [],
    roles: (() => {
      const rs = x.roles?.length ? x.roles : defaultRoles()
      const missing = defaultRoles().filter((d) => d.id === 'doc_control_project' && !rs.some((r) => r.id === d.id) && !(x.settings?.removedRoles || []).includes(d.id))
      return [...rs, ...missing]
    })(),
  }
}

const SESS_KEY = 'docontrol.session'
const readSess = (): { id: string; at: number } | null => {
  try { return JSON.parse(sessionStorage.getItem(SESS_KEY) || 'null') } catch { return null }
}
const writeSess = (v: { id: string; at: number } | null) => {
  try { v ? sessionStorage.setItem(SESS_KEY, JSON.stringify(v)) : sessionStorage.removeItem(SESS_KEY) } catch { /* sandbox */ }
}

const loaded = loadLocal()
const initState = loaded ? normalize(loaded) : import.meta.env.VITE_DEMO ? normalize(demoState()) : emptyState()
const sess0 = readSess()
let snap: Snapshot = {
  state: initState,
  session: {
    syncing: false,
    authUserId:
      sess0 && initState.users.some((u) => u.id === sess0.id && u.active) &&
      (initState.settings.sessionTimeoutMin <= 0 || Date.now() - sess0.at < initState.settings.sessionTimeoutMin * 60000)
        ? sess0.id
        : undefined,
  },
}
refreshIp(!!initState.settings.logIp)
const listeners = new Set<() => void>()
const emit = () => listeners.forEach((l) => l())

function setSession(p: Partial<Session>) {
  snap = { ...snap, session: { ...snap.session, ...p } }
  emit()
}

let pushTimer: number | undefined
function commit(mut: (s: AppState) => AppState) {
  const next = mut(snap.state)
  next.updatedAt = nowIso()
  snap = { ...snap, state: next }
  saveLocal(next)
  emit()
  if (snap.state.settings.autoSync && drive.isConnected()) {
    clearTimeout(pushTimer)
    pushTimer = window.setTimeout(() => void syncPush(), 1500)
  }
}

async function syncPush() {
  try {
    setSession({ syncing: true, error: undefined })
    await drive.pushState(snap.state)
    setSession({ syncing: false, lastSync: nowIso() })
  } catch (e: any) {
    setSession({ syncing: false, error: e.message })
  }
}

export const useApp = () => {
  const s = useSyncExternalStore(
    (l) => (listeners.add(l), () => listeners.delete(l)),
    () => snap,
  )
  return s
}

const currentUser = () => snap.state.users.find((u) => u.id === snap.session.authUserId)
const userName = () => {
  const u = currentUser()
  return u ? `${u.name} (${u.username})` : snap.session.user?.email || 'lokal'
}
function reportStorage(m: import('./types').StorageMap) {
  const bad = Object.entries(m).filter(([, r]) => r && !r.ok)
  if (bad.length) setSession({ error: 'Penyimpanan berkas gagal di: ' + bad.map(([k, r]) => `${k} (${r!.error})`).join('; ') })
}
const roleOf = (u?: User) => snap.state.roles.find((r) => r.id === u?.roleId)
/** Apakah pengguna aktif boleh mengakses proyek ini (administrator / akses semua proyek / proyek yang ditugaskan). */
const canProj = (projectId?: string) => {
  const u = currentUser()
  if (!u || !projectId) return !!u
  return u.roleId === 'admin' || u.allowedProjects === 'all' || u.allowedProjects.includes(projectId)
}
const guardProj = (projectId?: string) => { if (!canProj(projectId)) throw new Error('Anda tidak memiliki akses ke proyek ini.') }
const guardDoc = (docId: string) => guardProj(snap.state.documents.find((d) => d.id === docId)?.projectId)
const checkScope = (roleId: string, allowed: 'all' | string[]) => {
  const role = snap.state.roles.find((r) => r.id === roleId)
  if (role?.projectScoped && (allowed === 'all' || allowed.length === 0)) throw new Error(`Peran ${role.name} wajib dibatasi pada minimal satu proyek.`)
}
const hasPerm = (p: Permission) => {
  const u = currentUser()
  return !!u && (u.roleId === 'admin' || !!roleOf(u)?.permissions.includes(p))
}

/** Hook: pengguna aktif, perannya, dan fungsi can(izin). */
export function useAuth() {
  const { state, session } = useApp()
  const user = state.users.find((u) => u.id === session.authUserId)
  const role = state.roles.find((r) => r.id === user?.roleId)
  const can = (p: Permission) => !!user && (user.roleId === 'admin' || !!role?.permissions.includes(p))
  const projects = state.projects.filter((p) => !user || user.allowedProjects === 'all' || user.allowedProjects.includes(p.id))
  return { user, role, can, projects, needsSetup: state.users.length === 0 }
}

function log(s: AppState, action: string, detail: string, projectId?: string, docId?: string): AppState {
  return {
    ...s,
    logs: [{ id: uid(), ts: nowIso(), projectId, docId, user: userName(), action, detail, device: deviceLabel() || undefined, ip: s.settings.logIp ? currentIp() : undefined }, ...s.logs].slice(0, 5000),
  }
}


// Ringkasan perubahan untuk log aktivitas: nama kolom yang berubah (nilai pendek ikut ditampilkan; isi besar/sensitif tidak).
const PROJ_LABELS: Record<string, string> = { code: 'Kode', name: 'Nama', client: 'Klien', contractor: 'Kontraktor', location: 'Lokasi', manager: 'PM', description: 'Deskripsi', startDate: 'Mulai', endDate: 'Selesai', color: 'Warna', numberPrefix: 'Inisial nomor', numberPadding: 'Digit urut', contractNo: 'No. kontrak', contractDate: 'Tgl kontrak', contractValue: 'Nilai kontrak', clientLogo: 'Logo klien', contractorLogo: 'Logo kontraktor', banner: 'Banner', contractFile: 'Lampiran kontrak' }
const DOC_LABELS: Record<string, string> = { number: 'Nomor', title: 'Judul', discipline: 'Disiplin', category: 'Jenis', paper: 'Kertas' }
const USER_LABELS: Record<string, string> = { name: 'Nama', username: 'Username', email: 'Email', phone: 'Telepon', position: 'Jabatan', department: 'Departemen', company: 'Perusahaan', roleId: 'Peran', active: 'Status akun', allowedProjects: 'Akses proyek', mustChange: 'Wajib ganti sandi' }
const LONG = new Set(['description', 'clientLogo', 'contractorLogo', 'contractFile', 'allowedProjects'])
const BANNER_LABELS: Record<string, string> = { bg: 'Latar logo', show: 'tampil', pos: 'posisi', row: 'letak baris', valign: 'rata vertikal', dx: 'geser horizontal', dy: 'geser vertikal', size: 'ukuran', shadow: 'bayangan', sharp: 'ketajaman', halo: 'garis tepi', clearWhite: 'hapus putih', preset: 'tema', c1: 'warna 1', c2: 'warna 2', angle: 'sudut', pattern: 'pola', image: 'gambar latar', dim: 'gelap gambar', imgOpacity: 'transparansi gambar', scrim: 'pelindung teks', text: 'warna teks' }
const BANNER_GROUPS: Record<string, string> = { client: 'Logo klien', contractor: 'Logo kontraktor', theme: 'Tema' }
// Perbedaan pengaturan banner, mis. "Logo klien: ukuran 40 → 60; Tema: pola none → dots".
function bannerDiff(a: any, b: any) {
  const out: string[] = []
  const val = (k: string, v: unknown) => (k === 'image' ? (v ? 'ada' : 'tidak ada') : typeof v === 'boolean' ? (v ? 'ya' : 'tidak') : v === undefined || v === '' ? '(default)' : String(v))
  for (const g of ['client', 'contractor', 'theme', '']) {
    const x = g ? a?.[g] || {} : a || {}, y = g ? b?.[g] || {} : b || {}
    const ks = Array.from(new Set([...Object.keys(x), ...Object.keys(y)])).filter((k) => typeof (y[k] ?? x[k]) !== 'object' && JSON.stringify(x[k]) !== JSON.stringify(y[k]))
    const parts = ks.map((k) => `${BANNER_LABELS[k] || k} ${val(k, x[k])} → ${val(k, y[k])}`)
    if (parts.length) out.push(g ? `${BANNER_GROUPS[g]}: ${parts.join(', ')}` : parts.join(', '))
  }
  return out.join('; ')
}
function changes(old: any, patch: Record<string, any>, labels: Record<string, string>) {
  const out: string[] = []
  for (const k of Object.keys(patch)) {
    if (k === 'archived' && !!old?.archived !== !!patch[k]) { out.push(patch[k] ? 'proyek diarsipkan' : 'proyek diaktifkan kembali'); continue }
    const l = labels[k]
    if (k === 'banner' && l) { const d = bannerDiff(old?.banner, patch.banner); if (d) out.push('Banner — ' + d); continue }
    if (!l || JSON.stringify(old?.[k] ?? '') === JSON.stringify(patch[k] ?? '')) continue
    if (k === 'archived') { out.push(patch[k] ? 'diarsipkan' : 'diaktifkan kembali'); continue }
    if (k === 'active') { out.push(patch[k] ? 'akun diaktifkan' : 'akun dinonaktifkan'); continue }
    const a = old?.[k], b = patch[k]
    if (k === 'clientLogo' || k === 'contractorLogo') { out.push(`${l} ${b ? (a ? 'diganti' : 'ditambahkan') : 'dihapus'}`); continue }
    if (k === 'contractFile') { out.push(`${l} ${b ? 'diunggah' : 'dihapus'}`); continue }
    if (LONG.has(k) || typeof b === 'object' || typeof a === 'object') { out.push(l + ' diubah'); continue }
    const t = (v: unknown) => { const x = String(v ?? '').trim(); return x ? (x.length > 140 ? x.slice(0, 139) + '…' : x) : '(kosong)' }
    out.push(`${l}: ${t(a)} → ${t(b)}`)
  }
  return out.join('; ')
}

export const actions = {
  // ---------- Google ----------
  async connect() {
    try {
      setSession({ syncing: true, error: undefined })
      const user = await drive.signIn(snap.state.settings.googleClientId)
      setSession({ user })
      const remote = await drive.pullState()
      if (remote && remote.updatedAt > snap.state.updatedAt) {
        snap = { ...snap, state: normalize({ ...remote, settings: { ...remote.settings, googleClientId: snap.state.settings.googleClientId } }) }
        saveLocal(snap.state)
        emit()
      } else {
        await drive.pushState(snap.state)
      }
      setSession({ syncing: false, lastSync: nowIso() })
    } catch (e: any) {
      setSession({ syncing: false, error: e.message })
    }
  },
  // Masuk dengan akun Google: email Google (terverifikasi) harus sama dengan email pengguna aktif di aplikasi.
  async loginWithGoogle(otp?: string): Promise<{ ok: boolean; error?: string; needOtp?: boolean }> {
    const st = snap.state.settings
    if (!st.googleClientId) return { ok: false, error: 'Google Client ID belum diisi. Hubungi administrator.' }
    try {
      setSession({ syncing: true, error: undefined })
      const gu = await drive.signIn(st.googleClientId)
      // Perangkat baru (belum ada pengguna lokal): ambil data dari Drive lebih dulu. Bila sudah ada pengguna, data lokal tidak
      // ditimpa sebelum login berhasil (akun Google lain tidak boleh mengganti data lewat berkas miliknya sendiri).
      try {
        const remote = snap.state.users.length === 0 ? await drive.pullState() : null
        if (remote && remote.updatedAt > snap.state.updatedAt) {
          snap = { ...snap, state: normalize({ ...remote, settings: { ...remote.settings, googleClientId: st.googleClientId } }) }
          saveLocal(snap.state)
          emit()
        }
      } catch { /* belum ada data di Drive */ }
      const cur = snap.state.settings
      const fail = (error: string) => { drive.signOut(); setSession({ syncing: false, user: undefined }); return { ok: false, error } }
      if (!cur.googleLogin) return fail('Masuk dengan Google belum diaktifkan oleh administrator.')
      if (!gu.verified) return fail('Email akun Google belum terverifikasi.')
      const u = snap.state.users.find((x) => x.email.trim().toLowerCase() === gu.email.trim().toLowerCase())
      if (!u) { commit((s) => log(s, 'Login Google gagal', gu.email)); return fail(`Akun Google ${gu.email} belum terdaftar sebagai pengguna. Minta administrator mendaftarkan email ini.`) }
      if (!u.active) return fail('Akun dinonaktifkan. Hubungi administrator.')
      if (u.lockedUntil && new Date(u.lockedUntil) > new Date()) return fail('Akun sedang terkunci. Coba lagi nanti atau minta administrator membuka kunci.')
      if (u.totpEnabled && u.totpSecret) {
        if (!otp) { setSession({ syncing: false }); return { ok: false, needOtp: true } }
        if (!(await verifyTotp(u.totpSecret, otp))) { commit((s) => log(s, 'Login Google gagal', u.username + ' (kode 2 langkah salah)')); return fail('Kode verifikasi 2 langkah salah.') }
      }
      commit((s) => log({ ...s, users: s.users.map((x) => (x.id === u.id ? { ...x, failedAttempts: 0, lockedUntil: undefined, lastLogin: nowIso() } : x)) }, 'Login', u.username + ' (Google)'))
      snap = { ...snap, session: { ...snap.session, authUserId: u.id, user: gu, syncing: false, lastSync: nowIso() } }
      writeSess({ id: u.id, at: Date.now() })
      emit()
      return { ok: true }
    } catch (e: any) {
      setSession({ syncing: false })
      return { ok: false, error: e.message }
    }
  },
  disconnect() {
    drive.signOut()
    setSession({ user: undefined, lastSync: undefined })
  },
  async syncNow() {
    if (!drive.isConnected()) return actions.connect()
    await syncPush()
  },

  // ---------- Autentikasi & pengguna ----------
  setDashPrefs(p: import('./types').DashPrefs) {
    const me = currentUser()
    if (!me) return
    commit((s) => ({ ...s, users: s.users.map((u) => (u.id === me.id ? { ...u, dashPrefs: p } : u)) }))
  },
  touch() {
    if (snap.session.authUserId) writeSess({ id: snap.session.authUserId, at: Date.now() })
  },
  async setupAdmin(p: Pick<User, 'username' | 'name' | 'email'> & Partial<User>, password: string) {
    if (snap.state.users.length) throw new Error('Administrator sudah dibuat.')
    const u: User = {
      phone: '', position: '', department: '', company: '', employeeId: '', note: '',
      ...p,
      id: uid(), username: p.username.trim().toLowerCase(), roleId: 'admin', active: true, allowedProjects: 'all',
      pw: await hashPassword(password), mustChange: false, createdAt: nowIso(), failedAttempts: 0,
    }
    commit((s) => log({ ...s, users: [u] }, 'Administrator dibuat', u.username))
    snap = { ...snap, session: { ...snap.session, authUserId: u.id } }
    writeSess({ id: u.id, at: Date.now() })
    emit()
  },
  async login(username: string, password: string, otp?: string): Promise<{ ok: boolean; error?: string; needOtp?: boolean }> {
    const uname = username.trim().toLowerCase()
    const u = snap.state.users.find((x) => x.username === uname || x.email.toLowerCase() === uname)
    const st = snap.state.settings
    if (!u) {
      await hashPassword(password) // samakan waktu respons agar username tidak dapat ditebak
      return { ok: false, error: 'Username atau kata sandi salah.' }
    }
    if (u.lockedUntil && new Date(u.lockedUntil) > new Date()) {
      const m = Math.ceil((+new Date(u.lockedUntil) - Date.now()) / 60000)
      return { ok: false, error: `Akun terkunci karena terlalu banyak percobaan gagal. Coba lagi dalam ${m} menit atau minta administrator membuka kunci.` }
    }
    let good = await verifyPassword(password, u.pw)
    let viaReset = false
    if (!good && u.resetPw && new Date(u.resetPw.exp) > new Date() && (await verifyPassword(password, u.resetPw))) { good = true; viaReset = true }
    const patch = (p: Partial<User>) => commit((s) => ({ ...s, users: s.users.map((x) => (x.id === u.id ? { ...x, ...p } : x)) }))
    const fail = () => {
      const n = (u.failedAttempts || 0) + 1
      const lock = n >= st.maxAttempts
      patch({ failedAttempts: lock ? 0 : n, lockedUntil: lock ? new Date(Date.now() + st.lockMinutes * 60000).toISOString() : undefined })
      commit((s) => log(s, lock ? 'Akun dikunci' : 'Login gagal', u.username))
      return { ok: false, error: lock ? `Akun dikunci ${st.lockMinutes} menit karena ${st.maxAttempts} kali gagal.` : `Username atau kata sandi salah. Sisa percobaan: ${st.maxAttempts - n}.` }
    }
    if (!good) return fail()
    if (!u.active) return { ok: false, error: 'Akun dinonaktifkan. Hubungi administrator.' }
    if (u.totpEnabled && u.totpSecret) {
      if (!otp) return { ok: false, needOtp: true }
      if (!(await verifyTotp(u.totpSecret, otp))) return fail()
    }
    patch({ failedAttempts: 0, lockedUntil: undefined, lastLogin: nowIso(), resetPw: undefined, ...(viaReset ? { pw: { hash: u.resetPw!.hash, salt: u.resetPw!.salt, iter: u.resetPw!.iter }, mustChange: true } : {}) })
    snap = { ...snap, session: { ...snap.session, authUserId: u.id } }
    writeSess({ id: u.id, at: Date.now() })
    commit((s) => log(s, 'Login', u.username))
    return { ok: true }
  },
  // Lupa sandi: buat sandi sementara dan kirim lewat email / WhatsApp. Sandi tidak pernah ditampilkan.
  // Sandi lama tetap berlaku sampai sandi sementara dipakai, sehingga pihak lain tidak bisa mengunci akun.
  async requestPasswordReset(identifier: string, channel: RecoveryChannel): Promise<{ ok: boolean; error?: string }> {
    const st = snap.state.settings
    const rc = recoveryOf(st.recovery)
    if (!rc.enabled || !channelReady(rc, channel)) return { ok: false, error: 'Pengiriman sandi lewat ' + (channel === 'email' ? 'email' : 'WhatsApp') + ' belum tersedia. Hubungi administrator.' }
    const key = identifier.trim().toLowerCase()
    const u = key ? snap.state.users.find((x) => x.active && (x.username === key || x.email.toLowerCase() === key)) : undefined
    const to = u ? (channel === 'email' ? u.email.trim() : normalizePhone(u.phone || '')) : ''
    const recent = u?.lastResetReq && Date.now() - +new Date(u.lastResetReq) < 2 * 60000
    if (!u || !to || recent) { await hashPassword(key); return { ok: true } } // jawaban seragam agar akun tidak dapat ditebak
    const temp = generatePassword(14)
    const exp = new Date(Date.now() + rc.validMinutes * 60000)
    const msg = `${st.appName}: sandi sementara Anda adalah ${temp}\nBerlaku ${rc.validMinutes} menit. Setelah masuk Anda akan diminta membuat sandi baru. Abaikan pesan ini jika Anda tidak memintanya.`
    try { await sendVia(rc, channel, to, `Sandi sementara ${st.appName}`, msg, st.appName) } catch (e: any) { return { ok: false, error: e.message } }
    const pw = await hashPassword(temp)
    commit((s) => log({ ...s, users: s.users.map((x) => (x.id === u.id ? { ...x, resetPw: { ...pw, exp: exp.toISOString() }, lastResetReq: nowIso() } : x)) }, 'Permintaan lupa sandi', `${u.username} via ${channel}`))
    return { ok: true }
  },
  logout() {
    const u = currentUser()
    if (u) commit((s) => log(s, 'Logout', u.username))
    writeSess(null)
    setSession({ authUserId: undefined })
  },
  async createUser(d: Omit<User, 'id' | 'pw' | 'createdAt' | 'failedAttempts'>, password: string) {
    if (!hasPerm('users.manage')) throw new Error('Tidak diizinkan.')
    checkScope(d.roleId, d.allowedProjects)
    const uname = d.username.trim().toLowerCase()
    if (snap.state.users.some((x) => x.username === uname)) throw new Error('Username sudah dipakai.')
    const u: User = { ...d, username: uname, id: uid(), pw: await hashPassword(password), createdAt: nowIso(), failedAttempts: 0 }
    commit((s) => log({ ...s, users: [...s.users, u] }, 'Pengguna dibuat', `${u.username} (${u.roleId})`))
  },
  updateUser(id: string, patch: Partial<User>) {
    const me = currentUser()
    if (id !== me?.id && !hasPerm('users.manage')) throw new Error('Tidak diizinkan.')
    delete patch.pw, delete patch.id, delete patch.createdAt, delete patch.failedAttempts, delete patch.lockedUntil, delete patch.totpSecret, delete patch.totpEnabled
    const self = id === me?.id && !hasPerm('users.manage')
    if (self) delete patch.roleId, delete patch.active, delete patch.allowedProjects, delete patch.username, delete patch.mustChange
    const cur = snap.state.users.find((x) => x.id === id)
    if (cur && !self) checkScope(patch.roleId ?? cur.roleId, patch.allowedProjects ?? cur.allowedProjects)
    if (cur && cur.roleId === 'admin' && ((patch.roleId && patch.roleId !== 'admin') || patch.active === false)) {
      if (snap.state.users.filter((x) => x.roleId === 'admin' && x.active).length <= 1) throw new Error('Minimal harus ada satu administrator aktif.')
    }
    if (patch.username) {
      patch.username = patch.username.trim().toLowerCase()
      if (snap.state.users.some((x) => x.id !== id && x.username === patch.username)) throw new Error('Username sudah dipakai.')
    }
    commit((s) => log({ ...s, users: s.users.map((x) => (x.id === id ? { ...x, ...patch } : x)) }, 'Pengguna diubah', `${cur?.username || id}${changes(cur, patch, USER_LABELS) ? ' — ' + changes(cur, patch, USER_LABELS) : ''}`))
  },
  async setPassword(id: string, password: string, mustChange: boolean) {
    if (!hasPerm('users.manage')) throw new Error('Tidak diizinkan.')
    const pw = await hashPassword(password)
    commit((s) => log({ ...s, users: s.users.map((x) => (x.id === id ? { ...x, pw, mustChange, failedAttempts: 0, lockedUntil: undefined } : x)) }, 'Kata sandi direset', snap.state.users.find((u) => u.id === id)?.username || id))
  },
  async changeOwnPassword(current: string, next: string) {
    const u = currentUser()
    if (!u) throw new Error('Belum login.')
    if (!(await verifyPassword(current, u.pw))) throw new Error('Kata sandi saat ini salah.')
    if (await verifyPassword(next, u.pw)) throw new Error('Kata sandi baru harus berbeda dari yang lama.')
    const pw = await hashPassword(next)
    commit((s) => log({ ...s, users: s.users.map((x) => (x.id === u.id ? { ...x, pw, mustChange: false } : x)) }, 'Kata sandi diganti', u.username))
  },
  unlockUser(id: string) {
    commit((s) => ({ ...s, users: s.users.map((x) => (x.id === id ? { ...x, failedAttempts: 0, lockedUntil: undefined } : x)) }))
  },
  deleteUser(id: string) {
    const u = snap.state.users.find((x) => x.id === id)
    if (!u) return
    if (id === currentUser()?.id) throw new Error('Tidak dapat menghapus akun yang sedang dipakai.')
    if (u.roleId === 'admin' && snap.state.users.filter((x) => x.roleId === 'admin' && x.active).length <= 1) throw new Error('Minimal harus ada satu administrator aktif.')
    commit((s) => log({ ...s, users: s.users.filter((x) => x.id !== id) }, 'Pengguna dihapus', u.username))
  },
  async enableTotp(secret: string, code: string) {
    const u = currentUser()
    if (!u) throw new Error('Belum login.')
    if (!(await verifyTotp(secret, code))) throw new Error('Kode tidak cocok. Periksa jam perangkat dan coba lagi.')
    commit((s) => log({ ...s, users: s.users.map((x) => (x.id === u.id ? { ...x, totpSecret: secret, totpEnabled: true } : x)) }, '2FA diaktifkan', u.username))
  },
  disableTotp(id: string) {
    commit((s) => log({ ...s, users: s.users.map((x) => (x.id === id ? { ...x, totpSecret: undefined, totpEnabled: false } : x)) }, '2FA dinonaktifkan', snap.state.users.find((u) => u.id === id)?.username || id))
  },
  saveRole(r: Role) {
    if (!hasPerm('users.manage')) throw new Error('Tidak diizinkan.')
    if (r.id === 'admin') return
    commit((s) => ({ ...s, roles: s.roles.some((x) => x.id === r.id) ? s.roles.map((x) => (x.id === r.id ? r : x)) : [...s.roles, r] }))
  },
  deleteRole(id: string) {
    if (id === 'admin' || id === 'doc_control') throw new Error('Peran bawaan tidak dapat dihapus.')
    if (snap.state.users.some((u) => u.roleId === id)) throw new Error('Peran masih dipakai pengguna.')
    // peran tambahan bawaan yang dihapus tidak dimunculkan lagi saat data dimuat ulang
    commit((s) => ({ ...s, roles: s.roles.filter((r) => r.id !== id), settings: { ...s.settings, removedRoles: [...new Set([...(s.settings.removedRoles || []), id])] } }))
  },

  // ---------- Proyek ----------
  setCurrent(id?: string) {
    if (id && !canProj(id)) return
    commit((s) => ({ ...s, currentProjectId: id }))
  },
  addProject(p: Omit<Project, 'id' | 'createdAt' | 'archived'>) {
    const proj: Project = { ...p, id: uid(), createdAt: nowIso(), archived: false }
    commit((s) => log({ ...s, projects: [...s.projects, proj], currentProjectId: proj.id }, 'Proyek dibuat', `${proj.code} - ${proj.name}`, proj.id))
    return proj.id
  },
  updateProject(id: string, patch: Partial<Project>) {
    guardProj(id)
    const cur = snap.state.projects.find((p) => p.id === id)
    const ch = changes(cur, patch, PROJ_LABELS)
    const apply = (s: AppState): AppState => ({ ...s, projects: s.projects.map((p) => (p.id === id ? { ...p, ...patch } : p)) })
    commit((s) => (ch ? log(apply(s), 'Proyek diubah', `${cur?.code || id} — ${ch}`, id) : apply(s)))
  },
  setBanner(id: string, banner: import('./types').BannerSettings) {
    if (!hasPerm('project.manage')) throw new Error('Tidak diizinkan.')
    guardProj(id)
    const cur = snap.state.projects.find((p) => p.id === id)
    const d = bannerDiff(cur?.banner, banner)
    commit((s) => log({ ...s, projects: s.projects.map((p) => (p.id === id ? { ...p, banner } : p)) }, 'Tampilan banner diubah', `${cur?.code || id}${d ? ' — ' + d : ''}`, id))
  },
  setPicList(id: string, picList: import('./types').ProjectPic[]) {
    if (!hasPerm('project.manage')) throw new Error('Tidak diizinkan.')
    guardProj(id)
    commit((s) => log({ ...s, projects: s.projects.map((p) => (p.id === id ? { ...p, picList } : p)) }, 'Daftar PIC proyek diubah', `${picList.length} PIC`, id))
  },
  deleteProject(id: string) {
    guardProj(id)
    commit((s) => {
      const left = s.projects.filter((p) => p.id !== id)
      return log(
        {
          ...s,
          projects: left,
          documents: s.documents.filter((d) => d.projectId !== id),
          transmittals: s.transmittals.filter((t) => t.projectId !== id),
          currentProjectId: s.currentProjectId === id ? left[0]?.id : s.currentProjectId,
        },
        'Proyek dihapus',
        id,
      )
    })
  },

  async setContractFile(projectId: string, file: File | null) {
    const p = snap.state.projects.find((x) => x.id === projectId)
    if (!p) return
    if (p.contractFile?.key) void deleteFile(p.contractFile.key)
    if (!file) return actions.updateProject(projectId, { contractFile: undefined })
    const key = uid()
    await putFile(key, file)
    const st = snap.state.settings
    const storage = await saveEverywhere(st, [clean(`${p.code} - ${p.name}`), '_Kontrak'], clean(`KONTRAK_${p.contractNo || p.code}_${file.name}`, 180), file)
    const driveFileId = storage.drive?.id
    reportStorage(storage)
    actions.updateProject(projectId, { contractFile: { name: file.name, size: file.size, mime: file.type, key, driveFileId, storage } })
  },
  async openContract(p: Project) {
    const f = p.contractFile
    if (!f) return undefined
    let blob = await getFile(f.key)
    if (!blob && f.driveFileId && drive.isConnected()) blob = await drive.downloadDriveFile(f.driveFileId)
    return blob
  },

  // ---------- Dokumen ----------
  nextDocNumber(projectId: string, i: { discipline: string; category: string; paper?: string } = { discipline: '', category: '' }) {
    const p = snap.state.projects.find((x) => x.id === projectId)
    if (!p) return ''
    const used = snap.state.documents.filter((d) => d.projectId === projectId).map((d) => d.number)
    return nextNumber(snap.state.settings, p, used, i)
  },
  addDoc(d: Omit<Doc, 'id' | 'createdAt' | 'revisions'>) {
    guardProj(d.projectId)
    const doc: Doc = { ...d, id: uid(), createdAt: nowIso(), revisions: [] }
    commit((s) => log({ ...s, documents: [...s.documents, doc] }, 'Dokumen dicatat', `${doc.number} ${doc.title}`, doc.projectId, doc.id))
    return doc.id
  },
  updateDoc(id: string, patch: Partial<Doc>) {
    guardDoc(id)
    const cur = snap.state.documents.find((d) => d.id === id)
    const ch = changes(cur, patch, DOC_LABELS)
    const apply = (s: AppState): AppState => ({ ...s, documents: s.documents.map((d) => (d.id === id ? { ...d, ...patch } : d)) })
    commit((s) => (ch ? log(apply(s), 'Dokumen diubah', `${cur?.number || id} — ${ch}`, cur?.projectId, id) : apply(s)))
  },

  async deleteDoc(id: string) {
    guardDoc(id)
    const d = snap.state.documents.find((x) => x.id === id)
    d?.revisions.forEach((r) => r.fileKey && void deleteFile(r.fileKey))
    commit((s) => log({ ...s, documents: s.documents.filter((x) => x.id !== id) }, 'Dokumen dihapus', d?.number || id, d?.projectId))
  },

  // ---------- Revisi ----------
  suggestRev(docId: string) {
    const d = snap.state.documents.find((x) => x.id === docId)
    return nextRev(d?.revisions.at(-1)?.rev, snap.state.settings.revisionScheme)
  },
  async addRevision(docId: string, r: Partial<Revision> & { rev: string; status: string }, file?: File) {
    const d = snap.state.documents.find((x) => x.id === docId)
    if (!d) return
    guardProj(d.projectId)
    if (!allowedStatuses(snap.state.settings, d.category).some((x) => x.code === r.status)) throw new Error(`Status ${r.status} tidak diizinkan untuk jenis dokumen ${d.category}.`)
    const rev: Revision = {
      id: uid(),
      issuedDate: today(),
      dueDate: addDays(today(), snap.state.settings.defaultReviewDays),
      notes: '',
      reviewResult: 'Pending',
      reviewComment: '',
      createdBy: userName(),
      ...r,
    }
    if (file) {
      rev.fileName = file.name
      rev.fileSize = file.size
      rev.fileMime = file.type
      rev.fileKey = uid()
      await putFile(rev.fileKey, file)
      const p = snap.state.projects.find((x) => x.id === d.projectId)!
      const st = snap.state.settings
      rev.storage = await saveEverywhere(st, folderSegments(st, p, d, rev), fileNameFor(st, p, d, rev, file.name), file)
      rev.driveFileId = rev.storage.drive?.id
      reportStorage(rev.storage)
    }
    commit((s) =>
      log(
        { ...s, documents: s.documents.map((x) => (x.id === docId ? { ...x, revisions: [...x.revisions, rev] } : x)) },
        'Revisi diterbitkan',
        `${d.number} Rev ${rev.rev} (${rev.status})`,
        d.projectId,
        docId,
      ),
    )
  },
  updateRevision(docId: string, revId: string, patch: Partial<Revision>, note?: string) {
    guardDoc(docId)
    const d = snap.state.documents.find((x) => x.id === docId)
    commit((s) =>
      log(
        {
          ...s,
          documents: s.documents.map((x) =>
            x.id === docId ? { ...x, revisions: x.revisions.map((r) => (r.id === revId ? { ...r, ...patch } : r)) } : x,
          ),
        },
        note || 'Revisi diubah',
        d ? `${d.number}` : docId,
        d?.projectId,
        docId,
      ),
    )
  },
  /** Kirim ulang berkas revisi ke tujuan yang belum berhasil / baru diaktifkan. */
  async resyncRevision(docId: string, revId: string, force = false) {
    const d = snap.state.documents.find((x) => x.id === docId)
    const r = d?.revisions.find((x) => x.id === revId)
    const p = snap.state.projects.find((x) => x.id === d?.projectId)
    if (!d || !r || !p || !r.fileName) return
    const blob = await actions.openFile(r)
    if (!blob) return setSession({ error: `File ${r.fileName} tidak tersedia di perangkat ini untuk dikirim ulang.` })
    const st = snap.state.settings
    const todo = enabledDests(st).filter((k: StorageDest) => force || !r.storage?.[k]?.ok)
    if (!todo.length) return
    const storage = await saveEverywhere(st, folderSegments(st, p, d, r), fileNameFor(st, p, d, r, r.fileName), blob, todo, r.storage)
    actions.updateRevision(docId, revId, { storage, driveFileId: storage.drive?.id ?? r.driveFileId }, 'Berkas dikirim ulang')
    reportStorage(storage)
  },
  async resyncAll(projectId: string) {
    setSession({ syncing: true, error: undefined })
    for (const d of snap.state.documents.filter((x) => x.projectId === projectId))
      for (const r of d.revisions) if (r.fileName) await actions.resyncRevision(d.id, r.id)
    setSession({ syncing: false })
  },
  async openFile(r: Revision) {
    let blob = r.fileKey ? await getFile(r.fileKey) : undefined
    if (!blob && r.driveFileId && drive.isConnected()) blob = await drive.downloadDriveFile(r.driveFileId)
    return blob
  },

  // ---------- Transmittal ----------
  nextTransmittalNumber(projectId: string) {
    const p = snap.state.projects.find((x) => x.id === projectId)
    const used = new Set(snap.state.transmittals.filter((t) => t.projectId === projectId).map((t) => t.number))
    let n = used.size + 1
    const fmt = (i: number) => `TR-${p?.code || 'XXX'}-${String(i).padStart(3, '0')}`
    while (used.has(fmt(n))) n++
    return fmt(n)
  },
  addTransmittal(t: Omit<Transmittal, 'id'>) {
    guardProj(t.projectId)
    const tr: Transmittal = { ...t, id: uid() }
    commit((s) => {
      const docs = s.documents.map((d) => ({
        ...d,
        revisions: d.revisions.map((r) => (tr.items.some((i) => i.revId === r.id) ? { ...r, transmittalId: tr.id } : r)),
      }))
      return log({ ...s, documents: docs, transmittals: [...s.transmittals, tr] }, 'Transmittal dibuat', `${tr.number} (${tr.items.length} dokumen)`, tr.projectId)
    })
    return tr.id
  },
  deleteTransmittal(id: string) {
    guardProj(snap.state.transmittals.find((t) => t.id === id)?.projectId)
    commit((s) => ({
      ...s,
      transmittals: s.transmittals.filter((t) => t.id !== id),
      documents: s.documents.map((d) => ({ ...d, revisions: d.revisions.map((r) => (r.transmittalId === id ? { ...r, transmittalId: undefined } : r)) })),
    }))
  },

  // ---------- Pengaturan & data ----------
  // Hanya administrator. Penghapusan itu sendiri dicatat sebagai satu entri log baru.
  deleteLogs(ids: string[], why = '') {
    const u = currentUser()
    if (!u || u.roleId !== 'admin') throw new Error('Hanya administrator yang boleh menghapus log aktivitas.')
    const del = new Set(ids)
    const n = snap.state.logs.filter((l) => del.has(l.id)).length
    if (!n) return 0
    commit((s) => log({ ...s, logs: s.logs.filter((l) => !del.has(l.id)) }, 'Log aktivitas dihapus', `${n} entri${why ? ' — ' + why : ''}`))
    return n
  },
  updateSettings(patch: Partial<Settings>) {
    // Identitas aplikasi (nama, slogan, logo, warna utama) hanya boleh diubah administrator.
    const u = currentUser()
    if (u && u.roleId !== 'admin' && ['appName', 'appTagline', 'appLogo', 'accentColor', 'logIp', 'sideStyle', 'googleLogin'].some((k) => k in patch)) throw new Error('Hanya administrator yang boleh mengubah identitas aplikasi.')
    if ('logIp' in patch) refreshIp(!!patch.logIp)
    commit((s) => ({ ...s, settings: { ...s.settings, ...patch } }))
  },
  exportJson() {
    return JSON.stringify(snap.state, null, 2)
  },
  importJson(text: string) {
    const parsed = JSON.parse(text) as AppState
    if (!parsed.projects || !parsed.documents) throw new Error('Format file cadangan tidak valid')
    commit((s) => log({ ...normalize(parsed), users: s.users, roles: s.roles, settings: { ...normalize(parsed).settings, googleClientId: s.settings.googleClientId } }, 'Data diimpor', 'dari cadangan'))
  },
  loadDemo() {
    commit((s) => ({ ...demoState(), users: s.users, roles: s.roles, settings: { ...demoState().settings, ...s.settings } }))
  },
  deleteRevision(docId: string, revId: string) {
    guardDoc(docId)
    const d = snap.state.documents.find((x) => x.id === docId)
    const r = d?.revisions.find((x) => x.id === revId)
    if (r?.fileKey) void deleteFile(r.fileKey)
    commit((s) =>
      log({ ...s, documents: s.documents.map((x) => (x.id === docId ? { ...x, revisions: x.revisions.filter((y) => y.id !== revId) } : x)) },
        'Revisi dihapus', `${d?.number} Rev ${r?.rev}`, d?.projectId, docId),
    )
  },
  resetAll() {
    commit((s) => ({ ...emptyState(), users: s.users, roles: s.roles, settings: s.settings }))
  },
}
