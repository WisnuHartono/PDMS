import QRCode from 'qrcode'
import { useEffect, useState } from 'react'
import { MENU } from '../App'
import { BIDANG } from '../administrasi'
import {
  KEBIJAKAN_DEFAULT, SEMUA_HALAMAN, aktifkan2fa, buatAkun, buatKodePemulihanBaru, daftarAkun, daftarAudit, daftarPeran, gantiSandi, hapusAkun, hapusPeran,
  kebijakan, nonaktifkan2fa, resetAkun, sandiAcak, simpanKebijakan, simpanPeran, ubahAkun, type Akun as TAkun, type Audit, type Kebijakan, type Peran,
} from '../security/akun'
import { otpauthUri, totpSecretBaru } from '../security/crypto'
import { getSesi, useSesi } from '../security/sesi'
import { useCol } from '../store'
import { Btn, Card, Empty, Field, Modal, PageHead, Tabs, toast } from '../ui'
import { namaPegawai } from '../util'
import { SandiInput } from './Login'

const label = (h: string) => (h === 'akun' ? 'Akun & Keamanan' : MENU.find((m) => m.id === h)?.label ?? h)
const waktu = (s?: string) => (s ? new Date(s).toLocaleString('id-ID', { dateStyle: 'medium', timeStyle: 'short' }) : '-')

function useData<T>(f: () => Promise<T>, init: T): [T, () => void] {
  const [v, setV] = useState<T>(init)
  const [n, setN] = useState(0)
  useEffect(() => { f().then(setV) }, [n]) // eslint-disable-line react-hooks/exhaustive-deps
  return [v, () => setN((x) => x + 1)]
}

const coba = async (f: () => Promise<unknown>, ok?: string) => {
  try { await f(); if (ok) toast(ok); return true } catch (e) { toast((e as Error).message); return false }
}

export default function AkunPage() {
  const [tab, setTab] = useState<'akun' | 'peran' | 'kebijakan' | 'log'>('akun')
  return (
    <div>
      <PageHead title="Akun & Keamanan" sub="Kelola akun pengguna, jenis akun dan hak aksesnya, kebijakan keamanan, serta log aktivitas" />
      <Tabs tabs={[['akun', 'Akun Pengguna'], ['peran', 'Jenis Akun & Hak Akses'], ['kebijakan', 'Kebijakan Keamanan'], ['log', 'Log Aktivitas']]} value={tab} onChange={setTab} />
      {tab === 'akun' && <DaftarAkun />}
      {tab === 'peran' && <DaftarPeran />}
      {tab === 'kebijakan' && <KebijakanForm />}
      {tab === 'log' && <Log />}
    </div>
  )
}

