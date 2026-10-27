# DocControl - Kontrol Dokumen Proyek

Aplikasi web (PWA) untuk mencatat, menyimpan, melacak, dan memonitor dokumen proyek dengan status
**IFR / IFA / IFC / IFP / IFI**. Mendukung banyak proyek dalam satu akun Google, disimpan di Google Drive,
dan tetap tersedia offline di komputer maupun smartphone.

## Fitur
- Banyak proyek dalam satu akun (info proyek lengkap: klien, kontraktor, lokasi, PM, jadwal, prefix nomor dokumen)
- Info proyek lengkap: logo klien & kontraktor, nomor/tanggal/nilai kontrak, lampiran kontrak (disimpan ke Drive)
- Pengguna & keamanan: login, peran (Administrator, Document Control, Engineer, Reviewer, Viewer, plus peran buatan sendiri dengan matriks hak akses),
  akses per proyek, profil lengkap + foto, kata sandi PBKDF2-SHA256 600.000 iterasi + salt, kebijakan sandi kuat, pembuat sandi acak,
  kunci akun setelah gagal login, logout otomatis, wajib-ganti sandi, verifikasi 2 langkah (TOTP)
- Penyimpanan berkas terstruktur: setiap file otomatis disimpan ke folder komputer (Chrome/Edge), Google Drive, dan/atau cloud WebDAV
  dengan susunan Proyek / Disiplin / Jenis dokumen (pola dapat diubah), halaman Berkas, kirim ulang, dan unduh ZIP terstruktur
- Dashboard interaktif: banner proyek + progres, KPI dan grafik yang bisa diklik sampai rincian dokumen, tren per hari/pekan/bulan, usia tunggu review, beban PIC, jatuh tempo, pencarian cepat; widget dapat diseret, diubah ukuran, disembunyikan, dan disimpan per pengguna
- Laporan harian / mingguan / bulanan di Dashboard (PDF A4/A3 dan Excel .xlsx): PIC, hari kerja di PIC / di pihak reviewer, status terakhir, deskripsi (IFR/IFA/IFC/IFP/IFI/TQ), sorotan dokumen baru
- Register dokumen: nomor otomatis, disiplin, kategori, pencarian, filter, ekspor CSV
- Revisi (A, B, C... atau 0, 1, 2...) dengan status IFR/IFA/IFC/IFP/IFI, upload file, batas waktu review
- Pencatatan hasil review (Pending / Approved / Approved with comments / Rejected) + komentar
- Tracing: timeline revisi per dokumen, audit trail, log aktivitas
- Transmittal (cetak / simpan PDF)
- Dashboard: dokumen per status, review terlambat, aktivitas terbaru
- Pengaturan: status (kode, nama, warna), disiplin, kategori, skema revisi, batas review default, tema, backup/restore JSON
- Google Drive: data (`docontrol-data.json`) dan file dokumen disimpan di folder `DocControl/<kode proyek>`;
  hanya file buatan aplikasi yang dapat diakses (scope `drive.file`)
- PWA: dapat dipasang (Add to Home Screen) di smartphone / komputer, bekerja offline

## Menjalankan
```bash
npm install
npm run dev        # pengembangan
npm run build      # hasil di dist/
```

## Mengaktifkan Google Drive
1. Buka https://console.cloud.google.com/ dan buat project.
2. APIs & Services > Library > aktifkan **Google Drive API**.
3. OAuth consent screen: isi nama aplikasi, tambahkan email Anda sebagai *Test user*.
4. Credentials > Create credentials > **OAuth client ID** > Web application.
   Tambahkan *Authorized JavaScript origins*: `http://localhost:5173` dan alamat situs Anda (mis. `https://namaanda.github.io`).
5. Salin Client ID, tempel di aplikasi: **Pengaturan > Google OAuth Client ID**, lalu klik **Hubungkan Google Drive**.
   (Opsional: set `VITE_GOOGLE_CLIENT_ID` di file `.env` agar terisi otomatis.)

## Deploy gratis
- **Netlify / Vercel / Cloudflare Pages**: hubungkan repository, build command `npm run build`, publish directory `dist`.
- **GitHub Pages**: jalankan `npm run build` lalu publikasikan isi `dist/`.
Setelah dibuka di HTTPS, di Chrome/Edge pilih *Install app*; di Android/iOS pilih *Add to Home Screen*.

## Catatan
- Sinkronisasi: data terbaru (berdasar waktu ubah) yang dipakai; backup JSON tersedia di Pengaturan.
- Token Google berlaku sekitar 1 jam; bila kedaluwarsa, klik *Sinkronkan sekarang* untuk menyambung ulang.

## Catatan keamanan
Aplikasi ini berjalan sepenuhnya di sisi klien (tanpa server). Login dan hak akses melindungi penggunaan aplikasi, dan kata sandi tidak pernah
disimpan sebagai teks. Namun orang yang menguasai perangkat atau akun Google Drive tempat data disimpan tetap dapat membaca berkas data mentahnya.
Untuk perlindungan penuh: kunci perangkat, aktifkan 2FA akun Google, dan jangan bagikan folder `DocControl` di Drive kepada pihak yang tidak berwenang.
