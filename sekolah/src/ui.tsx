import { createContext, useContext, useEffect, useState, type ReactNode } from 'react'
import { createPortal } from 'react-dom'
import { Icon } from './icons'

// ---------- Navigasi tab ----------
export type PageId =
  | 'dashboard' | 'siswa' | 'pegawai' | 'induk' | 'rombel' | 'mapel' | 'ekskul'
  | 'absensiSiswa' | 'absensiPegawai' | 'nilai' | 'rapor' | 'prasarana' | 'administrasi' | 'pengaturan' | 'akun'

export interface NavCtx {
  open: (p: PageId) => void
}
export const Nav = createContext<NavCtx>({ open: () => {} })
export const useNav = () => useContext(Nav)

// ---------- Widget card (gaya kartu dashboard) ----------
export function Card({ title, children, actions, onRefresh, className = '', bodyClass = '' }: {
  title: ReactNode; children: ReactNode; actions?: ReactNode; onRefresh?: () => void; className?: string; bodyClass?: string
}) {
  return (
    <section className={`card ${className}`}>
      <header className="card-h">
        <h3>{title}</h3>
        <div className="card-actions">
          {actions}
          {onRefresh && <button className="icon-btn" title="Muat ulang" onClick={onRefresh}><Icon name="refresh" size={16} /></button>}
        </div>
      </header>
      <div className={`card-b ${bodyClass}`}>{children}</div>
    </section>
  )
}

export function PageHead({ title, sub, children }: { title: string; sub?: string; children?: ReactNode }) {
  return (
    <div className="page-head">
      <div>
        <h2>{title}</h2>
        {sub && <p className="muted">{sub}</p>}
      </div>
      <div className="page-actions">{children}</div>
    </div>
  )
}

export function Btn({ icon, children, kind = 'default', ...rest }: React.ButtonHTMLAttributes<HTMLButtonElement> & { icon?: string; kind?: 'default' | 'primary' | 'danger' | 'ghost' }) {
  return (
    <button {...rest} className={`btn btn-${kind} ${rest.className ?? ''}`}>
      {icon && <Icon name={icon} size={16} />}
      {children && <span>{children}</span>}
    </button>
  )
}

// ---------- Modal ----------
export function Modal({ title, onClose, children, footer, wide }: { title: string; onClose: () => void; children: ReactNode; footer?: ReactNode; wide?: boolean }) {
  useEffect(() => {
    const k = (e: KeyboardEvent) => e.key === 'Escape' && onClose()
    window.addEventListener('keydown', k)
    return () => window.removeEventListener('keydown', k)
  }, [onClose])
  return createPortal(
    <div className="modal-bg" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <div className={`modal ${wide ? 'wide' : ''}`} role="dialog" aria-label={title}>
        <header className="modal-h">
          <h3>{title}</h3>
          <button className="icon-btn" onClick={onClose} aria-label="Tutup"><Icon name="close" size={18} /></button>
        </header>
        <div className="modal-b">{children}</div>
        {footer && <footer className="modal-f">{footer}</footer>}
      </div>
    </div>,
    document.body,
  )
}

// ---------- Form ----------
export function Field({ label, children, span = 1, hint }: { label: string; children: ReactNode; span?: 1 | 2 | 3 | 4; hint?: string }) {
  return (
    <label className={`field span-${span}`}>
      <span className="field-l">{label}</span>
      {children}
      {hint && <small className="muted">{hint}</small>}
    </label>
  )
}

type Setter<T> = (patch: Partial<T>) => void

/** Input teks/tanggal/angka terikat ke properti objek. */
export function Inp<T>({ obj, k, set, type = 'text', ...rest }: { obj: T; k: keyof T; set: Setter<T>; type?: string } & Omit<React.InputHTMLAttributes<HTMLInputElement>, 'type'>) {
  const v = obj[k] as unknown
  return (
    <input
      {...rest}
      type={type}
      value={v === undefined || v === null ? '' : String(v)}
      onChange={(e) => set({ [k]: type === 'number' ? (e.target.value === '' ? undefined : Number(e.target.value)) : e.target.value } as Partial<T>)}
    />
  )
}

export function Sel<T>({ obj, k, set, options, empty }: { obj: T; k: keyof T; set: Setter<T>; options: (string | [string, string])[]; empty?: string }) {
  return (
    <select value={String(obj[k] ?? '')} onChange={(e) => set({ [k]: e.target.value || undefined } as Partial<T>)}>
      {empty !== undefined && <option value="">{empty}</option>}
      {options.map((o) => {
        const [v, l] = Array.isArray(o) ? o : [o, o]
        return <option key={v} value={v}>{l}</option>
      })}
    </select>
  )
}

export function Tabs<T extends string>({ tabs, value, onChange }: { tabs: [T, string][]; value: T; onChange: (t: T) => void }) {
  return (
    <div className="subtabs" role="tablist">
      {tabs.map(([id, l]) => (
        <button key={id} role="tab" aria-selected={value === id} className={value === id ? 'on' : ''} onClick={() => onChange(id)}>{l}</button>
      ))}
    </div>
  )
}

export function Empty({ children }: { children: ReactNode }) {
  return <div className="empty">{children}</div>
}

export function Avatar({ nama, foto, size = 32 }: { nama: string; foto?: string; size?: number }) {
  const ini = nama.split(/\s+/).filter(Boolean).slice(0, 2).map((s) => s[0]).join('').toUpperCase()
  return foto
    ? <img className="avatar" src={foto} alt="" style={{ width: size, height: size }} />
    : <span className="avatar" style={{ width: size, height: size, fontSize: size * 0.38 }}>{ini}</span>
}

// ---------- Toast ----------
let toastFn: (m: string) => void = () => {}
export const toast = (m: string) => toastFn(m)
export function ToastHost() {
  const [msg, setMsg] = useState<string | null>(null)
  useEffect(() => {
    let t: ReturnType<typeof setTimeout>
    toastFn = (m) => { setMsg(m); clearTimeout(t); t = setTimeout(() => setMsg(null), 2600) }
  }, [])
  return msg ? <div className="toast" role="status">{msg}</div> : null
}

// ---------- Cetak ----------
let printFn: (n: ReactNode) => void = () => {}
/** Render konten ke area cetak lalu buka dialog cetak (browser / Electron). */
export const printDoc = (n: ReactNode) => printFn(n)
export function PrintHost() {
  const [node, setNode] = useState<ReactNode>(null)
  useEffect(() => { printFn = (n) => setNode(n) }, [])
  useEffect(() => {
    if (!node) return
    const t = setTimeout(() => {
      window.print()
      setNode(null)
    }, 150)
    return () => clearTimeout(t)
  }, [node])
  return createPortal(<div id="print-root">{node}</div>, document.body)
}
