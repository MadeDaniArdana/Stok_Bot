# StockFlow — Inventory Management System

Aplikasi manajemen persediaan gudang berbasis web modern dengan **Integrasi Telegram Bot** dan **Tema Maroon Elegance**, dibangun mengikuti panduan teknis pada folder `Doc/` (`01-PRD.md`, `02-Schema_Database.md`, `03-MVP.md`, `04-Desain-UI-UX.md`, dan `05-Arsitektur.md`).

---

## 🎨 Tema UI: Merah Maroon (Executive & User-Friendly)
Aplikasi menggunakan palet warna **Merah Maroon / Burgundy** yang mewah, rapi, dan mudah dibaca:
- **Primary Maroon:** `#800020` (Burgundy Maroon)
- **Hover / Darker Maroon:** `#68051E`
- **Deep Maroon:** `#400210`
- **Soft Maroon Light Background:** `#FDF2F4`, `#FCE7EB`
- **Surface:** `#FFFFFF` dengan shadow lembut dan border halus `#E2E8F0`
- **Status Badges:**
  - 🟢 **Stok Aman:** Emerald Green (`#16A34A`)
  - 🟡 **Stok Rendah:** Amber (`#D97706`)
  - 🔴 **Stok Habis:** Rose / Crimson (`#DC2626`)

---

## 🚀 Fitur Utama Sesuai Spesifikasi PRD & Dokumen

1. **Dashboard Eksekutif (`/dashboard`)**
   - KPI Metrics: Total SKU Aktif, Total Fisik Unit Stok Agregat, Barang Stok Rendah, dan Barang Habis.
   - Grafik Interaktif: Tren Barang Masuk (IN) vs Barang Keluar (OUT) per hari.
   - Tabel **Stok Perlu Perhatian** dengan tombol cepat Restock.
   - Feed **Aktivitas Terkini** mutasi stok secara real-time.
   - Notifikasi stok minimum otomatis dengan lonceng interaktif.

2. **Master Katalog Barang (`/products`)**
   - Pencarian real-time (Nama atau SKU).
   - Filter Kategori, Status Aktif/Nonaktif, dan Kondisi Stok (Aman, Rendah, Habis).
   - SKU dibuat otomatis dari kategori dan berurutan agar tetap unik.
   - Stok wajib diisi saat barang baru dibuat; stok minimum tetap dapat diatur.
   - Pengarsipan aman (*Soft Deactivation*): barang yang memiliki riwayat transaksi tidak dihapus permanen.
   - Modal Detail Barang dilengkapi riwayat lengkap mutasi khusus barang tersebut.

3. **Master Kategori Persediaan (`/categories`)**
   - Pengelompokan barang dengan penghitung jumlah SKU per kategori.
   - Tambah, edit, dan hapus kategori yang tidak lagi digunakan.

4. **Barang Masuk / Stock In (`/stock/in`)**
   - Pencatatan barang masuk dari pembelian atau supplier.
   - **Kalkulator Prakiraan Langsung**: Menampilkan `Stok Saat Ini + Jumlah Masuk = Stok Baru`.
   - Transaksi atomik database: pembaruan saldo dan pembuatan ledger movement terjadi bersamaan.

5. **Tugas Pemasangan melalui Telegram dan WhatsApp**
   - Admin membuat tugas lewat menu tombol Telegram: pilih barang dan jumlah, isi pemasang dan lokasi, lalu konfirmasi.
   - Bot membuat link unik dan tombol berbagi WhatsApp; pemasang mengirim foto bukti melalui halaman web.
   - Pemasang mengambil foto bukti melalui halaman web ringan; stok berkurang otomatis setelah foto berhasil diterima.
   - Link hanya dapat menyelesaikan tugas satu kali; riwayat stok mencatat pemasang, lokasi, dan jumlah.
   - Status tugas terbaru dapat dilihat lewat tombol Telegram.

6. **Riwayat Mutasi & Audit Ledger (`/stock/history`)**
   - Jejak audit tidak terhapus (*immutable ledger*).
   - Filter multi-dimensi: rentang tanggal, jenis barang, tipe transaksi (`IN`, `OUT`, `REVERSAL`), sumber (`WEB`, `TELEGRAM`, `SYSTEM`), dan pengguna.
   - **Koreksi Transaksi (Reversal)**: Membuat transaksi pembalik dengan alasan wajib audit tanpa mengubah riwayat lama.
   - **Ekspor CSV**: Mengunduh rekap mutasi ke format spreadsheet dengan satu klik.

