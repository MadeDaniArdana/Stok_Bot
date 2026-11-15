# UI/UX Design Specification — StockFlow
## Panduan Desain Website dan Pengalaman Telegram

**Versi:** 1.0  
**Tujuan:** Menjadi pedoman bagi UI designer dan frontend developer agar tampilan konsisten, mudah dipahami, dan mendukung alur kerja gudang.

---

## 1. Prinsip Pengalaman Pengguna

1. **Informasi penting terlihat lebih dulu:** stok kritis, stok habis, dan aktivitas terbaru mudah ditemukan.
2. **Bahasa sederhana:** gunakan istilah “Barang Masuk”, “Barang Keluar”, “Stok Tersisa”, bukan istilah teknis yang tidak perlu.
3. **Tindakan aman:** tindakan yang mengubah stok harus menampilkan ringkasan sebelum disimpan.
4. **Status selalu jelas:** pengguna mengetahui apakah data sedang dimuat, berhasil, kosong, atau gagal.
5. **Konsisten:** tombol, warna status, tabel, dan formulir mengikuti pola yang sama.
6. **Responsif:** admin dapat memakai dashboard dari laptop, tablet, atau ponsel.

## 2. Peta Navigasi Website

```text
Login
  └── Dashboard
      ├── Barang
      │   ├── Daftar Barang
      │   ├── Tambah Barang
      │   └── Detail Barang
      ├── Kategori
      ├── Inventori
      │   ├── Barang Masuk
      │   ├── Barang Keluar
      │   └── Riwayat Transaksi
      ├── Permintaan (opsional)
      ├── Laporan
      ├── Pengguna
      ├── Integrasi Telegram
      └── Pengaturan
```

## 3. Struktur Layout Utama

### Desktop
- Sidebar kiri dengan logo StockFlow dan menu utama.
- Header atas berisi judul halaman, breadcrumb bila diperlukan, notifikasi, dan menu akun.
- Area konten dengan lebar fleksibel.
- Sidebar dapat diciutkan.
- Konten tabel tidak boleh melebar tanpa batas; gunakan scroll horizontal hanya bila benar-benar diperlukan.

### Mobile
- Sidebar berubah menjadi drawer/menu navigasi.
- KPI ditampilkan dalam grid satu kolom atau dua kolom sesuai lebar layar.
- Tabel dapat berubah menjadi list/card ringkas atau menyediakan scroll horizontal yang jelas.
- Formulir memakai satu kolom.
- Tombol aksi utama mudah dijangkau.

## 4. Design Tokens

Nilai berikut adalah rekomendasi awal dan dapat disesuaikan dengan brand.

### Warna
| Token | Nilai | Penggunaan |
|---|---|---|
| Primary | `#2563EB` | Tombol utama, link, fokus |
| Primary Dark | `#1D4ED8` | Hover/active |
| Background | `#F8FAFC` | Latar halaman |
| Surface | `#FFFFFF` | Card, tabel, modal |
| Text Primary | `#0F172A` | Judul dan isi utama |
| Text Secondary | `#64748B` | Label dan metadata |
| Border | `#E2E8F0` | Garis pembatas |
| Success | `#16A34A` | Berhasil/stok aman |
| Warning | `#D97706` | Stok rendah/perhatian |
| Danger | `#DC2626` | Stok habis/error |
| Info | `#0284C7` | Informasi |

Jangan hanya mengandalkan warna untuk menyampaikan status. Sertakan teks seperti “Stok rendah” atau ikon dengan label aksesibel.

### Tipografi
- Font yang disarankan: Inter atau font sans-serif sistem.
- H1 halaman: 24–28 px, semibold.
- H2 bagian: 18–20 px, semibold.
- Isi: 14–16 px.
- Label/form helper: 12–14 px.
- Gunakan line-height yang nyaman dan hindari teks terlalu rapat.

### Spacing dan bentuk
- Skala jarak berbasis kelipatan 4 atau 8 px.
- Card radius: 12 px.
- Input/button radius: 8 px.
- Tinggi input/button utama: sekitar 40–44 px.
- Gunakan shadow ringan hanya untuk memisahkan lapisan, bukan dekorasi berlebihan.

## 5. Komponen UI

### Tombol
- Primary: satu aksi utama pada satu area, misalnya “Simpan Barang”.
- Secondary: aksi pendamping, misalnya “Batal”.
- Danger: aksi berisiko, misalnya “Nonaktifkan”.
- Disabled: tampil jelas dan tidak tampak seperti tombol aktif.

