import { useState } from 'react'
import { actions, useApp, useAuth } from './store'
import { Modal, go, ask, notify, Logo, PickBox } from './ui'
import { fmtSize, fileToLogo, fileToBanner, downloadBlob, today } from './util'
import { ProjectBanner, type BannerView } from './ProjectBanner'
import { PicManager } from './PicManager'
import { ProjectAccess } from './ProjectAccess'
import { bannerOf, THEME_PRESETS, PATTERNS } from './banner'
import type { BannerSettings, BannerTheme } from './types'
import type { Project } from './types'

type Form = Omit<Project, 'id' | 'createdAt' | 'archived'>
const blank: Form = {
  code: '', name: '', client: '', contractor: '', location: '', manager: '', description: '',
  startDate: '', endDate: '', color: '#1d4ed8', numberPrefix: '', numberPadding: 3,
  contractNo: '', contractDate: '', contractValue: '', clientLogo: '', contractorLogo: '',
}

export function ProjectForm({ initial, onSave, onClose }: { initial?: Project; onSave: (f: Form, contract?: File | null) => void; onClose: () => void }) {
  const [f, setF] = useState<Form>(initial ? { ...initial } : blank)
  const set = (k: keyof Form, v: string | number | undefined) => setF({ ...f, [k]: v })
  const [contract, setContract] = useState<File | null | undefined>(undefined) // undefined = tidak diubah, null = hapus
  const pickLogo = async (k: 'clientLogo' | 'contractorLogo', file?: File) => {
    if (!file) return
    try { set(k, await fileToLogo(file)) } catch (e: any) { notify(e.message) }
  }
  const curContract = contract === null ? undefined : contract ? { name: contract.name, size: contract.size } : initial?.contractFile
  const ok = f.code.trim() && f.name.trim()
  return (
    <Modal title={initial ? 'Ubah Proyek' : 'Proyek Baru'} onClose={onClose}>
      <div className="row">
        <label>Kode proyek *<input value={f.code} onChange={(e) => set('code', e.target.value.toUpperCase())} placeholder="PRJ-001" /></label>
        <label>Nama proyek *<input value={f.name} onChange={(e) => set('name', e.target.value)} /></label>
      </div>
      <div className="row">
        <label>Klien / Owner<input value={f.client} onChange={(e) => set('client', e.target.value)} /></label>
        <label>Kontraktor<input value={f.contractor} onChange={(e) => set('contractor', e.target.value)} /></label>
      </div>
      <BannerControls value={bannerOf(f as Project)} onChange={(b) => setF({ ...f, banner: b })} has={{ client: !!f.clientLogo, contractor: !!f.contractorLogo }} color={f.color} logos={{ client: f.clientLogo, contractor: f.contractorLogo }} onLogo={(k, file) => pickLogo(k === 'client' ? 'clientLogo' : 'contractorLogo', file)} onClear={(k) => set(k === 'client' ? 'clientLogo' : 'contractorLogo', '')} />
      <div className="row">
        <label>No. kontrak proyek<input value={f.contractNo || ''} onChange={(e) => set('contractNo', e.target.value)} placeholder="mis. 001/KTR/2026" /></label>
        <label>Tanggal kontrak<input type="date" value={f.contractDate || ''} onChange={(e) => set('contractDate', e.target.value)} /></label>
        <label>Nilai kontrak<input value={f.contractValue || ''} onChange={(e) => set('contractValue', e.target.value)} placeholder="mis. Rp 12.500.000.000" /></label>
      </div>
      <label>Lampiran kontrak (PDF / dokumen)
        <PickBox text={curContract ? 'Ganti lampiran' : 'Pilih lampiran kontrak'} onFile={(file) => setContract(file)} />
        {curContract && <span style={{ display: 'flex', gap: 10, alignItems: 'center', marginTop: 6 }}><span>📎 {curContract.name} ({fmtSize(curContract.size)})</span><button type="button" className="auto sec sm" onClick={() => setContract(null)}>Hapus lampiran</button></span>}
      </label>
      <div className="row">
        <label>Lokasi<input value={f.location} onChange={(e) => set('location', e.target.value)} /></label>
        <label>Project Manager<input value={f.manager} onChange={(e) => set('manager', e.target.value)} /></label>
      </div>
      <div className="row">
        <label>Mulai<input type="date" value={f.startDate} onChange={(e) => set('startDate', e.target.value)} /></label>
        <label>Selesai<input type="date" value={f.endDate} onChange={(e) => set('endDate', e.target.value)} /></label>
        <label>Warna<input type="color" value={f.color} onChange={(e) => set('color', e.target.value)} /></label>
      </div>
      <div className="row">
        <label>Inisial proyek (untuk nomor dokumen)<input value={f.numberPrefix} onChange={(e) => set('numberPrefix', e.target.value.toUpperCase())} placeholder={f.code || 'mis. GSP'} /></label>
        <label>Jumlah digit urut<input type="number" min={2} max={8} value={f.numberPadding} onChange={(e) => set('numberPadding', +e.target.value)} /></label>
      </div>
      <label>Deskripsi<textarea rows={3} value={f.description} onChange={(e) => set('description', e.target.value)} /></label>
      <button disabled={!ok} onClick={() => { onSave(f, contract); onClose() }}>Simpan</button>
    </Modal>
  )
}

