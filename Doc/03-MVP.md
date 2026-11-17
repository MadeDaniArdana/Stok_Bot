# MVP Plan - StockFlow
## Rencana Produk Minimum yang Siap Diuji

**Versi:** 1.0  
**Tujuan:** Menentukan versi pertama StockFlow yang benar-benar menyelesaikan masalah inti tanpa membangun fitur berlebihan.

---

## 1. Definisi MVP

MVP (Minimum Viable Product) adalah versi paling kecil yang sudah dapat digunakan untuk menjalankan proses persediaan utama secara nyata dan mendapatkan umpan balik.

Untuk StockFlow, MVP dianggap berhasil jika:
1. Admin dapat mengelola barang.
2. Admin dapat mencatat barang masuk.
3. Pengambilan barang melalui website atau Telegram dapat tercatat.
4. Stok berubah dengan benar dan tidak pernah negatif.
5. Semua perubahan memiliki histori.
6. Admin dapat melihat stok kritis dan aktivitas terbaru.

## 2. Prioritas Fitur

### P0 - Wajib sebelum uji operasional

| Fitur | Hasil yang diharapkan | Pengguna |
|---|---|---|
| Login admin | Area admin terlindungi | Admin |
| Master barang | Barang, SKU otomatis dari kategori, kategori, satuan, stok, minimum stok | Admin |
| Master kategori | Kategori dapat dikelola | Admin |
| Stock in | Stok bertambah dan movement tercatat | Admin |
| Stock out website | Stok berkurang dan movement tercatat | Admin |
| Dashboard | Ringkasan dan daftar stok kritis | Admin |
| Riwayat | Semua transaksi dapat ditelusuri | Admin |
| Pengguna & linking Telegram | Hanya akun berizin dapat memakai bot | Admin/pengguna |
| Telegram webhook | Pesan dan tombol bot diterima dan diproses | Pengguna |
| Tugas pemasangan Telegram | Panduan tombol membuat link foto bukti dan melacak status | Admin |
| Idempotensi | Update yang sama tidak membuat transaksi ganda | Sistem |
| Validasi stok | Stok tidak menjadi negatif | Sistem |
| Log error | Admin/developer dapat menelusuri kegagalan | Sistem |

### P1 - Setelah alur P0 stabil
- Notifikasi Telegram untuk stok minimum.
- Pencarian dan filter lanjutan.
- Bahasa natural dengan konfirmasi.
- Approval untuk kelompok pengguna/barang tertentu.
- Export CSV.
- Grafik tren bulanan.

### P2 - Pengembangan lanjutan
- Multi-gudang.
- Transfer stok.
- Supplier dan purchase order.
- Barcode/QR.
- Export Excel/PDF.
- Analisis pemakaian per departemen.
- Prediksi kebutuhan stok.

## 3. Batasan MVP yang Disarankan

- Satu gudang.
- Satu satuan dasar per barang.
- Admin mengelola barang dan barang masuk.
- Pengguna Telegram harus terdaftar dan diaktifkan admin.
- Menu tombol dan panduan bertahap menjadi jalur utama Telegram.
- Direct issue hanya untuk pengguna yang diberi izin.
- Approval workflow boleh ditunda, tetapi model data sebaiknya sudah menyediakan `StockRequest`.
- Tidak ada penghapusan transaksi permanen.
- Tidak ada stok negatif.

## 4. Alur MVP

### 4.1 Setup awal oleh admin
1. Admin login.
2. Admin membuat kategori.
3. Admin memilih kategori dan membuat master barang; SKU otomatis dibuat berdasarkan kategori.
4. Admin wajib mengisi stok saat membuat barang; stok positif dicatat sebagai movement.
5. Admin membuat akun pengguna.
6. Pengguna menghubungkan akun Telegram.

### 4.2 Barang masuk
1. Admin membuka menu Barang Masuk.
2. Memilih barang.
3. Mengisi kuantitas dan catatan/sumber.
4. Menekan Simpan.
5. Sistem memvalidasi.
6. Database memperbarui saldo dan membuat movement dalam satu transaksi.
7. UI menampilkan saldo terbaru.

### 4.3 Tugas pemasangan melalui Telegram
1. Admin menekan tombol **Buat tugas pemasangan**.
2. Admin memilih barang dan jumlah melalui tombol.
3. Admin mengetik nama pemasang dan lokasi; catatan dapat dilewati.
4. Bot menampilkan ringkasan untuk dikonfirmasi.
5. Setelah dikonfirmasi, bot membuat link foto bukti dan tombol berbagi WhatsApp.
6. Stok berkurang dan movement `OUT` tercatat setelah foto valid diterima.
7. Admin melihat status melalui tombol **Tugas terbaru**.

## 5. Interaksi Bot

Aktivitas rutin menggunakan tombol menu Telegram. `/start` membuka menu dan `/link <email>` hanya diperlukan saat pertama kali menghubungkan akun. Pesan teks lama tetap dapat diproses sebagai jalur kompatibilitas.

## 6. Rencana Sprint

Estimasi berikut adalah rencana awal, bukan janji durasi. Sesuaikan dengan jumlah developer, pengalaman, dan kesiapan infrastruktur.

| Sprint | Fokus | Output |
|---|---|---|
| 0 | Fondasi proyek | Repo, Next.js, TypeScript, database, Prisma, environment |
| 1 | Autentikasi dan master data | Login, role, kategori, produk |
| 2 | Inventori inti | Stock in/out, ledger, validasi stok |
| 3 | Dashboard dan riwayat | KPI, tabel, filter, stok kritis |
| 4 | Telegram | Bot, linking, webhook, menu tombol dan tugas foto |
| 5 | Hardening | Idempotensi, konkurensi, notifikasi, audit, pengujian |
| 6 | Pilot | Data contoh/riil terbatas, UAT, perbaikan, rilis |

