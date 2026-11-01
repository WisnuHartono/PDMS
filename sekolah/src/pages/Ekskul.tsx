import { useState } from 'react'
import { put, remove, useCol } from '../store'
import { Btn, Card, Empty, PageHead } from '../ui'
import { namaPegawai, uid } from '../util'

export default function EkskulPage() {
  const ekskul = useCol('ekskul')
  const pegawai = useCol('pegawai')
  const [nama, setNama] = useState('')
  const tambah = async () => {
    if (!nama.trim()) return
    await put('ekskul', { id: uid(), nama: nama.trim() })
    setNama('')
  }
  return (
    <div>
      <PageHead title="Ekstrakurikuler" sub="Daftar kegiatan ekstrakurikuler yang muncul di rapor" />
      <Card title={`${ekskul.length} kegiatan`}>
        <div className="filters">
          <input placeholder="Nama ekstrakurikuler baru" value={nama} onChange={(e) => setNama(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && tambah()} />
          <Btn icon="plus" kind="primary" onClick={tambah}>Tambah</Btn>
        </div>
        {!ekskul.length ? <Empty>Belum ada ekstrakurikuler.</Empty> : (
          <table className="tbl">
            <thead><tr><th>Nama</th><th>Pembina</th><th></th></tr></thead>
            <tbody>
              {ekskul.map((e) => (
                <tr key={e.id}>
                  <td><input value={e.nama} onChange={(x) => put('ekskul', { ...e, nama: x.target.value })} /></td>
                  <td>
                    <select value={e.pembinaId ?? ''} onChange={(x) => put('ekskul', { ...e, pembinaId: x.target.value || undefined })}>
                      <option value="">-</option>
                      {pegawai.filter((p) => p.aktif).map((p) => <option key={p.id} value={p.id}>{namaPegawai(p)}</option>)}
                    </select>
                  </td>
                  <td className="row-actions"><Btn icon="trash" kind="ghost" title="Hapus" onClick={() => remove('ekskul', e.id)} /></td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </Card>
    </div>
  )
}
