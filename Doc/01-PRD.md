# Product Requirements Document (PRD)
## StockFlow — Inventory Management System dengan Integrasi Telegram

**Versi:** 1.0  
**Status:** Draft siap menjadi acuan pengembangan MVP  
**Bahasa:** Indonesia

---

## 1. Ringkasan Produk

StockFlow adalah aplikasi pengelolaan persediaan berbasis web yang terhubung dengan Telegram Bot. Website menjadi pusat pengelolaan barang dan monitoring stok oleh admin, sedangkan pengguna dapat melaporkan pengambilan barang melalui Telegram tanpa harus membuka website.

Setiap transaksi yang valid dicatat ke database dan memperbarui stok secara otomatis. Admin dapat melihat kondisi persediaan, riwayat pergerakan barang, serta menerima peringatan ketika stok mencapai atau berada di bawah batas minimum.

### Masalah yang ingin diselesaikan

- Pencatatan stok manual rawan terlambat, salah hitung, atau tidak konsisten.
- Pengambilan barang sering tidak langsung tercatat.
- Admin sulit mengetahui siapa mengambil barang, kapan, dan berapa jumlahnya.
- Informasi stok menipis tidak selalu diketahui tepat waktu.
- Riwayat perubahan stok sulit ditelusuri jika hanya mengubah angka stok.

### Solusi

1. Admin mengelola master barang, kategori, satuan, pengguna, dan stok melalui website.
2. Pengguna terdaftar mengirim laporan pengambilan barang melalui Telegram.
3. Sistem memvalidasi identitas, barang, jumlah, dan ketersediaan stok.
4. Jika valid dan sesuai kebijakan pengguna, transaksi dicatat dan stok dikurangi secara atomik.
5. Website menampilkan perubahan stok dan riwayat transaksi.
6. Sistem mengirim konfirmasi dan notifikasi stok minimum.

## 2. Visi, Tujuan, dan Prinsip Produk

### Visi
Menyediakan satu sumber data persediaan yang mudah digunakan, transparan, dan dapat ditelusuri oleh admin maupun pengguna.

### Tujuan bisnis dan operasional
- Mengurangi pencatatan ganda antara chat dan website.
- Meningkatkan akurasi jumlah stok.
- Mempercepat proses pencatatan barang keluar.
- Menyediakan audit trail untuk setiap perubahan stok.
- Membantu admin melakukan pengadaan sebelum stok habis.

### Prinsip desain
- **Akurat:** stok dan riwayat transaksi selalu berubah bersama dalam satu transaksi database.
- **Aman:** hanya pengguna yang terdaftar dan berizin yang dapat melakukan tindakan.
- **Mudah:** alur Telegram sederhana; website memakai istilah yang familiar.
- **Dapat diaudit:** transaksi tidak dihapus permanen; koreksi dilakukan dengan transaksi pembalik.
- **Bertahap:** mulai dari satu gudang dan fitur inti, lalu dikembangkan sesuai kebutuhan.

## 3. Pengguna dan Hak Akses

| Peran | Kebutuhan | Hak utama |
|---|---|---|
| Admin | Mengelola seluruh persediaan dan pengguna | Dashboard, master barang, kategori, stock in/out, laporan, pengguna, pengaturan, integrasi Telegram |
| Pengguna terdaftar | Melaporkan pengambilan dan memeriksa informasi yang diizinkan | Telegram `/pakai`, `/cari`, `/stok` sesuai kebijakan, `/riwayat` milik sendiri |
| Admin gudang/approver (opsional tahap lanjut) | Meninjau permintaan yang memerlukan persetujuan | Melihat dan menyetujui/menolak permintaan |

**Aturan akses awal:** hanya pengguna yang telah dihubungkan dengan Telegram User ID dan diaktifkan oleh admin yang boleh membuat transaksi. Mode persetujuan dapat diaktifkan berdasarkan pengguna atau kebijakan barang.

## 4. Ruang Lingkup

