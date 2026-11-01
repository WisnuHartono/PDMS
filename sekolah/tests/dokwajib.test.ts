import { describe, expect, it } from 'vitest'
import { BIDANG, DOKDEF_REGISTER, dokDefId, dokumenBidang, ringkasBidang } from '../src/administrasi'
import type { Arsip } from '../src/types'

const A = (id: string, data: Arsip['data']): Arsip => ({ id, register: DOKDEF_REGISTER, data, dibuat: '' })
describe('dokumen wajib kustom', () => {
  const b = BIDANG.find((x) => x.id === 'umum')!
  const asli = dokumenBidang(b, [])
  it('menambah dokumen', () => {
    const l = dokumenBidang(b, [A(dokDefId('x-1'), { bidang: b.id, nama: 'SK Tim BOS', berlaku: 'Ya' })])
    expect(l.length).toBe(asli.length + 1)
    expect(l.at(-1)).toMatchObject({ nama: 'SK Tim BOS', berlaku: true, kustom: true })
    expect(ringkasBidang(b, [A(dokDefId('x-1'), { bidang: b.id, nama: 'X' })]).dokumen).toBe(asli.length + 1)
  })
  it('mengubah dan menyembunyikan dokumen bawaan', () => {
    const id = asli[0].id
    expect(dokumenBidang(b, [A(dokDefId(id), { nama: 'Baru', ket: 'k' })])[0].nama).toBe('Baru')
    expect(dokumenBidang(b, [A(dokDefId(id), { sembunyi: 'Ya' })]).length).toBe(asli.length - 1)
  })
})