7. **Notifikasi Stok Rendah**
   - Notifikasi muncul di dashboard web dan dikirim ke Telegram admin yang sudah ditautkan.
   - Admin menambah stok dari halaman Barang Masuk.

8. **Laporan & Analitik (`/reports`)**
   - Pemilihan rentang periode (7 hari, 30 hari, 90 hari).
   - Top 5 Barang Paling Sering Digunakan.
   - Sebaran persediaan per kategori.
   - Arus mutasi harian.

9. **Manajemen Pengguna & Otorisasi (`/users`)**
   - Pengelolaan akun Admin dan Staff.
   - Pengaitan identitas akun Telegram (*Linking* Telegram User ID & Username).
   - Role Switcher interaktif pada header untuk memudahkan pengujian multi-peran.

10. **Integrasi Telegram Bot & Simulator (`/telegram`)**
    - Status webhook gateway aktif dengan verifikasi rahasia HTTPS.
    - Idempotensi terjamin: mencegah update ganda dengan `update_id` unik.
    - **Live Interactive Telegram Simulator**: Pengujian menu tombol dan alur Telegram di browser.
    - Log audit webhook updates.

11. **Autentikasi & Halaman Login (`/login`)**
    - Desain elegan Maroon dengan fitur toggle password dan *Remember Me*.
    - Tombol *Demo Persona* 1-klik untuk langsung masuk sebagai Admin atau Staff.

---

## 🛠️ Tech Stack

- **Framework:** Next.js 14 (App Router)
- **Language:** TypeScript
- **Styling:** Tailwind CSS (Custom Maroon Palette)
- **Database & ORM:** Prisma ORM dengan PostgreSQL (Neon/Supabase); foto bukti disimpan di Vercel Blob
- **Icons:** Lucide React
- **Charts:** Recharts
- **Form & Validation:** Validasi server & client terintegrasi

---

## ⚡ Cara Menjalankan

### 1. Instalasi Dependensi
```bash
npm install
```

### 2. Setup Database & Seeding
```bash
npx prisma db push
node prisma/seed.js
```

### 3. Menjalankan Server Development
```bash
npm run dev
```
Akses aplikasi melalui browser di: `http://localhost:3000`

### 4. Konfigurasi alur tugas Telegram

- Atur `APP_URL` ke alamat yang dapat dibuka pemasang melalui WhatsApp (jangan gunakan `localhost` bila dibuka dari perangkat lain).
- Isi `TELEGRAM_ADMIN_IDS` dengan ID Telegram admin yang dipisahkan koma. ID ini menjadi allowlist untuk membuat dan melacak tugas.
- Hubungkan akun admin satu kali menggunakan `/link <email>`, lalu buka menu bot dan tekan **Buat tugas pemasangan**.
- Pilih barang dan jumlah dari tombol, isi nama pemasang dan lokasi, lalu konfirmasi. Catatan dapat dilewati.
- Admin membagikan link yang dibuat bot melalui tombol WhatsApp. Pemasang mengirim foto dari link itu; sistem menandai tugas selesai dan mengurangi stok.
- Pada server lokal, foto disimpan di `uploads/task-proofs` (atau folder `TASK_PROOF_DIRECTORY`). Buat backup folder ini bersama database.
- Deploy Vercel saat ini hanya untuk demo: filesystem `/tmp` bersifat sementara. Jangan gunakan deploy tersebut sebagai penyimpanan produksi untuk foto atau database.

### 5. Build untuk Production
```bash
npm run build
npm run start
```

---

## 👤 Akun Uji Coba (Demo Credentials)

| Nama | Email | Role | Telegram Terhubung |
|---|---|---|---|
| **Budi Pratama** | `admin@stockflow.com` | `ADMIN` | Ya |
| **Siti Rahma** | `siti@stockflow.com` | `USER` | `@sitirahma_ops` |
| **Ahmad Fauzi** | `ahmad@stockflow.com` | `USER` | `@ahmadfauzi_dev` |
| **Dewi Lestari** | `dewi@stockflow.com` | `USER` | Belum terhubung |

*Semua akun demo dapat digunakan dengan mengklik tombol "Akses Cepat Demo" pada halaman login atau menu switcher di header kanan atas.*
