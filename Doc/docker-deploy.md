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
git pull origin main
docker compose up -d --build app
docker compose exec app npx prisma db push
```

### Opsi B — PostgreSQL di Docker, Next.js tetap lewat PM2/Node
```bash
docker compose up -d db
npm run db:restore
# Pastikan .env memakai DATABASE_URL ke 127.0.0.1:5432
npm ci
npm run build
pm2 restart all
```

---

## 5. Backup Rutin Harian di Server Kampus
```bash
# Backup langsung dari container PostgreSQL Docker (bisa dimasukkan cron harian):
docker compose exec -T db pg_dump -U "${POSTGRES_USER:-stockflow}" -d "${POSTGRES_DB:-stockflow}" --no-owner --no-privileges --clean --if-exists > "backups/daily-$(date +%F).sql"
```
