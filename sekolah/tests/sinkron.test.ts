import 'fake-indexeddb/auto'
import { beforeEach, describe, expect, it, vi } from 'vitest'

const mem = new Map<string, string>()
vi.stubGlobal('localStorage', { getItem: (k: string) => mem.get(k) ?? null, setItem: (k: string, v: string) => void mem.set(k, v), removeItem: (k: string) => void mem.delete(k) })

const cloud = { waktu: undefined as string | undefined, isi: '', timpaan: 0 }
vi.mock('../src/cloud', () => ({
  googleTerhubung: () => true,
  cariBerkas: async () => (cloud.waktu ? { id: 'x', nama: 'sinkron-simas.simas.json', waktu: cloud.waktu } : undefined),
  timpa: async (_c: unknown, _n: string, isi: string) => { cloud.isi = isi; cloud.timpaan++; cloud.waktu = new Date(Date.now() + cloud.timpaan * 10000).toISOString() },
  unduh: async () => cloud.isi,
}))

import { IndexedDbBackend } from '../src/db'
import { getState, initStore, put } from '../src/store'
import { sinkronSekarang, ubahStatus } from '../src/sinkron'
import type { CloudSetting, Siswa } from '../src/types'

const C: CloudSetting = { tujuan: 'webdav', sinkron: true, sandiOto: 'kata-sandi-sinkron-1' }
const murid = (id: string, nama: string) => ({ id, nama }) as unknown as Siswa

describe('sinkronisasi otomatis', () => {
  beforeEach(async () => {
    mem.clear(); cloud.waktu = undefined; cloud.isi = ''; cloud.timpaan = 0
    await initStore(new IndexedDbBackend(`sinkron-${Math.random()}`))
    ubahStatus({ fase: 'mati', kotor: 0 })
  })

  it('mengunggah data baru ke cloud lalu tersinkron', async () => {
    await put('siswa', murid('1', 'Budi'))
    mem.set('simas.sync.kotor', '1')
    await sinkronSekarang(C)
    expect(cloud.timpaan).toBe(1)
    expect(cloud.isi).toContain('terenkripsi')
    expect(cloud.isi).not.toContain('Budi')
    expect(mem.has('simas.sync.kotor')).toBe(false)
  })

  it('mengambil data cloud bila perangkat bersih dan cloud lebih baru', async () => {
    await put('siswa', murid('1', 'Budi'))
    mem.set('simas.sync.kotor', '1')
    await sinkronSekarang(C) // unggah
    await put('siswa', murid('2', 'Ani'))
    mem.set('simas.sync.kotor', '1')
    await sinkronSekarang(C) // unggah versi dengan 2 murid
    // perangkat lain mengubah cloud
    cloud.waktu = new Date(Date.now() + 3600e3).toISOString()
    mem.delete('simas.sync.kotor')
    await put('siswa', murid('3', 'lokal'))
    mem.delete('simas.sync.kotor')
    await sinkronSekarang(C)
    expect(getState().siswa.map((s) => s.nama).sort()).toEqual(['Ani', 'Budi'])
  })

  it('tidak menimpa diam-diam bila kedua sisi berubah (bentrok)', async () => {
    await put('siswa', murid('1', 'Budi'))
    mem.set('simas.sync.kotor', '1')
    await sinkronSekarang(C)
    cloud.waktu = new Date(Date.now() + 3600e3).toISOString()
    await put('siswa', murid('2', 'Baru'))
    mem.set('simas.sync.kotor', '1')
    const sebelum = cloud.timpaan
    await sinkronSekarang(C)
    expect(cloud.timpaan).toBe(sebelum)
    expect(getState().siswa.length).toBe(2)
  })

  it('tidak berjalan tanpa kata sandi yang cukup', async () => {
    await sinkronSekarang({ ...C, sandiOto: 'pendek' })
    expect(cloud.timpaan).toBe(0)
  })
})