### 4.1 Termasuk dalam MVP
- Login admin dan pengelolaan sesi.
- Role admin dan pengguna.
- CRUD barang dan kategori.
- Pengaturan SKU, satuan, stok minimum, dan status aktif.
- Pencatatan barang masuk melalui website.
- Pencatatan barang keluar melalui website.
- Dashboard ringkasan stok.
- Riwayat pergerakan stok.
- Integrasi Telegram Bot melalui webhook.
- Pengaitan akun Telegram dengan pengguna sistem.
- Laporan pengambilan melalui format terstruktur.
- Dukungan bahasa natural secara terbatas dengan konfirmasi jika ambigu.
- Validasi stok tidak boleh negatif.
- Idempotensi update Telegram.
- Notifikasi stok minimum kepada admin.

### 4.2 Tidak termasuk MVP
- Multi-gudang dan transfer antargudang.
- Purchase order dan manajemen supplier lengkap.
- Prediksi kebutuhan stok.
- Persetujuan bertingkat.
- Aplikasi mobile native.
- Integrasi ERP/akuntansi.
- Pemindaian barcode/QR (dapat menjadi pengembangan berikutnya).
- Export PDF/Excel kompleks (dapat ditambahkan setelah alur inti stabil).

## 5. Fitur dan Kebutuhan Fungsional

### FR-01 — Autentikasi
- Admin dapat login dan logout.
- Halaman dashboard hanya dapat diakses setelah autentikasi.
- Endpoint dan server action memeriksa sesi serta role, bukan hanya menyembunyikan menu di UI.
- Akun nonaktif tidak dapat melakukan login atau transaksi.

**Kriteria penerimaan**
- Pengguna tanpa sesi diarahkan ke halaman login.
- Role yang tidak berhak menerima respons akses ditolak.
- Password disimpan dalam bentuk hash oleh penyedia autentikasi yang digunakan.

### FR-02 — Dashboard
Menampilkan:
- Total jenis barang aktif.
- Total kuantitas stok (angka agregat, dengan catatan satuan barang dapat berbeda).
- Jumlah barang di bawah/menyamai stok minimum.
- Jumlah barang habis.
- Ringkasan barang masuk dan keluar pada periode terpilih.
- Aktivitas terbaru.
- Daftar stok kritis.

**Catatan:** total kuantitas lintas satuan hanya indikator agregat, bukan ukuran fisik yang dapat dijumlahkan secara bermakna. Tampilkan juga jumlah SKU dan rincian per satuan bila diperlukan.

### FR-03 — Manajemen Barang
Admin dapat:
- Membuat, melihat, mengubah, mencari, memfilter, dan menonaktifkan barang.
- Mengatur SKU unik, nama, kategori, satuan, stok minimum, dan deskripsi.
- Melihat stok saat ini dan histori pergerakan.
- Tidak menghapus permanen barang yang sudah memiliki transaksi.

**Validasi**
- SKU unik.
- Nama wajib diisi.
- Satuan wajib dipilih.
- Stok minimum tidak boleh negatif.
- Barang yang sudah memiliki transaksi hanya dapat diarsipkan/nonaktifkan.

### FR-04 — Kategori dan Satuan
- Admin dapat mengelola kategori.
- Satuan menggunakan daftar yang konsisten, misalnya pcs, box, rim, unit, meter, liter.
- Barang memakai satu satuan dasar untuk seluruh transaksi.
- Konversi satuan tidak termasuk MVP. Jangan mengizinkan transaksi menggunakan satuan berbeda tanpa aturan konversi yang eksplisit.

### FR-05 — Barang Masuk (Stock In)
Admin memasukkan barang, kuantitas, tanggal, sumber/supplier opsional, dan catatan.
- Kuantitas harus lebih besar dari nol.
- Sistem menambah stok dan membuat catatan `IN` dalam satu transaksi database.
- Transaksi menyimpan aktor dan sumber transaksi.