function DaftarAkun() {
  const sesi = useSesi()!
  const [akun, muat] = useData(daftarAkun, [] as TAkun[])
  const [peran] = useData(daftarPeran, [] as Peran[])
  const pegawai = useCol('pegawai')
  const [baru, setBaru] = useState(false)
  const [reset, setReset] = useState<TAkun | null>(null)
  const namaPeran = (id: string) => peran.find((p) => p.id === id)?.nama ?? id
  return (
    <Card title={`${akun.length} akun`} actions={<Btn icon="plus" kind="primary" onClick={() => setBaru(true)}>Tambah Akun</Btn>}>
      <div className="table-wrap"><table className="tbl">
        <thead><tr><th>Nama</th><th>Nama pengguna</th><th>Jenis akun</th><th>Terhubung ke</th><th className="c">2 langkah</th><th>Status</th><th>Login terakhir</th><th></th></tr></thead>
        <tbody>{akun.sort((a, b) => a.nama.localeCompare(b.nama)).map((a) => {
          const terkunci = a.kunciSampai && a.kunciSampai > Date.now()
          return (
            <tr key={a.id}>
              <td><b>{a.nama}</b>{a.id === sesi.akun.id && <span className="pill info" style={{ marginLeft: 6 }}>Anda</span>}</td>
              <td>{a.username}</td>
              <td>
                <select value={a.peranId} disabled={a.id === sesi.akun.id} onChange={(e) => coba(() => ubahAkun(sesi, a, { peranId: e.target.value }), 'Jenis akun diubah').then(muat)} aria-label={`Jenis akun ${a.username}`}>
                  {peran.map((p) => <option key={p.id} value={p.id}>{p.nama}</option>)}
                </select>
              </td>
              <td className="small">{namaPegawai(pegawai.find((p) => p.id === a.pegawaiId)) || '-'}</td>
              <td className="c">{a.totpEnc ? <span className="pill ok">Aktif</span> : <span className="pill warn">Belum</span>}</td>
              <td>{!a.aktif ? <span className="pill">Nonaktif</span> : terkunci ? <span className="pill bad">Terkunci</span> : a.wajibGantiSandi ? <span className="pill warn">Sandi sementara</span> : <span className="pill ok">Aktif</span>}</td>
              <td className="small">{waktu(a.loginTerakhir)}</td>
              <td className="row-actions">
                <Btn kind="ghost" onClick={() => setReset(a)}>Atur ulang</Btn>
                {a.id !== sesi.akun.id && <Btn kind="ghost" onClick={() => coba(() => ubahAkun(sesi, a, { aktif: !a.aktif }), a.aktif ? 'Akun dinonaktifkan' : 'Akun diaktifkan').then(muat)}>{a.aktif ? 'Nonaktifkan' : 'Aktifkan'}</Btn>}
                {a.id !== sesi.akun.id && <Btn icon="trash" kind="ghost" title="Hapus akun" onClick={() => confirm(`Hapus akun ${a.username}?`) && coba(() => hapusAkun(sesi, a), 'Akun dihapus').then(muat)} />}
              </td>
            </tr>
          )
        })}</tbody>
      </table></div>
      <p className="muted small">Setiap akun baru memakai kata sandi sementara dan wajib menggantinya saat pertama masuk. Peran <i>{namaPeran('admin')}</i> minimal harus ada satu yang aktif.</p>
      {baru && <AkunBaru peran={peran} onClose={() => { setBaru(false); muat() }} />}
      {reset && <ResetAkun a={reset} onClose={() => { setReset(null); muat() }} />}
    </Card>
  )
}

function AkunBaru({ peran, onClose }: { peran: Peran[]; onClose: () => void }) {
  const sesi = getSesi()!
  const pegawai = useCol('pegawai').filter((p) => p.aktif)
  const [f, setF] = useState({ nama: '', username: '', email: '', peranId: 'guru', pegawaiId: '', sandiSementara: sandiAcak() })
  const set = (p: Partial<typeof f>) => setF((o) => ({ ...o, ...p }))
  const pilihPegawai = (id: string) => {
    const p = pegawai.find((x) => x.id === id)
    set({ pegawaiId: id, ...(p && !f.nama ? { nama: namaPegawai(p), email: p.email ?? '', username: p.nama.toLowerCase().split(/\s+/).slice(0, 2).join('.').replace(/[^a-z0-9.]/g, '') } : {}) })
  }
  return (
    <Modal title="Tambah Akun" onClose={onClose} footer={<><Btn onClick={onClose}>Batal</Btn><Btn kind="primary" onClick={() => coba(() => buatAkun(sesi, { ...f, pegawaiId: f.pegawaiId || undefined }), `Akun ${f.username} dibuat`).then((ok) => ok && onClose())}>Buat akun</Btn></>}>
      <div className="form-grid">
        <Field label="Hubungkan ke guru/pegawai (opsional)" span={4}>
          <select value={f.pegawaiId} onChange={(e) => pilihPegawai(e.target.value)}><option value="">-</option>{pegawai.map((p) => <option key={p.id} value={p.id}>{namaPegawai(p)} · {p.jabatan}</option>)}</select>
        </Field>
        <Field label="Nama lengkap" span={2}><input value={f.nama} onChange={(e) => set({ nama: e.target.value })} /></Field>
        <Field label="Nama pengguna" span={2} hint="huruf kecil, angka, titik"><input value={f.username} onChange={(e) => set({ username: e.target.value.toLowerCase() })} autoComplete="off" /></Field>
        <Field label="Email (opsional)" span={2}><input type="email" value={f.email} onChange={(e) => set({ email: e.target.value })} /></Field>
        <Field label="Jenis akun" span={2}><select value={f.peranId} onChange={(e) => set({ peranId: e.target.value })}>{peran.map((p) => <option key={p.id} value={p.id}>{p.nama}</option>)}</select></Field>
        <Field label="Kata sandi sementara" span={4} hint="Berikan ke pengguna secara langsung. Pengguna wajib menggantinya saat pertama masuk.">
          <div className="pw"><input value={f.sandiSementara} onChange={(e) => set({ sandiSementara: e.target.value })} spellCheck={false} /><Btn kind="ghost" onClick={() => set({ sandiSementara: sandiAcak() })}>Acak</Btn></div>
        </Field>
      </div>
      <p className="muted small">Hak akses: {peran.find((p) => p.id === f.peranId)?.halaman.map(label).join(', ')}</p>
    </Modal>
  )
}