export default function Projects() {
  const { state } = useApp()
  const { can, projects } = useAuth()
  const [edit, setEdit] = useState<Project | 'new' | null>(null)
  const [picFor, setPicFor] = useState<Project | null>(null)
  const [accFor, setAccFor] = useState<Project | null>(null)
  const [view, setView] = useState<BannerView>(() => { try { const v = localStorage.getItem('dc.projView'); return v === 'list' || v === 'compact' ? v : 'detail' } catch { return 'detail' } })
  const pick = (v: BannerView) => { setView(v); try { localStorage.setItem('dc.projView', v) } catch { /* abaikan */ } }
  return (
    <>
      <div className="top">
        <h1>Daftar Proyek</h1>
        <div className="seg" style={{ marginLeft: 'auto' }}>
          {([['list', '☰ List'], ['compact', '▦ Compact'], ['detail', '▤ Detail']] as const).map(([v, l]) => (
            <button key={v} className={view === v ? 'on' : ''} onClick={() => pick(v)}>{l}</button>
          ))}
        </div>
        {can('project.manage') && <button onClick={() => setEdit('new')}>+ Proyek Baru</button>}
      </div>
      {projects.length === 0 && <div className="card muted">Belum ada proyek. Buat proyek pertama Anda; satu akun dapat menampung banyak proyek.</div>}
      <div className={view === 'compact' ? 'grid g3' : 'pb-wrap'}>
        {projects.map((p) => (
          <ProjectBanner key={p.id} state={state} project={p} view={view} today={today()} actions={
            <>
              <button className="auto hbtn" onClick={() => { actions.setCurrent(p.id); go('/') }}>Buka</button>
              {can('project.manage') && <>
                <button className="auto hbtn" onClick={() => setEdit(p)}>Ubah</button>
                {can('users.manage') && <button className="auto hbtn" onClick={() => setAccFor(p)}>🔐 Akses</button>}
                <button className="auto hbtn" onClick={() => setPicFor(p)}>👥 PIC{p.picList?.length ? ` (${p.picList.length})` : ''}</button>
                <button className="auto hbtn" onClick={() => actions.updateProject(p.id, { archived: !p.archived })}>{p.archived ? 'Aktifkan' : 'Arsipkan'}</button>
                <button className="auto hbtn" style={{ background: '#dc2626aa' }} onClick={async () => (await ask(`Hapus proyek ${p.code} beserta seluruh dokumennya?`)) && actions.deleteProject(p.id)}>Hapus</button>
              </>}
              {view === 'detail' && p.contractFile && <button className="auto hbtn" onClick={async () => { const b = await actions.openContract(p); b ? downloadBlob(b, p.contractFile!.name) : notify('File kontrak tidak tersedia di perangkat ini.') }}>📎 {p.contractFile.name}</button>}
            </>
          } />
        ))}
      </div>
      {accFor && <ProjectAccess project={accFor} onClose={() => setAccFor(null)} />}
      {picFor && <PicManager project={state.projects.find((x) => x.id === picFor.id) || picFor} onClose={() => setPicFor(null)} />}
      {edit && (
        <ProjectForm
          initial={edit === 'new' ? undefined : edit}
          onClose={() => setEdit(null)}
          onSave={(f, contract) => {
            const id = edit === 'new' ? actions.addProject(f) : (actions.updateProject(edit.id, f), edit.id)
            if (contract !== undefined) void actions.setContractFile(id, contract)
          }}
        />
      )}
    </>
  )
}

// Bagian pengaturan yang bisa dibuka/ditutup; status buka-tutup diingat di perangkat ini. Ringkasan pilihan tampil di judul.
function Fold({ id, title, hint, children }: { id: string; title: string; hint?: string; children: React.ReactNode }) {
  const key = 'dc.fold.' + id
  const [open, setOpen] = useState(() => { try { return localStorage.getItem(key) === '1' } catch { return false } })
  return (
    <details className="fold" open={open} onToggle={(e) => { const o = (e.currentTarget as HTMLDetailsElement).open; setOpen(o); try { localStorage.setItem(key, o ? '1' : '0') } catch { /* abaikan */ } }}>
      <summary><b>{title}</b>{hint && <span className="muted"> · {hint}</span>}</summary>
      <div className="fold-b">{children}</div>
    </details>
  )
}