### FR-06 — Barang Keluar (Stock Out)
Barang keluar dapat dicatat admin melalui website atau pengguna berizin melalui Telegram.
- Kuantitas harus lebih besar dari nol.
- Stok harus mencukupi.
- Sistem mengurangi stok dan menyimpan catatan `OUT` secara atomik.
- Jika stok tidak cukup, tidak ada perubahan stok maupun movement.

### FR-07 — Integrasi Telegram
Perintah minimum:
- `/start` — petunjuk awal dan proses pengaitan akun.
- `/bantuan` — panduan format pesan.
- `/stok` — ringkasan stok sesuai izin.
- `/cari nama_barang` — mencari barang.
- `/pakai` — memulai atau menjelaskan format laporan.
- `/riwayat` — riwayat transaksi pengguna sendiri.

Format terstruktur yang direkomendasikan:

```text
PAKAI
Barang: Kertas A4
Jumlah: 5
Keperluan: Administrasi
```

Satuan mengikuti satuan dasar barang di sistem. Pengguna tidak perlu mengirim satuan jika sistem sudah dapat menentukannya dari master barang.

Bahasa natural dapat didukung secara bertahap. Jika nama barang cocok lebih dari satu, jumlah tidak jelas, atau pesan tidak lengkap, bot wajib meminta klarifikasi dan tidak boleh mengubah stok.

### FR-08 — Pengaitan Telegram
- Pengguna memulai bot dengan `/start`.
- Sistem memberikan kode pengaitan sekali pakai atau mekanisme verifikasi yang aman.
- Pengguna memasukkan kode pada website atau admin mengaitkan akun secara terkontrol.
- Telegram User ID dan Chat ID disimpan sesuai kebutuhan.
- Satu Telegram User ID tidak boleh terhubung ke beberapa akun aktif tanpa kebijakan eksplisit.
- Token bot dan secret webhook tidak pernah ditampilkan ke browser.

### FR-09 — Riwayat Transaksi
Menampilkan waktu, barang, jenis transaksi, kuantitas, stok sebelum/sesudah (jika disimpan), aktor, sumber, dan catatan.
- Dapat difilter berdasarkan periode, barang, tipe, pengguna, dan sumber.
- Transaksi tidak dihapus permanen.
- Koreksi dilakukan dengan movement pembalik yang merujuk transaksi awal.

### FR-10 — Peringatan Stok Minimum
- Ketika stok berubah dari di atas batas minimum menjadi sama dengan/di bawah batas minimum, sistem membuat notifikasi.
- Notifikasi tidak dikirim berulang untuk setiap refresh.
- Admin dapat melihat notifikasi pada website dan menerima pesan Telegram jika konfigurasi tersedia.
- Sistem dapat membuat notifikasi baru setelah stok pulih lalu turun kembali.

## 6. Aturan Bisnis Utama

1. Kuantitas transaksi wajib bilangan positif.
2. Stok tidak boleh negatif.
3. Semua perubahan stok harus menghasilkan stock movement.
4. Update stok dan insert movement wajib berada dalam satu transaksi database.
5. Webhook Telegram harus idempoten menggunakan `update_id`.
6. Hanya akun aktif dan terhubung yang dapat melakukan transaksi Telegram.
7. Pesan ambigu tidak boleh langsung mengubah stok.
8. Barang nonaktif tidak dapat dipakai dalam transaksi baru.
9. Satuan transaksi mengikuti satuan dasar produk.
10. Transaksi yang sudah tercatat tidak dihapus; gunakan pembalik/koreksi.
11. Semua waktu disimpan sebagai timestamp yang konsisten (disarankan UTC) dan ditampilkan dalam zona waktu operasional, misalnya Asia/Jakarta.
12. Perubahan manual stok harus memiliki alasan dan tercatat sebagai `ADJUSTMENT`, bukan mengedit angka tanpa jejak.

## 7. Mode Pengambilan: Rekomendasi

Gunakan **mode hybrid**:
- Pengguna yang dipercaya dapat langsung mengurangi stok.
- Pengguna atau jenis barang tertentu dapat diwajibkan meminta persetujuan admin.
- Pengaturan mode harus eksplisit dan terlihat oleh admin.

