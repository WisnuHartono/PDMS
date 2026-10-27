import { useMemo, useState } from 'react'
import { actions, useApp, useAuth } from './store'
import { ask, notify } from './ui'
import { useCurrent } from './Documents'
import { downloadBlob, toCsv } from './util'
import type { LogEntry } from './types'

// Kelompok aksi untuk filter dan pewarnaan
const CATS: [string, string, string][] = [
  ['keamanan', 'Keamanan & login', '#b45309'],
  ['pengguna', 'Pengguna', '#7c3aed'],
  ['proyek', 'Proyek', '#1d4ed8'],
  ['dokumen', 'Dokumen & revisi', '#16a34a'],
  ['transmittal', 'Transmittal', '#0891b2'],
  ['data', 'Data & cadangan', '#64748b'],
]
const catOf = (a: string) =>
  /login|logout|kata sandi|sandi|2fa|dikunci/i.test(a) ? 'keamanan'
    : /pengguna|administrator/i.test(a) ? 'pengguna'
    : /transmittal/i.test(a) ? 'transmittal'
    : /dokumen|revisi|review|hasil/i.test(a) ? 'dokumen'
    : /proyek|pic|banner/i.test(a) ? 'proyek' : 'data'
const catInfo = (k: string) => CATS.find((c) => c[0] === k) || CATS[5]

const fmtTs = (iso: string) => {
  const d = new Date(iso)
  const p = (n: number) => String(n).padStart(2, '0')
  return `${p(d.getDate())}/${p(d.getMonth() + 1)}/${String(d.getFullYear()).slice(2)} ${p(d.getHours())}.${p(d.getMinutes())}.${p(d.getSeconds())}`
}
const splitUser = (u: string) => { const m = /^(.*?)\s*\(([^)]+)\)$/.exec(u); return m ? { name: m[1], un: m[2] } : { name: u, un: '' } }
const devIcon = (d: string) => (/· HP$/.test(d) ? '📱' : /· Tablet$/.test(d) ? '📲' : '💻')
const PAGE = 100

