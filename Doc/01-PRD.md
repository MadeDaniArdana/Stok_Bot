# Product Requirements Document (PRD)
## StockFlow - Inventory Management System dengan Integrasi Telegram

**Versi:** 1.0  
**Status:** Draft siap menjadi acuan pengembangan MVP  
**Bahasa:** Indonesia

---

## 1. Ringkasan Produk

StockFlow adalah aplikasi pengelolaan persediaan berbasis web yang terhubung dengan Telegram Bot. Admin membuat tugas pemasangan melalui Telegram, lalu membagikan link unik kepada pemasang lewat WhatsApp. Pemasang mengirim foto bukti melalui halaman web ringan; stok berkurang otomatis setelah foto berhasil diterima. Website digunakan untuk melihat stok dan mencatat barang masuk.

Setiap transaksi yang valid dicatat ke database dan memperbarui stok secara otomatis. Admin dapat melihat kondisi persediaan, riwayat pergerakan barang, serta menerima peringatan ketika stok mencapai atau berada di bawah batas minimum.

### Masalah yang ingin diselesaikan

- Pencatatan stok manual rawan terlambat, salah hitung, atau tidak konsisten.
- Pengambilan barang sering tidak langsung tercatat.
- Admin sulit mengetahui siapa mengambil barang, kapan, dan berapa jumlahnya.
- Informasi stok menipis tidak selalu diketahui tepat waktu.
- Riwayat perubahan stok sulit ditelusuri jika hanya mengubah angka stok.

### Solusi

1. Admin mengelola master barang, kategori, pengguna, dan barang masuk melalui website.
2. Admin membuat tugas berisi barang, jumlah, pemasang, dan lokasi melalui Telegram.
3. Bot membuat link unik yang dibagikan ke pemasang melalui WhatsApp.
4. Pemasang mengirim foto bukti; sistem menyelesaikan tugas dan mengurangi stok secara atomik.
5. Website menampilkan stok, riwayat mutasi, dan notifikasi stok rendah.
6. Bot menjawab status tugas dan mengirim notifikasi stok rendah kepada admin.

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
| Admin | Membuat dan melacak tugas pemasangan | Menu tombol Telegram; web untuk stok dan barang masuk |
| Pemasang | Menyelesaikan tugas dan mengirim bukti pemasangan | Membuka link WhatsApp dan mengirim foto; tidak perlu akun Telegram |

**Aturan akses awal:** hanya admin yang akunnya terhubung dan Telegram User ID-nya masuk allowlist yang dapat membuat tugas. Pemasang mengakses tugas melalui token link khusus.

## 4. Ruang Lingkup

### 4.1 Termasuk dalam MVP
- Login admin dan pengelolaan sesi.
- Role admin dan pengguna.
- CRUD barang dan kategori.
- SKU otomatis berdasarkan kategori, satuan, stok minimum, dan status aktif.
- Stok wajib diisi saat barang baru dibuat.
- Pencatatan barang masuk melalui website.
- Tugas pemasangan dibuat oleh admin melalui Telegram.
- Pengiriman foto bukti melalui link sekali-selesai; stok keluar dicatat otomatis setelah bukti diterima.
- Dashboard ringkasan stok.
- Riwayat pergerakan stok.
- Integrasi Telegram Bot melalui webhook.
- Pengaitan akun Telegram dengan pengguna sistem.
- Pelacakan tugas pemasangan melalui perintah bot `/tugas`.
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

### FR-01 - Autentikasi
- Admin dapat login dan logout.
- Halaman dashboard hanya dapat diakses setelah autentikasi.
- Endpoint dan server action memeriksa sesi serta role, bukan hanya menyembunyikan menu di UI.
- Akun nonaktif tidak dapat melakukan login atau transaksi.

**Kriteria penerimaan**
- Pengguna tanpa sesi diarahkan ke halaman login.
- Role yang tidak berhak menerima respons akses ditolak.
- Password disimpan dalam bentuk hash oleh penyedia autentikasi yang digunakan.

### FR-02 - Dashboard
Menampilkan:
- Total jenis barang aktif.
- Total kuantitas stok (angka agregat, dengan catatan satuan barang dapat berbeda).
- Jumlah barang di bawah/menyamai stok minimum.
- Jumlah barang habis.
- Ringkasan barang masuk dan keluar pada periode terpilih.
- Aktivitas terbaru.
- Daftar stok kritis.

**Catatan:** total kuantitas lintas satuan hanya indikator agregat, bukan ukuran fisik yang dapat dijumlahkan secara bermakna. Tampilkan juga jumlah SKU dan rincian per satuan bila diperlukan.

### FR-03 - Manajemen Barang
Admin dapat:
- Membuat, melihat, mengubah, mencari, memfilter, dan menonaktifkan barang.
- Mengatur nama, kategori, satuan, stok minimum, dan deskripsi; stok awal wajib diisi saat barang dibuat dan SKU otomatis dibuat dari kategori.
- Melihat stok saat ini dan histori pergerakan.
- Tidak menghapus permanen barang yang sudah memiliki transaksi.

**Validasi**
- Kategori wajib dipilih untuk barang baru; SKU unik dibuat otomatis dari nama kategori dengan nomor urut.
- Nama wajib diisi.
- Satuan wajib dipilih.
- Stok wajib diisi dengan bilangan bulat nol atau lebih.
- Stok minimum tidak boleh negatif.
- Barang yang sudah memiliki transaksi hanya dapat diarsipkan/nonaktifkan.