function ResetAkun({ a, onClose }: { a: TAkun; onClose: () => void }) {
  const sesi = getSesi()!
  const [sandi, setSandi] = useState(sandiAcak())
  const [r2fa, setR2fa] = useState(false)
  return (
    <Modal title={`Atur ulang akun ${a.username}`} onClose={onClose} footer={<><Btn onClick={onClose}>Batal</Btn><Btn kind="primary" onClick={() => coba(() => resetAkun(sesi, a, sandi, r2fa), 'Akun diatur ulang').then((ok) => ok && onClose())}>Atur ulang</Btn></>}>
      <p className="small">Membuka kunci akun dan menetapkan kata sandi sementara. Pengguna wajib menggantinya saat masuk.</p>
      <Field label="Kata sandi sementara"><div className="pw"><input value={sandi} onChange={(e) => setSandi(e.target.value)} spellCheck={false} /><Btn kind="ghost" onClick={() => setSandi(sandiAcak())}>Acak</Btn></div></Field>
      {a.totpEnc && <label className="chk"><input type="checkbox" checked={r2fa} onChange={(e) => setR2fa(e.target.checked)} /> Matikan juga verifikasi 2 langkah (mis. ponsel pengguna hilang)</label>}
    </Modal>
  )
}

function DaftarPeran() {
  const [peran, muat] = useData(daftarPeran, [] as Peran[])
  const [edit, setEdit] = useState<Peran | null>(null)
  return (
    <Card title="Jenis akun" actions={<Btn icon="plus" kind="primary" onClick={() => setEdit({ id: `p-${Date.now().toString(36)}`, nama: '', ket: '', halaman: ['dashboard'] })}>Tambah Jenis Akun</Btn>}>
      <div className="table-wrap"><table className="tbl">
        <thead><tr><th>Jenis akun</th><th>Keterangan</th><th>Menu yang dapat dibuka</th><th className="c">Wajib 2 langkah</th><th></th></tr></thead>
        <tbody>{peran.map((p) => (
          <tr key={p.id}>
            <td><b>{p.nama}</b>{p.bawaan && <span className="pill">bawaan</span>}</td><td className="small">{p.ket}</td>
            <td className="small">{p.halaman.map(label).join(', ')}</td>
            <td className="c">{p.wajib2fa ? <span className="pill ok">Ya</span> : '-'}</td>
            <td className="row-actions">
              {p.id !== 'admin' && <Btn icon="edit" kind="ghost" onClick={() => setEdit(p)}>Ubah</Btn>}
              {!p.bawaan && <Btn icon="trash" kind="ghost" onClick={() => coba(() => hapusPeran(p.id), 'Jenis akun dihapus').then(muat)} />}
            </td>
          </tr>
        ))}</tbody>
      </table></div>
      {edit && <PeranForm initial={edit} onClose={() => { setEdit(null); muat() }} />}
    </Card>
  )
}

