// Pembantu pengujian: simpan langsung rekaman akun ke IndexedDB simas-akun (mensimulasikan akun yang sudah mengganti sandi).
import { _simpanAkun } from '../src/security/akun'
import type { Akun } from '../src/security/akun'
export const putAkunUji = (a: Akun) => _simpanAkun(a)
