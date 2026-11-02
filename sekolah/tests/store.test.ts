import 'fake-indexeddb/auto'
import { describe, expect, it } from 'vitest'
import { IndexedDbBackend } from '../src/db'
import { exportJson, getState, importJson, initStore, put, remove } from '../src/store'

describe('store + IndexedDB', () => {
  it('menyimpan, memuat ulang, menghapus, dan memulihkan cadangan', async () => {
    await initStore(new IndexedDbBackend('t1'))
    await put('ekskul', { id: 'e1', nama: 'Pramuka' })
    await put('ekskul', { id: 'e2', nama: 'Futsal' })
    await put('ekskul', { id: 'e1', nama: 'Pramuka Penggalang' })
    // muat ulang dari database
    await initStore(new IndexedDbBackend('t1'))
    expect(getState().ekskul.map((e) => e.nama).sort()).toEqual(['Futsal', 'Pramuka Penggalang'])
    const backup = exportJson()
    await remove('ekskul', 'e2')
    expect(getState().ekskul).toHaveLength(1)
    await importJson(backup)
    await initStore(new IndexedDbBackend('t1'))
    expect(getState().ekskul).toHaveLength(2)
  })
  it('menolak berkas yang bukan cadangan SIMAS', async () => {
    await expect(importJson('{"foo":1}')).rejects.toThrow()
  })
})
