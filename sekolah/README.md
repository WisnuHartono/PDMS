# SIMAS — Sistem Informasi Manajemen Administrasi Sekolah

Aplikasi administrasi sekolah untuk **PAUD, TK, SD, SMP, SMA/SMK** yang berjalan sebagai **aplikasi web** dan
**aplikasi Windows (.exe)** dari satu kode sumber.

## Fitur (MVP v0.1)

| Modul | Isi |
| --- | --- |
| Dashboard | Kartu widget yang bisa ditampilkan/disembunyikan: ringkasan sekolah, kehadiran siswa hari ini, tren kehadiran, kehadiran per kelas, kehadiran guru & pegawai, siswa per jenjang, kelengkapan nilai, ulang tahun |
| Peserta Didik | Identitas lengkap, orang tua/wali, riwayat masuk, mutasi/lulus, foto, impor & ekspor CSV |
| Guru & Pegawai | Guru, tenaga kependidikan, pegawai yayasan; NIP/NUPTK, status kepegawaian, mapel yang diampu |
| Buku Induk | Register buku induk (termasuk alumni & mutasi) dan lembar buku induk per siswa, siap cetak |
| Kelas / Rombel | Rombel per tahun ajaran, wali kelas, kurikulum per rombel, anggota kelas, kenaikan kelas otomatis |
| Mata Pelajaran & Ekskul | Mapel per jenjang dengan KKM/KKTP, elemen CP PAUD, daftar ekstrakurikuler |
| Absensi | Input harian siswa (H/S/I/A/T) per rombel dan guru/pegawai (termasuk jam masuk/pulang, cuti, dinas luar); rekap bulanan, cetak & CSV |
| Penilaian | Berbasis definisi kurikulum: **Kurikulum Merdeka** (sumatif per TP + SAS, deskripsi capaian otomatis), **K13** (pengetahuan, keterampilan, predikat A–D), **Merdeka PAUD** (capaian BB/MB/BSH/BSB + narasi), dan contoh **kurikulum internasional** (skala A*–U) |
| Rapor | Cetak rapor per siswa atau satu kelas sekaligus; ketidakhadiran otomatis dari absensi; catatan wali kelas, sikap/kokurikuler, ekskul, keputusan kenaikan |
| Prasarana (Sarpras) | Data tanah, bangunan, ruang sesuai isian Dapodik; validasi ketentuan pengisian; klasifikasi kerusakan otomatis; pengajuan penambahan/perbaikan/penghapusan dengan matriks dokumen wajib (PDF ≤ 2 MB), daftar periksa, status verifikasi, pembatasan pengajuan aktif, Tarik Data, dan lembar pemeriksaan cetak. Mengacu *Panduan Pengajuan Data Prasarana pada Dapodik versi 2027* |
| Pengaturan | Profil sekolah/yayasan & logo (kop surat), tahun ajaran & semester aktif, cadangan/pulihkan data (JSON), data contoh |

## Keamanan akun (v0.2)

| Lapisan | Implementasi |
| --- | --- |
| Kata sandi | Argon2id (m=64 MiB, t=3, p=1), cadangan PBKDF2-SHA-256 600.000 iterasi; kebijakan min. 12 karakter, 3 dari 4 jenis karakter |
| Data di perangkat | AES-256-GCM per dokumen (AAD `koleksi|id`), kunci data (DEK) acak dibungkus per akun dengan kunci turunan kata sandi |
| Verifikasi 2 langkah | TOTP RFC 6238 (Google/Microsoft Authenticator), anti-replay, dapat diwajibkan per jenis akun |
| Proteksi login | Kunci akun setelah 5 gagal (15 menit), logout otomatis saat idle, log aktivitas |
| Pemulihan | Kode pemulihan 25 karakter yang juga membungkus DEK |
| Cadangan | Berkas cadangan terenkripsi dengan kata sandi cadangan (Argon2id + AES-GCM) |

Jenis akun bawaan: Administrator, Kepala Sekolah, Operator, Wali Kelas, Guru, Sarpras. Jenis akun baru bisa dibuat dengan hak akses per menu.

## Arsitektur

```
sekolah/
├─ src/
│  ├─ types.ts        Model data (Siswa, Pegawai, Rombel, Mapel, Absensi, LembarNilai, CatatanRapor, …)
│  ├─ db.ts           Interface Backend + adaptor IndexedDB (lokal)
│  ├─ store.ts        State di memori + hook React; cadangan/pulihkan
│  ├─ curricula.ts    Definisi kurikulum (komponen nilai, rumus, kolom rapor) — titik perluasan kurikulum
│  ├─ rapor.tsx       Penyusunan & dokumen cetak rapor
│  ├─ print.tsx       Kop surat, tanda tangan, rekap absensi bulanan
│  ├─ App.tsx         Kerangka: top bar, sidebar ikon, tab halaman
│  └─ pages/          Halaman per modul
├─ electron/main.cjs  Pembungkus desktop (Windows .exe)
└─ tests/             Uji unit (vitest)
```

- **Frontend:** React 18 + TypeScript + Vite, tanpa pustaka UI eksternal (ikon & grafik SVG sendiri).
- **Penyimpanan:** IndexedDB di perangkat (browser atau aplikasi Windows) sehingga bisa dipakai **offline**.
  Semua akses data lewat interface `Backend`, sehingga tahap berikutnya dapat menambah adaptor server
  (mis. REST API + PostgreSQL) untuk pemakaian **multi-pengguna** tanpa mengubah halaman.
- **Desktop:** Electron memuat hasil build lewat protokol `app://` (data tersimpan di profil aplikasi).
- **Kurikulum:** setiap kurikulum adalah objek `Kurikulum` (komponen nilai, rumus nilai akhir/predikat/deskripsi,
  kolom rapor, isian non-mapel, judul rapor). Menambah kurikulum luar negeri (Cambridge, IB, dll.) cukup dengan
  menambah satu definisi di `src/curricula.ts`, lalu memilihnya pada rombel.

## Menjalankan

```bash
cd sekolah
npm install
npm run dev          # mode pengembangan web: http://localhost:5173
npm test             # uji unit
npm run build        # build web statis ke dist/ (bisa di-host di server mana pun)
npm run electron:dev # jalankan sebagai aplikasi desktop
npm run dist:win     # buat installer & portable .exe (jalankan di Windows)
```

File **.exe** juga dibuat otomatis oleh GitHub Actions (workflow *SIMAS Sekolah*, job `windows-exe`) dan bisa
diunduh dari tab **Actions → artifact `simas-windows`**.

## Rencana iterasi berikutnya

1. Login & peran pengguna (admin, operator, wali kelas, guru mapel) dengan hak akses per modul.
2. Server multi-pengguna (REST API + database) dan sinkronisasi dari aplikasi Windows.
3. Impor/ekspor format Dapodik & e-Rapor, impor nilai dari Excel.
4. Absensi QR code / kartu siswa, notifikasi ke orang tua.
5. Modul tambahan: mutasi, kelulusan & SKL, jadwal pelajaran, keuangan/SPP yayasan.
6. Template rapor yang bisa diatur (logo dinas, ukuran F4, bahasa Inggris/bilingual).