function PeranForm({ initial, onClose }: { initial: Peran; onClose: () => void }) {
  const [p, setP] = useState(initial)
  const toggle = (h: (typeof SEMUA_HALAMAN)[number]) => setP((o) => ({ ...o, halaman: o.halaman.includes(h) ? o.halaman.filter((x) => x !== h) : [...o.halaman, h] }))
  return (
    <Modal title={initial.nama ? `Jenis akun: ${initial.nama}` : 'Jenis Akun Baru'} onClose={onClose} footer={<><Btn onClick={onClose}>Batal</Btn><Btn kind="primary" onClick={() => p.nama.trim() ? coba(() => simpanPeran(p), 'Jenis akun disimpan').then((ok) => ok && onClose()) : toast('Nama wajib diisi')}>Simpan</Btn></>}>
      <div className="form-grid">
        <Field label="Nama jenis akun" span={2}><input value={p.nama} disabled={p.bawaan} onChange={(e) => setP({ ...p, nama: e.target.value })} placeholder="mis. Bendahara, Guru BK, Pustakawan" /></Field>
        <Field label="Keterangan" span={2}><input value={p.ket} onChange={(e) => setP({ ...p, ket: e.target.value })} /></Field>
      </div>
      <h4 className="sec">Menu yang dapat dibuka</h4>
      <div className="chips">
        {SEMUA_HALAMAN.filter((h) => h !== 'akun').map((h) => <label key={h} className={`chip ${p.halaman.includes(h) ? 'on' : ''}`}><input type="checkbox" checked={p.halaman.includes(h)} onChange={() => toggle(h)} />{label(h)}</label>)}
      </div>
      {p.halaman.includes('administrasi') && (
        <>
          <h4 className="sec">Bidang administrasi (tidak ada yang dicentang = semua bidang)</h4>
          <div className="chips">
            {BIDANG.map((b) => {
              const on = !!p.bidang?.includes(b.id)
              return <label key={b.id} className={`chip ${on ? 'on' : ''}`}><input type="checkbox" checked={on} onChange={() => setP((o) => ({ ...o, bidang: on ? o.bidang?.filter((x) => x !== b.id) : [...(o.bidang ?? []), b.id] }))} />{b.no} {b.nama.replace('Administrasi ', '')}</label>
            })}
          </div>
        </>
      )}
      <label className="chk" style={{ marginTop: 10 }}><input type="checkbox" checked={!!p.wajib2fa} onChange={(e) => setP({ ...p, wajib2fa: e.target.checked })} /> Wajib memakai verifikasi 2 langkah</label>
      <p className="muted small">Menu Akun & Keamanan hanya untuk Administrator.</p>
    </Modal>
  )
}