### Form
Setiap field memiliki:
- Label yang jelas.
- Placeholder sebagai contoh, bukan pengganti label.
- Helper text jika format perlu dijelaskan.
- Validasi dekat dengan field.
- Error message yang menyebut cara memperbaiki.

### Tabel
- Header kolom jelas.
- Sort hanya pada kolom yang relevan.
- Pagination dan jumlah data.
- Filter dan pencarian di atas tabel.
- Status memakai badge teks.
- Aksi baris ditempatkan konsisten pada kolom terakhir.

### Status stok
- Aman: stok lebih besar dari minimum.
- Rendah: stok sama dengan atau di bawah minimum, tetapi lebih dari nol.
- Habis: stok nol.
- Gunakan label teks dan ikon, tidak hanya warna.

### Feedback sistem
- Toast untuk hasil singkat.
- Inline error untuk masalah field.
- Dialog konfirmasi untuk aksi berisiko.
- Skeleton untuk loading.
- Empty state yang menjelaskan langkah selanjutnya.

## 6. Spesifikasi Halaman

### 6.1 Login — `/login`
**Tujuan:** admin masuk dengan aman.

Elemen:
- Logo/nama StockFlow.
- Judul “Masuk ke StockFlow”.
- Input email.
- Input password dengan opsi tampil/sembunyikan.
- Tombol “Masuk”.
- Pesan error umum tanpa membocorkan apakah email tertentu terdaftar.

### 6.2 Dashboard — `/dashboard`
**Tujuan:** memberi gambaran kondisi persediaan dalam beberapa detik.

Urutan konten:
1. Judul “Dashboard” dan rentang periode.
2. Kartu KPI: jenis barang aktif, barang stok rendah, barang habis, barang masuk/keluar periode ini.
3. Grafik barang masuk dan keluar.
4. Tabel “Stok Perlu Perhatian”.
5. Daftar “Aktivitas Terbaru”.

Catatan UX:
- Hindari menjumlahkan pcs, rim, liter, dan unit seolah-olah satu ukuran yang sama. KPI “Total stok” boleh ditampilkan sebagai angka agregat dengan penjelasan, tetapi lebih baik tampilkan jumlah SKU dan ringkasan per satuan.
- Klik item stok kritis membuka detail barang.
- Data kosong harus menjelaskan bahwa belum ada transaksi.

### 6.3 Daftar Barang — `/products`
Elemen:
- Judul dan tombol “Tambah Barang”.
- Search nama/SKU.
- Filter kategori dan status.
- Tabel: SKU, nama, kategori, stok, satuan, minimum, status, aksi.
- Pagination.

Aksi:
- Detail.
- Edit.
- Nonaktifkan (dengan konfirmasi).

### 6.4 Form Tambah/Edit Barang
Field:
- SKU.
- Nama barang.
- Kategori.
- Satuan dasar.
- Stok minimum.
- Deskripsi (opsional).

Jangan menyediakan pengeditan saldo stok biasa pada form master. Saldo harus diubah lewat Stock In, Stock Out, atau Adjustment agar histori tetap utuh.

### 6.5 Detail Barang
Tampilkan:
- Nama dan SKU.
- Kategori dan satuan.
- Stok saat ini dan minimum.
- Status stok.
- Tombol “Barang Masuk” dan “Barang Keluar” sesuai izin.
- Riwayat movement barang tersebut.

### 6.6 Barang Masuk — `/stock/in`
Field:
- Barang (searchable select).
- Jumlah.
- Tanggal transaksi.
- Sumber/supplier (opsional).
- Catatan (opsional).

Sebelum simpan, tampilkan ringkasan: stok sekarang + jumlah masuk = stok setelah transaksi.

### 6.7 Barang Keluar — `/stock/out`
Field:
- Barang.
- Jumlah.
- Keperluan.
- Penerima/pengguna (admin dapat mencatat atas nama pengguna bila diizinkan).

Sebelum simpan, tampilkan stok tersedia dan perkiraan stok sesudah. Jika jumlah melebihi stok, tombol simpan dinonaktifkan atau server menolak dengan pesan yang jelas. Validasi server tetap wajib.

### 6.8 Riwayat Transaksi — `/stock/history`
Filter:
- Periode tanggal.
- Barang.
- Tipe transaksi.
- Pengguna.
- Sumber (Website/Telegram/System).