## 7. User Stories dan Acceptance Criteria

### US-01 - Admin membuat barang
Sebagai admin, saya ingin menambahkan barang agar barang dapat dikelola sistem.

**Acceptance criteria**
- SKU otomatis dan unik berdasarkan kategori.
- Nama, kategori, satuan, stok wajib, dan stok minimum tervalidasi.
- Stok barang baru harus bilangan bulat nol atau lebih.
- Barang tersimpan dan muncul pada daftar.

### US-02 - Admin mencatat barang masuk
Sebagai admin, saya ingin menambahkan stok saat barang diterima.

**Acceptance criteria**
- Kuantitas wajib lebih dari nol.
- Stok bertambah sesuai kuantitas.
- Movement `IN` tercatat.
- Jika penyimpanan movement gagal, saldo tidak berubah.

### US-03 - Admin membuat tugas pemasangan
Sebagai admin terdaftar, saya ingin membuat tugas pemasangan melalui tombol Telegram dan membagikan link foto bukti.

**Acceptance criteria**
- Hanya admin Telegram yang terhubung dan masuk allowlist dapat membuat tugas.
- Barang dan jumlah dapat dipilih melalui tombol; nama pemasang dan lokasi diminta bertahap.
- Catatan dapat dilewati dan ringkasan harus dikonfirmasi sebelum tugas dibuat.
- Stok belum berkurang saat tugas menunggu bukti.
- Bukti foto valid menyelesaikan tugas dan mengurangi stok tepat satu kali.

### US-04 - Update Telegram duplikat
Sebagai sistem, saya tidak ingin tombol konfirmasi yang terkirim ulang membuat tugas ganda.

**Acceptance criteria**
- `telegramUpdateId` unik.
- Update duplikat tidak membuat movement baru.
- Bot tidak mengirim konfirmasi sukses palsu.

### US-05 - Admin melihat stok kritis
Sebagai admin, saya ingin mengetahui barang yang mencapai batas minimum.

**Acceptance criteria**
- Daftar mencakup stok sama dengan atau di bawah minimum.
- Barang habis dibedakan dari stok rendah.
- Perubahan stok memperbarui status dashboard.

## 8. Rencana Pengujian

### Pengujian fungsional
- Tambah/edit/nonaktifkan barang.
- Buat kategori.
- Stock in.
- SKU otomatis berubah sesuai kategori dan tidak duplikat.
- Stok pada form barang wajib diisi; kosong dan angka negatif ditolak.
- Selesaikan panduan tugas Telegram dengan tombol.
- Foto bukti tugas menyelesaikan tugas dan mengurangi stok tepat satu kali.
- Barang nonaktif.
- Filter riwayat.
- Linking Telegram dan akun yang tidak dikenal.
- Pengguna Telegram tanpa izin menekan tombol pembuatan tugas.

### Pengujian integritas
- Insert movement gagal → saldo rollback.
- Webhook sama dikirim dua kali → hanya satu movement.
- Dua pengambilan bersamaan → saldo tidak negatif.
- Kuantitas nol/negatif/format tidak valid → ditolak.
- Transaksi pembalik → histori tetap lengkap.

### Pengujian keamanan
- Akses dashboard tanpa login.
- User biasa mencoba endpoint admin.
- Telegram user tidak terdaftar.
- Secret webhook salah.
- Rate limit pada pesan berulang.
- Secret tidak muncul pada log atau response.

## 9. Definition of Done

Fitur dianggap selesai jika:
- Kebutuhan dan acceptance criteria terpenuhi.
- Validasi berjalan di server.
- Hak akses diuji.
- Loading, empty, success, dan error state tersedia.
- Data tersimpan dengan benar.
- Log error tidak membocorkan secret.
- Pengujian utama lulus.
- Dokumentasi singkat diperbarui.

## 10. UAT - User Acceptance Test

Minta admin dan beberapa pengguna mencoba skenario berikut:
1. Buat kategori Kertas, lalu barang Kertas A4 dengan stok 50 rim dan minimum 10.
2. Tambahkan 20 rim melalui website; pastikan stok 70.
3. Hubungkan akun Telegram admin dan pastikan ID admin ada di allowlist.
4. Buat tugas lewat tombol, pilih barang/jumlah, isi pemasang/lokasi, lalu bagikan link.
5. Pastikan stok belum berubah saat tugas menunggu foto.
6. Kirim bukti foto valid; pastikan stok berkurang sekali dan tugas selesai.
7. Kirim ulang bukti pada link yang sama; pastikan stok tidak berubah lagi.
8. Turunkan stok hingga di bawah minimum; pastikan indikator kritis tampil dan riwayat tetap benar.

## 11. Kriteria Go-Live

- Semua P0 selesai.
- Tidak ada bug kritis pada perhitungan stok.
- Uji webhook duplikat dan transaksi bersamaan lulus.
- Backup dan restore diuji.
- Admin memahami prosedur koreksi stok.
- Token bot dan secret webhook tersimpan sebagai environment secret.
- Pengguna menerima panduan singkat.
- Ada PIC untuk memantau sistem pada masa pilot.

## 12. Risiko MVP

- **Kualitas data awal:** lakukan pembersihan SKU, nama, dan satuan sebelum impor.
- **Kebiasaan pengguna:** sediakan menu tombol dan pertanyaan bertahap, bukan format pesan yang harus dihafal.
- **Nama barang mirip:** gunakan SKU atau pilihan konfirmasi.
- **Jaringan Telegram:** catat status webhook dan sediakan retry yang aman.
- **Salah pencatatan:** koreksi dengan reversal/adjustment, bukan edit histori.