function KebijakanForm() {
  const sesi = useSesi()!
  const [k, setK] = useState<Kebijakan>(KEBIJAKAN_DEFAULT)
  const [kode, setKode] = useState('')
  const [siap, setSiap] = useState(false)
  useEffect(() => { kebijakan().then(setK) }, [])
  const num = (key: keyof Kebijakan, v: string) => setK({ ...k, [key]: Math.max(0, Number(v) || 0) })
  return (
    <div className="grid-2">
      <Card title="Kebijakan keamanan">
        <div className="form-grid">
          <Field label="Panjang minimal kata sandi" span={2}><input type="number" min={12} value={k.panjangMin} onChange={(e) => num('panjangMin', e.target.value)} /></Field>
          <Field label="Masa berlaku kata sandi (hari, 0 = tidak kedaluwarsa)" span={2}><input type="number" min={0} value={k.masaBerlakuHari} onChange={(e) => num('masaBerlakuHari', e.target.value)} /></Field>
          <Field label="Batas salah kata sandi sebelum dikunci" span={2}><input type="number" min={3} value={k.maksGagal} onChange={(e) => num('maksGagal', e.target.value)} /></Field>
          <Field label="Lama akun dikunci (menit)" span={2}><input type="number" min={1} value={k.kunciMenit} onChange={(e) => num('kunciMenit', e.target.value)} /></Field>
          <Field label="Keluar otomatis bila tidak aktif (menit)" span={2}><input type="number" min={1} value={k.idleMenit} onChange={(e) => num('idleMenit', e.target.value)} /></Field>
        </div>
        <Btn kind="primary" onClick={() => coba(() => simpanKebijakan({ ...k, panjangMin: Math.max(12, k.panjangMin), maksGagal: Math.max(3, k.maksGagal) }), 'Kebijakan disimpan')}>Simpan kebijakan</Btn>
        <p className="muted small">Panjang minimal tidak bisa di bawah 12 karakter dan batas percobaan tidak bisa di bawah 3, sesuai rekomendasi NIST SP 800-63B.</p>
      </Card>
      <Card title="Perlindungan yang aktif">
        <ul className="kur-list small">
          <li><b>Hash kata sandi Argon2id</b> (memori 64 MiB, 3 iterasi) dengan salt acak per akun; hash lama ditingkatkan otomatis saat login.</li>
          <li><b>Enkripsi data AES-256-GCM</b> untuk seluruh data sekolah di perangkat; kunci data hanya terbuka setelah login.</li>
          <li><b>Verifikasi 2 langkah TOTP</b> (RFC 6238) dengan perlindungan pemakaian ulang kode.</li>
          <li><b>Penguncian akun</b> setelah percobaan gagal, pesan galat yang tidak membocorkan keberadaan akun.</li>
          <li><b>Keluar otomatis</b> saat tidak aktif; kunci data dihapus dari memori.</li>
          <li><b>Log aktivitas</b> login, perubahan akun, dan kebijakan.</li>
          <li><b>Cadangan terenkripsi</b> dengan kata sandi terpisah.</li>
        </ul>
      </Card>
      <Card title="Kode pemulihan Administrator">
        <p className="small">Buat kode baru bila kode lama hilang atau mungkin diketahui orang lain. Kode lama langsung tidak berlaku.</p>
        {kode ? <><div className="kode-pemulihan">{kode}</div><p className="small">Simpan kode ini di tempat aman. Kode tidak akan ditampilkan lagi.</p></>
          : <Btn kind={siap ? 'danger' : 'default'} onClick={async () => { if (!siap) return setSiap(true); setSiap(false); await coba(async () => setKode(await buatKodePemulihanBaru(sesi))) }}>{siap ? 'Klik lagi untuk membuat kode baru' : 'Buat kode pemulihan baru'}</Btn>}
      </Card>
    </div>
  )
}

function Log() {
  const [log, muat] = useData(daftarAudit, [] as Audit[])
  const [q, setQ] = useState('')
  const list = log.filter((l) => !q || `${l.username} ${l.aksi} ${l.detail ?? ''}`.toLowerCase().includes(q.toLowerCase())).slice(0, 500)
  return (
    <Card title="Log aktivitas" onRefresh={muat} actions={<input placeholder="Cari pengguna / aktivitas" value={q} onChange={(e) => setQ(e.target.value)} />}>
      {!list.length ? <Empty>Belum ada aktivitas.</Empty> : (
        <div className="table-wrap"><table className="tbl">
          <thead><tr><th>Waktu</th><th>Pengguna</th><th>Aktivitas</th><th>Keterangan</th><th>Hasil</th></tr></thead>
          <tbody>{list.map((l) => <tr key={l.id}><td className="nowrap small">{waktu(l.waktu)}</td><td>{l.username}</td><td>{l.aksi}</td><td className="small">{l.detail}</td><td><span className={`pill ${l.ok ? 'ok' : 'bad'}`}>{l.ok ? 'Berhasil' : 'Gagal'}</span></td></tr>)}</tbody>
        </table></div>
      )}
    </Card>
  )
}