export function BannerControls({ value, onChange, has, color, logos, onLogo, onClear }: { value: BannerSettings; onChange: (b: BannerSettings) => void; has: { client: boolean; contractor: boolean }; color?: string; logos: { client?: string; contractor?: string }; onLogo: (k: 'client' | 'contractor', f?: File) => void; onClear: (k: 'client' | 'contractor') => void }) {
  const th: BannerTheme = value.theme ?? { preset: 'auto' }
  const setTh = (x: Partial<BannerTheme>) => onChange({ ...value, theme: { ...th, ...x } })
  const pickImg = async (file?: File) => { if (!file) return; try { setTh({ image: await fileToBanner(file) }) } catch (e: any) { notify(e.message) } }
  const sw = (bg: string) => ({ background: bg, width: 44, height: 30, borderRadius: 8, border: '2px solid transparent', cursor: 'pointer', padding: 0 }) as const
  const sel = (on: boolean) => ({ outline: on ? '3px solid var(--pri, #2563eb)' : 'none', outlineOffset: 1 })
  const one = (k: 'client' | 'contractor', label: string) => {
    const v = value[k]
    const src = logos[k]
    const up = (x: Partial<typeof v>) => onChange({ ...value, [k]: { ...v, ...x } })
    return (
      <div className="card lgcard">
        <div className="lg-top">
          <b>Logo {label}</b>
          {src && <label className="lg-show"><input type="checkbox" checked={v.show} onChange={(e) => up({ show: e.target.checked })} /> Tampilkan di banner</label>}
        </div>
        <div className="lg-pick">
          <PickBox text={src ? 'Klik / seret untuk ganti' : 'Pilih logo'} preview={src || undefined} accept="image/*" onFile={(file) => onLogo(k, file)} />
          {src && <button type="button" className="auto sec sm" onClick={() => onClear(k)}>Hapus</button>}
        </div>
        {src && v.show && (
          <div className="lg-grid">
            <label>Posisi<select value={v.pos} onChange={(e) => up({ pos: e.target.value as BannerSettings['client']['pos'] })}><option value="left">Kiri</option><option value="center">Tengah (setelah judul)</option><option value="right">Kanan</option></select></label>
            <label>Letak<select value={v.row ?? 'title'} onChange={(e) => up({ row: e.target.value as 'title' | 'top' })}><option value="title">Sejajar judul</option><option value="top">Baris atas (di atas judul)</option></select></label>
            {(v.row ?? 'title') === 'title' && <label>Rata vertikal<select value={v.valign ?? 'center'} onChange={(e) => up({ valign: e.target.value as 'start' | 'center' | 'end' })}><option value="start">Atas</option><option value="center">Tengah</option><option value="end">Bawah</option></select></label>}
            <label>Geser kiri-kanan ({v.dx ?? 0}px)<input type="range" min={-80} max={80} step={2} value={v.dx ?? 0} onChange={(e) => up({ dx: +e.target.value })} /></label>
            <label>Geser atas-bawah ({v.dy ?? 0}px)<input type="range" min={-40} max={40} step={2} value={v.dy ?? 0} onChange={(e) => up({ dy: +e.target.value })} /></label>
            <label>Latar logo<select value={v.bg ?? value.bg} onChange={(e) => up({ bg: e.target.value as BannerSettings['bg'] })}><option value="white">Kotak putih</option><option value="glass">Transparan (kaca)</option><option value="none">Tanpa latar</option></select></label>
            <label>Ukuran ({v.size}px)<input type="range" min={24} max={140} step={2} value={v.size} onChange={(e) => up({ size: +e.target.value })} /></label>
            <label>Bayangan ({v.shadow ?? 0}%)<input type="range" min={0} max={100} step={5} value={v.shadow ?? 0} onChange={(e) => up({ shadow: +e.target.value })} /></label>
            <label>Ketajaman ({v.sharp ?? 0}%)<input type="range" min={0} max={100} step={5} value={v.sharp ?? 0} onChange={(e) => up({ sharp: +e.target.value })} /></label>
            <div className="lg-checks">
              <label><input type="checkbox" checked={!!v.clearWhite} onChange={(e) => up({ clearWhite: e.target.checked })} /> Hapus warna putih logo</label>
              <label><input type="checkbox" checked={!!v.halo} onChange={(e) => up({ halo: e.target.checked })} /> Garis tepi putih</label>
            </div>
          </div>
        )}
      </div>
    )
  }
  return (
    <div style={{ marginBottom: 10 }}>
      <Fold id="tema" title="Tema & latar banner" hint={`${th.preset === 'auto' ? 'Otomatis' : th.preset === 'custom' ? 'Warna sendiri' : THEME_PRESETS.find((x) => x.id === th.preset)?.name}${th.pattern && th.pattern !== 'none' ? ' · pola ' + (PATTERNS.find((x) => x.id === th.pattern)?.name || '').toLowerCase() : ''}${th.image ? ' · gambar latar' : ''}`}>
      <div className="card" style={{ padding: 10, margin: 0 }}>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
          <button type="button" title="Ikuti warna proyek" style={{ ...sw(`linear-gradient(135deg, ${color || '#1d4ed8'}, #0f172a)`), ...sel(th.preset === 'auto') }} onClick={() => setTh({ preset: 'auto' })} />
          {THEME_PRESETS.map((x) => (
            <button type="button" key={x.id} title={x.name} style={{ ...sw(`linear-gradient(135deg, ${x.c1}, ${x.c2})`), ...sel(th.preset === x.id) }} onClick={() => setTh({ preset: x.id, c1: x.c1, c2: x.c2 })} />
          ))}
          <button type="button" title="Warna sendiri" style={{ ...sw(`conic-gradient(red, yellow, lime, cyan, blue, magenta, red)`), ...sel(th.preset === 'custom') }} onClick={() => setTh({ preset: 'custom', c1: th.c1 || '#1d4ed8', c2: th.c2 || '#0f172a' })} />
        </div>
        <div className="muted" style={{ marginTop: 4 }}>Pilih tema: {th.preset === 'auto' ? 'Otomatis (warna proyek)' : th.preset === 'custom' ? 'Warna sendiri' : THEME_PRESETS.find((x) => x.id === th.preset)?.name}</div>
        {th.preset === 'custom' && (
          <div className="row" style={{ marginTop: 6 }}>
            <label>Warna 1<input type="color" value={th.c1 || '#1d4ed8'} onChange={(e) => setTh({ c1: e.target.value })} /></label>
            <label>Warna 2<input type="color" value={th.c2 || '#0f172a'} onChange={(e) => setTh({ c2: e.target.value })} /></label>
          </div>
        )}
        <div className="row" style={{ marginTop: 6 }}>
          <label>Arah gradasi ({th.angle ?? 135}°)<input type="range" min={0} max={360} step={5} value={th.angle ?? 135} onChange={(e) => setTh({ angle: +e.target.value })} /></label>
          <label>Pola<select value={th.pattern || 'none'} onChange={(e) => setTh({ pattern: e.target.value as BannerTheme['pattern'] })}>{PATTERNS.map((x) => <option key={x.id} value={x.id}>{x.name}</option>)}</select></label>
          <label>Warna teks<select value={th.text || ''} onChange={(e) => setTh({ text: (e.target.value || undefined) as BannerTheme['text'] })}><option value="">Otomatis</option><option value="light">Terang</option><option value="dark">Gelap</option></select></label>
        </div>
        <label style={{ marginTop: 6 }}>Gambar latar (opsional)
          <PickBox text={th.image ? 'Ganti gambar latar' : 'Pilih gambar latar'} accept="image/*" onFile={(file) => pickImg(file)} />
        </label>
        {th.image && (
          <div className="row" style={{ marginTop: 6 }}>
            <label>Kekuatan gambar ({th.imgOpacity ?? 100}%) <span className="muted">kecil = lebih transparan</span><input type="range" min={10} max={100} value={th.imgOpacity ?? 100} onChange={(e) => setTh({ imgOpacity: +e.target.value })} /></label>
            <label>Gelapkan gambar ({th.dim ?? 35}%)<input type="range" min={0} max={90} value={th.dim ?? 35} onChange={(e) => setTh({ dim: +e.target.value })} /></label>
            <label>Pelindung teks ({th.scrim ?? 0}%) <span className="muted">bayangan di belakang judul</span><input type="range" min={0} max={90} value={th.scrim ?? 0} onChange={(e) => setTh({ scrim: +e.target.value })} /></label>
            <button type="button" className="auto sec sm" onClick={() => setTh({ image: undefined })}>Hapus gambar latar</button>
          </div>
        )}
      </div>
      </Fold>
      <Fold id="logo" title="Logo di banner" hint={[logos.client ? (value.client.show ? 'klien tampil' : 'klien disembunyikan') : 'klien belum ada', logos.contractor ? (value.contractor.show ? 'kontraktor tampil' : 'kontraktor disembunyikan') : 'kontraktor belum ada'].join(' · ')}>
      {one('client', 'klien / owner')}
      {one('contractor', 'kontraktor')}
      </Fold>
    </div>
  )
}