### FR-04 - Kategori dan Satuan
- Admin dapat mengelola kategori.
- Satuan menggunakan daftar yang konsisten, misalnya pcs, box, rim, unit, meter, liter.
- Barang memakai satu satuan dasar untuk seluruh transaksi.
- Konversi satuan tidak termasuk MVP. Jangan mengizinkan transaksi menggunakan satuan berbeda tanpa aturan konversi yang eksplisit.

### FR-05 - Barang Masuk (Stock In)
Admin memasukkan barang, kuantitas, tanggal, sumber/supplier opsional, dan catatan.
- Kuantitas harus lebih besar dari nol.
- Sistem menambah stok dan membuat catatan `IN` dalam satu transaksi database.
- Transaksi menyimpan aktor dan sumber transaksi.

### FR-06 - Tugas Pemasangan dan Barang Keluar
- Hanya admin Telegram yang masuk allowlist dapat membuat tugas pemasangan.
- Tugas memuat barang, jumlah, nama pemasang, lokasi, dan catatan opsional.
- Bot menghasilkan link unik; halaman link menampilkan ringkasan tugas dan menyediakan pengiriman foto.
- Stok berkurang hanya setelah foto valid berhasil diterima; pembaruan stok, movement `OUT`, dan status tugas selesai dilakukan secara atomik.
- Link tidak dapat menyelesaikan tugas lebih dari satu kali.
- Jika stok tidak cukup saat foto dikirim, tugas tetap menunggu dan stok tidak berubah.

### FR-07 - Integrasi Telegram
Bot menyediakan menu tombol untuk melihat stok, mencari barang, melihat riwayat, dan melacak tugas. Admin membuat tugas melalui panduan bertahap:
1. Memilih barang dan jumlah melalui tombol.
2. Mengisi nama pemasang dan lokasi; catatan bersifat opsional.
3. Memeriksa ringkasan dan mengonfirmasi sebelum link dibuat.

Bot mengirim link bukti dan tombol berbagi WhatsApp. Perintah `/link` hanya diperlukan saat pertama kali menghubungkan akun. Perintah teks lama tetap dapat digunakan sebagai jalur kompatibilitas, tetapi bukan alur utama.

### FR-08 - Pengaitan Telegram
- Pengguna memulai bot dengan `/start`.
- Sistem memberikan kode pengaitan sekali pakai atau mekanisme verifikasi yang aman.
- Pengguna memasukkan kode pada website atau admin mengaitkan akun secara terkontrol.
- Telegram User ID dan Chat ID disimpan sesuai kebutuhan.
- Satu Telegram User ID tidak boleh terhubung ke beberapa akun aktif tanpa kebijakan eksplisit.
- Token bot dan secret webhook tidak pernah ditampilkan ke browser.

### FR-09 - Riwayat Transaksi
Menampilkan waktu, barang, jenis transaksi, kuantitas, stok sebelum/sesudah (jika disimpan), aktor, sumber, dan catatan.
- Dapat difilter berdasarkan periode, barang, tipe, pengguna, dan sumber.
- Transaksi tidak dihapus permanen.
- Koreksi dilakukan dengan movement pembalik yang merujuk transaksi awal.

### FR-10 - Peringatan Stok Minimum
- Ketika stok mencapai atau berada di bawah batas minimum, sistem membuat notifikasi.
- Notifikasi tidak dikirim berulang untuk setiap refresh.
- Admin dapat melihat notifikasi pada website dan menerimanya melalui Telegram jika bot dan akun admin dikonfigurasi.
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
13. SKU barang baru dibuat dari nama kategori dengan nomor urut; SKU tidak diinput manual.
14. Stok wajib diisi saat barang baru dibuat, termasuk nilai nol; stok positif dicatat sebagai movement `IN`.

## 7. Aturan Alokasi Tugas

- Saat tugas dibuat, jumlahnya dialokasikan agar tugas-tugas pending tidak melebihi stok tersedia.
- Saldo fisik baru berkurang setelah foto bukti diterima.
- Jika stok berubah dan tidak lagi cukup ketika bukti dikirim, tugas tetap pending dan admin perlu menanganinya.
- Tidak ada proses persetujuan tugas di website.

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
4. Wajib mengisi stok saat membuat barang; stok positif dicatat sebagai movement `IN`.
5. Menghubungkan akun Telegram admin dan memasukkan Telegram ID ke allowlist.
6. Mencatat barang masuk.
7. Membuat tugas pemasangan melalui tombol Telegram, membagikan link lewat WhatsApp, lalu melacak status melalui menu tugas.
8. Memantau stok kritis, notifikasi, dan laporan.

### Pemasang
1. Menerima link tugas melalui WhatsApp.
2. Membuka halaman tugas dan memeriksa barang serta lokasi.
3. Mengambil foto bukti dan mengirimkannya.
4. Sistem otomatis menandai tugas selesai dan mengurangi stok.

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

Keputusan alur saat ini:
- Operasional dimulai dari satu gudang.
- Bahasa antarmuka Indonesia.
- Admin mengelola master barang dan barang masuk.
- Admin membuat tugas pemasangan lewat Telegram; pemasang mengirim foto melalui link WhatsApp.
- Stok berkurang setelah foto bukti berhasil dikirim; website tidak meminta persetujuan tugas.
- Notifikasi stok rendah muncul di web dan dikirim ke Telegram admin.
- Aplikasi di-deploy ke Vercel dengan database PostgreSQL (Neon) dan foto bukti di Vercel Blob.

Sebelum launching, siapkan `APP_URL`, `TELEGRAM_ADMIN_IDS`, bot Telegram, database lokal, dan lokasi backup foto.