Kolom:
- Waktu.
- Barang.
- Aktivitas.
- Jumlah.
- Stok sebelum/sesudah.
- Pelaku.
- Sumber.
- Catatan.

### 6.9 Pengguna — `/users`
- Daftar pengguna.
- Role dan status aktif.
- Status Telegram terhubung/tidak.
- Buat/edit/nonaktifkan akun.
- Aksi menghubungkan ulang Telegram dilakukan dengan proses aman.

### 6.10 Integrasi Telegram — `/telegram`
Tampilkan:
- Status bot (terkonfigurasi/tidak).
- Username bot jika aman untuk ditampilkan.
- Status webhook.
- Waktu update terakhir.
- Jumlah update gagal.
- Petunjuk linking pengguna.
- Jangan pernah menampilkan bot token atau secret webhook.

### 6.11 Laporan — `/reports`
MVP:
- Filter periode.
- Ringkasan barang masuk dan keluar.
- Pemakaian per barang.
- Barang paling sering digunakan.
- Barang kritis.
- Export CSV dapat menjadi P1.

## 7. Alur Interaksi Penting

### Simpan barang masuk
```text
Buka Barang Masuk
  → Pilih barang
  → Isi jumlah dan informasi pendukung
  → Lihat ringkasan perubahan stok
  → Klik Simpan
  → Server validasi dan transaksi database
  → Tampilkan sukses + saldo terbaru
```

### Laporan Telegram
```text
Kirim pesan
  → Bot validasi pengguna
  → Bot membaca barang dan jumlah
  → Jika ambigu: minta klarifikasi
  → Jika jelas: cek stok
  → Catat transaksi
  → Kirim konfirmasi
```

## 8. Microcopy yang Direkomendasikan

| Kondisi | Teks |
|---|---|
| Berhasil stock in | “Barang masuk berhasil dicatat. Stok telah diperbarui.” |
| Berhasil stock out | “Barang keluar berhasil dicatat.” |
| Stok tidak cukup | “Jumlah yang diminta melebihi stok tersedia. Periksa kembali jumlahnya.” |
| Barang tidak ditemukan | “Barang belum ditemukan. Periksa nama atau SKU.” |
| Data kosong | “Belum ada data barang. Tambahkan barang pertama untuk mulai mengelola stok.” |
| Tidak ada riwayat | “Belum ada transaksi pada periode ini.” |
| Error umum | “Terjadi kendala saat menyimpan. Silakan coba lagi. Jika berulang, hubungi admin.” |
| Konfirmasi nonaktif | “Barang ini tidak akan muncul pada transaksi baru. Riwayat sebelumnya tetap tersimpan.” |

## 9. Aksesibilitas dan Responsivitas

- Semua input memiliki label yang terhubung.
- Navigasi dapat digunakan dengan keyboard.
- Fokus keyboard terlihat.
- Kontras teks memenuhi standar WCAG AA sebagai target.
- Status tidak dibedakan melalui warna saja.
- Tombol memiliki nama yang menjelaskan tindakan.
- Tabel memiliki header semantik.
- Grafik dilengkapi ringkasan teks.
- Layout diuji pada lebar ponsel, tablet, dan desktop.

## 10. Prototype dan Validasi

Sebelum implementasi penuh:
1. Buat wireframe Dashboard, Daftar Barang, Form Barang, Stock In, Riwayat, dan Pengguna.
2. Buat prototype klik untuk alur Stock In dan laporan Telegram (simulasi).
3. Uji kepada admin dan minimal beberapa calon pengguna.
4. Minta peserta menyelesaikan tugas tanpa panduan.
5. Catat bagian yang membingungkan, waktu penyelesaian, dan kesalahan.
6. Revisi label, urutan field, dan feedback berdasarkan hasil uji.

## 11. Checklist Handoff ke Developer

- [ ] Semua halaman memiliki desktop dan mobile layout.
- [ ] Komponen form, tabel, badge, dialog, toast, dan navigasi terdokumentasi.
- [ ] Semua state: default, hover, focus, disabled, loading, empty, success, error.
- [ ] Field wajib dan aturan validasi ditentukan.
- [ ] Hak akses per menu/aksi ditentukan.
- [ ] Format tanggal, angka, dan zona waktu ditetapkan.
- [ ] Teks bot konsisten dengan istilah di website.