Untuk MVP paling sederhana, mulai dengan direct issue untuk pengguna yang telah diaktifkan admin, sambil mendesain status permintaan agar mode approval dapat ditambahkan tanpa mengubah fondasi data.

## 8. Kebutuhan Non-Fungsional

| Area | Kebutuhan |
|---|---|
| Keamanan | HTTPS, validasi sesi/role, secret webhook, rate limit, validasi input |
| Integritas data | Transaksi database, conditional update/locking, constraint |
| Keandalan | Idempotensi webhook, retry aman, logging error |
| Kinerja | Daftar barang dan riwayat memakai pagination dan filter server-side |
| Kemudahan | Bahasa Indonesia, label jelas, validasi dekat dengan input |
| Audit | Aktor, waktu, sumber, dan alasan perubahan tercatat |
| Backup | Backup database terjadwal dan prosedur pemulihan diuji |
| Observability | Log webhook, kegagalan notifikasi, dan error aplikasi |

## 9. Metrik Keberhasilan

- Persentase transaksi keluar yang tercatat melalui sistem.
- Jumlah selisih stok saat stock opname.
- Waktu rata-rata pencatatan pengambilan.
- Jumlah transaksi gagal karena stok tidak cukup.
- Persentase pesan Telegram yang diproses tanpa intervensi.
- Jumlah kejadian duplikasi transaksi (target: nol).
- Persentase barang kritis yang diketahui admin melalui notifikasi.

## 10. Alur Pengguna Utama

### Admin
1. Login.
2. Melihat dashboard.
3. Membuat kategori dan barang.
4. Mengisi saldo awal melalui transaksi penyesuaian/stock in yang terdokumentasi.
5. Mengaktifkan pengguna dan menghubungkan Telegram.
6. Mencatat barang masuk.
7. Memantau transaksi keluar, stok kritis, dan laporan.

### Pengguna Telegram
1. Membuka bot dan menjalankan `/start`.
2. Menyelesaikan pengaitan akun.
3. Mengirim laporan pengambilan.
4. Bot memvalidasi identitas dan isi pesan.
5. Jika perlu, bot meminta klarifikasi.
6. Jika valid, sistem memeriksa stok dan mencatat transaksi.
7. Bot mengirim hasil transaksi.

## 11. Risiko dan Mitigasi

| Risiko | Dampak | Mitigasi |
|---|---|---|
| Pesan ambigu | Salah barang/jumlah | Format terstruktur, konfirmasi |
| Webhook dikirim ulang | Stok berkurang ganda | Unique `update_id` dan idempotensi |
| Dua orang mengambil bersamaan | Stok negatif | Conditional update/locking dan transaksi |
| Akun Telegram tidak dikenal | Transaksi ilegal | Linking dan allowlist |
| Token bocor | Bot disalahgunakan | Environment secret, rotasi token |
| Salah input stock in | Stok tidak akurat | Validasi, audit trail, transaksi pembalik |
| Notifikasi gagal | Admin terlambat tahu | Retry/log status notifikasi |

## 12. Asumsi dan Keputusan yang Perlu Dikonfirmasi

Dokumen ini memakai asumsi awal berikut:
- Operasional dimulai dari satu gudang.
- Bahasa antarmuka Indonesia.
- Admin mengelola master barang dan barang masuk.
- Pengguna terdaftar melaporkan barang keluar lewat Telegram.
- Format terstruktur menjadi metode utama; bahasa natural menjadi fitur bantu.
- Pengguna tertentu dapat memakai mode langsung, sementara mode persetujuan disiapkan sebagai konfigurasi lanjutan.

Sebelum produksi, pemilik proses perlu mengonfirmasi: siapa yang boleh mengambil langsung, apakah semua barang boleh keluar tanpa approval, siapa penerima notifikasi, dan apakah ada kebutuhan departemen/proyek sebagai dimensi laporan.