/** Profil & keamanan akun sendiri: ganti kata sandi, verifikasi 2 langkah. Terbuka untuk semua akun. */
export function ProfilSaya({ onClose }: { onClose: () => void }) {
  const sesi = useSesi()!
  const [lama, setLama] = useState('')
  const [baru, setBaru] = useState('')
  const [baru2, setBaru2] = useState('')
  const [secret, setSecret] = useState('')
  const [qr, setQr] = useState('')
  const [kode, setKode] = useState('')
  const [sandi2fa, setSandi2fa] = useState('')
  const [, setN] = useState(0)
  const mulai2fa = async () => {
    const s = totpSecretBaru()
    setSecret(s)
    setQr(await QRCode.toDataURL(otpauthUri(s, sesi.akun.username), { margin: 1, width: 180 }))
  }
  return (
    <Modal title="Profil & Keamanan Akun" onClose={onClose} wide>
      <div className="grid-2">
        <div>
          <h4 className="sec">Akun</h4>
          <table className="mini"><tbody>
            <tr><td>Nama</td><td><b>{sesi.akun.nama}</b></td></tr>
            <tr><td>Nama pengguna</td><td>{sesi.akun.username}</td></tr>
            <tr><td>Jenis akun</td><td>{sesi.peran.nama}</td></tr>
            <tr><td>Kata sandi diubah</td><td>{waktu(sesi.akun.sandiDiubah)}</td></tr>
            <tr><td>Login terakhir</td><td>{waktu(sesi.akun.loginTerakhir)}</td></tr>
          </tbody></table>
          <h4 className="sec">Ganti kata sandi</h4>
          <SandiInput id="sl" label="Kata sandi saat ini" value={lama} onChange={setLama} />
          <SandiInput id="sb" label="Kata sandi baru" value={baru} onChange={setBaru} autoComplete="new-password" meter username={sesi.akun.username} />
          <SandiInput id="sb2" label="Ulangi kata sandi baru" value={baru2} onChange={setBaru2} autoComplete="new-password" />
          <Btn kind="primary" onClick={() => baru !== baru2 ? toast('Konfirmasi kata sandi tidak sama') : coba(() => gantiSandi(sesi, lama, baru), 'Kata sandi diganti').then((ok) => ok && (setLama(''), setBaru(''), setBaru2('')))}>Simpan kata sandi</Btn>
        </div>
        <div>
          <h4 className="sec">Verifikasi 2 langkah (TOTP)</h4>
          {sesi.akun.totpEnc ? (
            <>
              <p className="small"><span className="pill ok">Aktif</span> Setiap login meminta kode 6 digit dari aplikasi autentikator.</p>
              <SandiInput id="s2" label="Kata sandi (untuk mematikan)" value={sandi2fa} onChange={setSandi2fa} />
              <Btn kind="danger" onClick={() => coba(() => nonaktifkan2fa(sesi, sandi2fa), 'Verifikasi 2 langkah dimatikan').then(() => { setSandi2fa(''); setN((x) => x + 1) })}>Matikan verifikasi 2 langkah</Btn>
            </>
          ) : secret ? (
            <>
              <ol className="small steps">
                <li>Buka Google Authenticator, Microsoft Authenticator, atau aplikasi sejenis.</li>
                <li>Pindai kode QR berikut, atau masukkan kunci manual.</li>
                <li>Ketik 6 digit kode yang muncul.</li>
              </ol>
              {qr && <img src={qr} alt="Kode QR verifikasi 2 langkah" className="qr" />}
              <p className="small">Kunci manual: <code className="sel">{secret.match(/.{1,4}/g)?.join(' ')}</code></p>
              <div className="filters">
                <input className="otp small-otp" inputMode="numeric" maxLength={6} value={kode} onChange={(e) => setKode(e.target.value.replace(/\D/g, ''))} aria-label="Kode verifikasi" placeholder="123456" />
                <Btn kind="primary" disabled={kode.length !== 6} onClick={() => coba(() => aktifkan2fa(sesi, secret, kode), 'Verifikasi 2 langkah aktif').then((ok) => ok && (setSecret(''), setKode(''), setN((x) => x + 1)))}>Aktifkan</Btn>
              </div>
            </>
          ) : (
            <>
              <p className="small"><span className="pill warn">Belum aktif</span>{sesi.peran.wajib2fa && <b> Jenis akun Anda wajib memakai verifikasi 2 langkah.</b>} Lindungi akun walaupun kata sandi diketahui orang lain.</p>
              <Btn kind="primary" onClick={mulai2fa}>Aktifkan verifikasi 2 langkah</Btn>
            </>
          )}
        </div>
      </div>
    </Modal>
  )
}