export default function Logs() {
  const { state } = useApp()
  const { project } = useCurrent()
  const { user, projects, can } = useAuth()
  const all = user?.roleId === 'admin' || user?.allowedProjects === 'all'
  const ok = new Set(projects.map((p) => p.id))
  const [q, setQ] = useState('')
  const [cat, setCat] = useState('')
  const [who, setWho] = useState('')
  const [prj, setPrj] = useState<string>(project?.id || '')
  const [from, setFrom] = useState('')
  const [to, setTo] = useState('')
  const [limit, setLimit] = useState(PAGE)

  const visible = useMemo(() => state.logs.filter((l) => (l.projectId ? ok.has(l.projectId) : all)), [state.logs, projects, all]) // eslint-disable-line react-hooks/exhaustive-deps
  const users = useMemo(() => [...new Set(visible.map((l) => l.user))].sort((a, b) => a.localeCompare(b)), [visible])
  const codeOf = (id?: string) => (id ? state.projects.find((p) => p.id === id)?.code : undefined)
  const rows = useMemo(() => {
    const t = q.trim().toLowerCase()
    const f = from ? new Date(from + 'T00:00:00').getTime() : 0
    const e = to ? new Date(to + 'T23:59:59').getTime() : Infinity
    return visible.filter((l) => {
      if (prj && l.projectId !== prj && l.projectId) return false
      if (cat && catOf(l.action) !== cat) return false
      if (who && l.user !== who) return false
      const ts = new Date(l.ts).getTime()
      if (ts < f || ts > e) return false
      return !t || `${l.action} ${l.detail} ${l.user} ${l.device || ''} ${l.ip || ''} ${codeOf(l.projectId) || ''}`.toLowerCase().includes(t)
    })
  }, [visible, q, cat, who, prj, from, to]) // eslint-disable-line react-hooks/exhaustive-deps
  const filtered = !!(q || cat || who || from || to || (prj && prj !== (project?.id || '')))
  const reset = () => { setQ(''); setCat(''); setWho(''); setFrom(''); setTo(''); setPrj(project?.id || ''); setLimit(PAGE) }
  const exportCsv = () => {
    const csv = toCsv([['Waktu', 'Pengguna', 'Perangkat', 'IP', 'Kategori', 'Aksi', 'Proyek', 'Detail'], ...rows.map((l) => [new Date(l.ts).toLocaleString('id-ID'), l.user, l.device || '', l.ip || '', catInfo(catOf(l.action))[1], l.action, codeOf(l.projectId) || '', l.detail])])
    downloadBlob(new Blob(['﻿' + csv], { type: 'text/csv;charset=utf-8' }), `log-aktivitas-${new Date().toISOString().slice(0, 10)}.csv`)
  }
  // Hapus log (khusus administrator)
  const isAdmin = user?.roleId === 'admin'
  const [sel, setSel] = useState<Set<string>>(new Set())
  const [old, setOld] = useState('')
  const shown = rows.slice(0, limit)
  const allSel = shown.length > 0 && shown.every((l) => sel.has(l.id))
  const toggle = (id: string) => setSel((s) => { const n = new Set(s); n.has(id) ? n.delete(id) : n.add(id); return n })
  const remove = async (ids: string[], what: string) => {
    if (!ids.length) return
    if (!(await ask(`Hapus ${ids.length} entri log aktivitas (${what})?\n\nTindakan ini tidak bisa dibatalkan. Disarankan ekspor CSV dahulu sebagai arsip.`))) return
    try { const n = actions.deleteLogs(ids, what); setSel(new Set()); notify(`${n} entri log dihapus.`) } catch (x: any) { notify(x.message) }
  }
  const removeOld = () => {
    const days = +old
    if (!days) return
    const cut = Date.now() - days * 86400e3
    void remove(visible.filter((l) => new Date(l.ts).getTime() < cut).map((l) => l.id), `lebih lama dari ${days} hari`)
    setOld('')
  }
  const detail = (l: LogEntry) => {
    const [head, ...rest] = l.detail.split(' — ')
    const body = l.docId ? <a href={'#/doc/' + l.docId}>{head}</a> : <b>{head}</b>
    return <>{body}{rest.length > 0 && <span className="lg-ch"> — {rest.join(' — ')}</span>}</>
  }

  return (
    <>
      <div className="top"><h1>Log Aktivitas</h1></div>
      <div className="logpage">
      <div className="card lgf">
        <label className="lgf-f lgf-q" title="Cari"><span className="sr">Cari</span><input placeholder="🔎 Aksi, detail…" value={q} onChange={(e) => { setQ(e.target.value); setLimit(PAGE) }} /></label>
        <label className="lgf-f" title="Proyek"><span className="sr">Proyek</span>
          <select value={prj} onChange={(e) => { setPrj(e.target.value); setLimit(PAGE) }}>
            <option value="">Semua proyek</option>
            {projects.map((p) => <option key={p.id} value={p.id}>{p.code}</option>)}
          </select>
        </label>
        <label className="lgf-f" title="Kategori"><span className="sr">Kategori</span>
          <select value={cat} onChange={(e) => { setCat(e.target.value); setLimit(PAGE) }}>
            <option value="">Semua kategori</option>
            {CATS.map(([k, l]) => <option key={k} value={k}>{l}</option>)}
          </select>
        </label>
        <label className="lgf-f" title="Pengguna"><span className="sr">Pengguna</span>
          <select value={who} onChange={(e) => { setWho(e.target.value); setLimit(PAGE) }}>
            <option value="">Semua pengguna</option>
            {users.map((u) => <option key={u} value={u}>{u}</option>)}
          </select>
        </label>
        <label className="lgf-f lgf-d"><span>Dari</span><input type="date" value={from} onChange={(e) => { setFrom(e.target.value); setLimit(PAGE) }} /></label>
        <label className="lgf-f lgf-d"><span>Sampai</span><input type="date" value={to} onChange={(e) => { setTo(e.target.value); setLimit(PAGE) }} /></label>
        <div className="lgf-btns">
          {filtered && <button type="button" className="auto sec sm" onClick={reset}>Reset</button>}
          {can('export') && <button type="button" className="auto sec sm" disabled={!rows.length} onClick={exportCsv}>⬇ CSV</button>}
        </div>
      </div>
      {isAdmin && (
        <div className="card lg-adm">
          <b>🗑 Kelola log (administrator)</b>
          <button type="button" className="auto sec sm danger-b" disabled={!sel.size} onClick={() => remove([...sel], 'dipilih manual')}>Hapus terpilih ({sel.size})</button>
          <button type="button" className="auto sec sm danger-b" disabled={!rows.length} onClick={() => remove(rows.map((l) => l.id), filtered ? 'sesuai filter' : 'semua log yang tampil')}>Hapus {filtered ? 'hasil filter' : 'semua'} ({rows.length})</button>
          <label className="lg-old">Hapus yang lebih lama dari
            <select value={old} onChange={(e) => setOld(e.target.value)}><option value="">pilih…</option><option value="30">30 hari</option><option value="90">90 hari</option><option value="180">180 hari</option><option value="365">1 tahun</option></select>
          </label>
          <label className="lg-old lg-ipt" title="Aplikasi tanpa server: IP publik hanya bisa diketahui lewat layanan luar (api.ipify.org). Bila dinyalakan, alamat IP pengguna dikirim ke layanan itu dan dicatat di log baru."><input type="checkbox" className="lg-cb" checked={!!state.settings.logIp} onChange={(e) => { try { actions.updateSettings({ logIp: e.target.checked }) } catch (x: any) { notify(x.message) } }} /> Catat IP publik</label>
          {old && <button type="button" className="auto sec sm danger-b" onClick={removeOld}>Hapus sekarang</button>}
        </div>
      )}
      <div className="card tw ltable">
        <table>
          <colgroup>{isAdmin && <col style={{ width: 30 }} />}<col style={{ width: 128 }} /><col style={{ width: 230 }} /><col style={{ width: 140 }} /><col style={{ width: 74 }} /><col /></colgroup>
          <thead><tr>{isAdmin && <th><input type="checkbox" className="lg-cb" checked={allSel} title="Pilih semua yang tampil" onChange={() => setSel(allSel ? new Set() : new Set(shown.map((l) => l.id)))} /></th>}<th>Waktu</th><th>Pengguna</th><th>Aksi</th><th>Proyek</th><th>Detail</th></tr></thead>
          <tbody>
            {shown.map((l) => {
              const c = catInfo(catOf(l.action)); const u = splitUser(l.user)
              return (
                <tr key={l.id} className={sel.has(l.id) ? 'lg-sel' : undefined}>
                  {isAdmin && <td><input type="checkbox" className="lg-cb" checked={sel.has(l.id)} onChange={() => toggle(l.id)} /></td>}
                  <td className="nw">{fmtTs(l.ts)}</td>
                  <td title={l.user}><span className="lg-u">{u.name}</span>{u.un && <span className="muted"> @{u.un}</span>}{(l.device || l.ip) && <div className="lg-dev" title={[l.device, l.ip && 'IP ' + l.ip].filter(Boolean).join(' · ')}>{l.device && <span>{devIcon(l.device)} {l.device}</span>}{l.ip && <span className="lg-ip">🌐 {l.ip}</span>}</div>}</td>
                  <td><span className="lg-act" style={{ '--c': c[2] } as React.CSSProperties} title={c[1]}>{l.action}</span></td>
                  <td className="nw">{codeOf(l.projectId) || <span className="muted">—</span>}</td>
                  <td>{detail(l)}</td>
                </tr>
              )
            })}
            {!rows.length && <tr><td colSpan={isAdmin ? 6 : 5} className="muted" style={{ textAlign: 'center', padding: 18 }}>Tidak ada aktivitas yang cocok.</td></tr>}
          </tbody>
        </table>
        <div className="lgf-foot">
          <span className="muted">Menampilkan {Math.min(limit, rows.length)} dari {rows.length} aktivitas{rows.length !== visible.length ? ` (total ${visible.length})` : ''}</span>
          {rows.length > limit && <button type="button" className="auto sec sm" onClick={() => setLimit(limit + PAGE)}>Tampilkan {Math.min(PAGE, rows.length - limit)} lagi</button>}
        </div>
      </div>
      </div>
    </>
  )
}
