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

import { BIDANG_REGISTER, bidangDefId, bidangEfektif, dokumenJatuhTempo } from '../src/administrasi'
describe('bidang kustom', () => {
  const B = (id: string, data: Arsip['data'], dibuat = ''): Arsip => ({ id: bidangDefId(id), register: BIDANG_REGISTER, data, dibuat })
  it('menambah, menyembunyikan, dan menomori bidang', () => {
    const dasar = bidangEfektif([]).length
    const l = bidangEfektif([B('x-1', { nama: 'Humas Khusus', tema: 'cyan' })])
    expect(l.length).toBe(dasar + 1)
    expect(l.at(-1)).toMatchObject({ kustom: true, nama: 'Humas Khusus', no: String(dasar + 1).padStart(2, '0') })
    expect(bidangEfektif([B('anak', { sembunyi: 'Ya' })]).length).toBe(dasar - 1)
    expect(bidangEfektif([B('anak', { sembunyi: 'Ya' })], true).find((b) => b.id === 'anak')?.tersembunyi).toBe(true)
  })
  it('dokumen wajib pada bidang kustom ikut peringatan', () => {
    const arsip: Arsip[] = [B('x-1', { nama: 'X' }),
      { id: dokDefId('x-9'), register: DOKDEF_REGISTER, data: { bidang: 'x-1', nama: 'Izin X', berlaku: 'Ya' }, dibuat: '' },
      { id: 'dok|x-9', register: '_dok', data: { status: 'Ada', berlaku: '2000-01-01' }, dibuat: '' }]
    expect(dokumenJatuhTempo(arsip, 0).map((x) => x.nama)).toContain('Izin X')
  })
})
