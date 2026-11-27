# Migrasi & Deployment PostgreSQL + Docker (Server Kampus & Lokal)

Panduan ini membungkus database PostgreSQL saat ini (mis. dari Neon) dan menjalankannya secara mandiri menggunakan **PostgreSQL 18 + Docker Compose**.

## 1. Bungkus Database Saat Ini (Dump)
Pastikan `.env` masih mengarah ke `DATABASE_URL` sumber (mis. Neon), lalu jalankan:

```bash
npm run db:dump
```

Perintah ini **read-only** (tidak mengubah data di database lama) dan menyimpan hasil dump ke:
- `backups/stockflow-<timestamp>.sql`
- `backups/latest.sql`

> Folder `backups/` sudah masuk `.gitignore` sehingga data sensitif tidak pernah ikut ter-commit ke GitHub.

---

## 2. Jalankan PostgreSQL di Docker & Restore Data

```bash
# Nyalakan container PostgreSQL saja (service `db`)
docker compose up -d db

# Restore file backups/latest.sql ke PostgreSQL Docker + sinkron skema Prisma terbaru
npm run db:restore

# Verifikasi jumlah baris 100% cocok antara DB sumber vs Docker
npm run db:verify
```

---

## 3. Pindahkan `.env` ke PostgreSQL Docker

Sesuaikan variabel di `.env` (ganti password dengan password kuat di server kampus):

```env
POSTGRES_USER="stockflow"
POSTGRES_PASSWORD="ganti-dengan-password-kuat"
POSTGRES_DB="stockflow"
POSTGRES_PORT="5432"
DATABASE_URL="postgresql://stockflow:ganti-dengan-password-kuat@127.0.0.1:5432/stockflow?schema=public"
```

---

## 4. Menjalankan Aplikasi di Server Kampus

### Opsi A — Full Docker (`app` + `db` sekaligus)
```bash
# Salin backups/latest.sql ke server kampus (mis. lewat scp), lalu:
docker compose up -d db
npm run db:restore
docker compose up -d --build app
```
Saat update kode di kemudian hari:
```bash
git pull --ff-only
docker compose build app
docker compose run --rm app npx prisma db push
docker compose up -d app
```

### Opsi B — PostgreSQL di Docker, Next.js tetap lewat PM2/Node
```bash
docker compose up -d db
npm run db:restore
# Pastikan .env memakai DATABASE_URL ke 127.0.0.1:5432
npm ci
npm run db:push
npm run build
pm2 restart all
```

---

## 5. Backup Rutin Harian di Server Kampus
```bash
# Backup langsung dari container PostgreSQL Docker (bisa dimasukkan cron harian):
docker compose exec -T db pg_dump -U "${POSTGRES_USER:-stockflow}" -d "${POSTGRES_DB:-stockflow}" --no-owner --no-privileges --clean --if-exists > "backups/daily-$(date +%F).sql"
```

## Pengamanan sebelum server kampus menerima trafik

- Bind aplikasi dan PostgreSQL ke loopback. Docker Compose sudah mengikat kedua port ke `127.0.0.1`. Untuk Node/PM2, jalankan Next dengan `next start --hostname 127.0.0.1`. Izinkan akses aplikasi melalui reverse proxy HTTPS saja.
- Atur `APP_URL` ke URL HTTPS resmi kampus. Buat `AUTH_SECRET`, `TELEGRAM_WEBHOOK_SECRET`, serta kata sandi database dan admin yang unik untuk lingkungan kampus. Gunakan pembatasan percobaan login di reverse proxy. Jika `TRUST_PROXY_IP=1`, proxy harus menimpa `X-Real-IP` dengan alamat yang diverifikasi (`proxy_set_header X-Real-IP $remote_addr;` untuk Nginx di tepi jaringan). Gunakan batas body 5 MB untuk menangani unggahan bukti 4 MB.
- Sebelum mengganti versi aplikasi, buat backup lalu sinkronkan database target versi baru dengan `npx prisma db push`. Rilis ini menambah `User.sessionVersion` dan `WebSession`. Pengguna perlu login ulang dan sesi baru berlaku maksimal delapan jam. Uji bahwa logout, reset kata sandi, dan penonaktifan akun segera mencabut sesi.
- Jika arsip bukti memakai Blob publik, ikuti migrasi di README dan verifikasi arsip dari panel admin sebelum menghapus salinan lama. Untuk foto pada volume server kampus, batasi akses direktori dan jangan sajikan direktori unggahan sebagai aset publik. Simpan backup database dan foto dengan akses terbatas.
- Jalankan `npm audit --omit=dev` dari lockfile yang akan dipasang. Uji build, login admin dan divisi, persetujuan, batas akses antar divisi, unggah bukti, dan restore backup pada lingkungan staging kampus dengan data uji.

### Batas saldo awal per lingkungan

Batas bawaan adalah `2026-11-26T15:30:00+07:00`. Nilai ini berlaku saat `STOCK_OPENING_BALANCE_AT` kosong atau belum ditetapkan. Untuk memakai waktu lain, isi variabel dengan tanggal dan jam saldo awal kampus dalam format `YYYY-MM-DDTHH:mm:ss+07:00`. Untuk menghitung seluruh transaksi bulanan, isi `STOCK_OPENING_BALANCE_AT="off"`.

Pada bulan yang memuat batas tersebut, transaksi yang dicatat sebelum batas menjadi bagian dari saldo awal. Transaksi mulai dari batas muncul pada Barang Masuk atau Barang Keluar sesuai periode dokumennya. Riwayat tetap tersedia. Konfigurasi ini tidak mengubah skema atau data stok. Untuk Docker Compose, jalankan `docker compose up -d --build app` setelah pull dan mengatur `.env`. Untuk PM2, build ulang lalu restart proses aplikasi dengan konfigurasi baru.
