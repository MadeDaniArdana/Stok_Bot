# Laporan Security Testing StockFlow (white-box, 2026-11-17)

Metode: Claude-BugHunter-style (scope → recon → tech → attack surface → vuln → validasi → laporan). Static review + `npm audit`. Tidak ada request ke sistem live.

## 1. Scope
Repo lokal StockFlow (milik sendiri): `src/app/api/*`, `src/middleware.ts`, `src/lib/*`, `src/services/*`, dependensi. Di luar scope: Vercel, Neon, Telegram, penyedia AI.

## 2-3. Recon & Teknologi
Next.js 14.2.15 (App Router), React 18, Prisma 5 + PostgreSQL (Neon), Vercel (+Blob), Telegram bot, chatbot AI (OpenAI-compatible/Gemini), zod. Sesi: cookie HMAC-SHA256 buatan sendiri; password: scrypt. `.env` tidak ter-commit (OK).

## 4. Attack surface
- 35 route API; hanya 8 path publik di middleware: `/login`, `/proof/`, `/api/auth/login`, `/api/tasks/proof/`, `/api/distributions/proof/`, `/api/telegram/webhook`, `/api/logs/client`.
- Sisanya (users, products, stock, logs, assistant, ekspor, dll.) dilindungi HANYA oleh middleware. Tidak ada handler yang memanggil `getCurrentUser`/verifikasi sesi sendiri.

## 5-6. Temuan (terurut tingkat risiko)

### F1 CRITICAL - Middleware auth bypass (CVE-2025-29927) + tanpa defense-in-depth
- Next 14.2.15 rentan (`>=14.0.0 <14.2.25`): header `x-middleware-subrequest` membuat middleware dilewati. (Hanya jika di-host self-hosted; Vercel disebut tidak terdampak untuk CVE ini, tetapi tetap perbaiki.)
- Karena 32 route tidak mengecek auth sendiri, bypass = akses admin penuh tanpa login.
- Validasi: terkonfirmasi dari kode (tidak ada cek di handler) dan versi di `package.json`/audit. Eksploitasi aktif sengaja tidak dijalankan.
- Fix: upgrade Next ke versi patched terbaru di seri 14.2.x (>=14.2.35) atau 15.5.x; tambahkan helper `requireAdmin()` di setiap handler.

### F2 HIGH - `GET /api/users` membocorkan `passwordHash`
`prisma.user.findMany({ include })` mengembalikan semua kolom skalar, termasuk hash scrypt, ke klien. Digabung F1 = pencurian hash tanpa login.
Fix: gunakan `select` eksplisit tanpa `passwordHash` (pola `safeUser` sudah ada di `auth-server.ts`).

### F3 HIGH - Dependensi rentan (`npm audit`: 1 critical, 4 high)
Next.js (RCE image optimizer, DoS server actions, SSRF), postcss, zod (<4.6.6, DoS memori). Fix: `npm i next@latest-14.2.x` atau migrasi ke 15.5.x lalu `npm audit`.

### F4 MEDIUM - Webhook Telegram fail-open
`if (expectedSecret && header !== expectedSecret)`: jika `TELEGRAM_WEBHOOK_SECRET` kosong, siapa pun bisa memalsukan update (aksi stok/tugas atas nama admin). Respons juga membocorkan `result` internal.
Fix: tolak (401/500) bila secret tidak diset; jangan kembalikan `result`.

### F5 MEDIUM - Tidak ada rate limit / lockout di `/api/auth/login`
Brute-force password tanpa batas. Fix: batasi per IP+email (Upstash/Vercel KV), delay eksponensial.

### F6 LOW - Rate limit `/api/logs/client` bisa dilewati
Memakai `X-Forwarded-For` dari klien dan Map in-memory (reset per instance serverless, `hits.clear()` saat >1000). Penyerang bisa membanjiri tabel log. Fix: pakai IP dari platform (`request.ip`) + store terpusat, atau batasi tulis ke DB.

### F7 LOW - Foto bukti di Vercel Blob `access: 'public'`
URL tidak bisa ditebak (UUID + suffix acak) tetapi siapa pun yang tahu URL bisa melihat; tidak ada kontrol akses/kedaluwarsa. Fix: acceptable untuk risiko rendah; pertimbangkan akses privat.

### F8 LOW/Info - Sesi stateless
Logout tidak mencabut token; berlaku 7 hari. Penonaktifan user baru berlaku di route yang memakai `getCurrentUser`, bukan di middleware. Fix: cek `isActive` di helper `requireAdmin`, pertimbangkan sesi lebih pendek.

### Hal yang sudah baik
Token proof 32 byte acak, hanya hash yang disimpan; upload divalidasi MIME + magic bytes + ukuran; path file lokal dibatasi regex (tanpa path traversal); scrypt + `timingSafeEqual`; cookie `httpOnly`, `secure`, `sameSite=lax`; tidak ada `dangerouslySetInnerHTML`; hanya satu `$queryRaw` bertipe tagged template (aman dari SQLi); login memberi pesan error generik.

## 7. Prioritas perbaikan
1. Upgrade Next.js + `npm audit fix` (F1, F3).
2. `requireAdmin()` di semua handler (F1, F8).
3. Hapus `passwordHash` dari respons users (F2).
4. Webhook wajib secret (F4); rate limit login (F5).
5. Sisanya (F6-F7).

Catatan: tinjauan statis; pengujian dinamis (mis. coba header bypass terhadap instance staging) belum dilakukan, dan dapat dilakukan hanya pada lingkungan milik Anda.

---

## 8. Status Remediasi (2026-11-20)

| Temuan | Status | Perbaikan yang Diterapkan |
| --- | --- | --- |
| **F1 CRITICAL** — CVE-2025-29927 & tanpa defense-in-depth | **Diperbaiki** | Upgrade `next` dari `14.2.15` → `14.2.35`; tambahkan `requireAdmin()` (`src/lib/auth-server.ts`) pada seluruh **27 route API admin** serta cek `getCurrentUser()` pada 2 halaman SSR cetak (`/print/*`). |
| **F2 HIGH** — Kebocoran `passwordHash` di `/api/users` | **Diperbaiki** | Terapkan `SAFE_USER_SELECT` pada `GET/POST /api/users` dan `PATCH /api/users/[id]`; tambah validasi enum `role`, cegah self-demotion/self-deactivation. |
| **F3 HIGH** — Dependensi rentan (`npm audit`) | **Sebagian besar diperbaiki** | Hapus `zod` (tidak terpakai), pin `@vercel/blob@2.4.0` (menutup kerentanan `undici`, `@fastify/busboy`, dan `zod`), upgrade `next@14.2.35`, dan matikan `/_next/image` (`images: { unoptimized: true }`). Sisa 2 alert pada `npm audit` hanya berasal dari `next` 14.x + `postcss` bawaannya (memerlukan migrasi major ke Next 16 + React 19 jika ingin 0 alert). |
| **F4 MEDIUM** — Webhook Telegram fail-open | **Diperbaiki** | Fail-closed (500 bila `TELEGRAM_WEBHOOK_SECRET` kosong), verifikasi token constant-time (`SHA-256 + timingSafeEqual`) sebelum parse JSON, hapus kebocoran `result` dan `error.message`. |
| **F5 MEDIUM** — Brute-force login | **Diperbaiki** | Sliding-window rate limit per IP (10 gagal / 15 menit) & per email (5 gagal / 15 menit) dengan header `Retry-After` (429), serta eksekusi `scrypt` dummy untuk mencegah enumerasi akun lewat timing. |
| **F6 LOW** — Rate limit `/api/logs/client` bisa di-reset | **Diperbaiki** | Prioritaskan `req.ip` / `x-real-ip` dan hapus hanya entri kedaluwarsa (bukan `hits.clear()`). |
| **F8 LOW** — Sesi stateless & status aktif user | **Diperbaiki** | `requireAdmin()` selalu memverifikasi `isActive === true` & `role === 'ADMIN'` langsung ke DB pada setiap permintaan API admin; cookie logout disamakan atributnya (`secure`, `sameSite: 'lax'`). |
| **Tambahan** — `actorUserId` spoofable, batas query, header HTTP, error leak | **Diperbaiki** | `POST /api/stock/in`, `POST /api/stock/movements`, `POST /api/products` kini selalu memakai `auth.user.id` dari sesi; batas `limit`/`pageSize`/`days` dikunci; `apiError()` dan catch handler tidak membocorkan pesan Prisma mentah; header keamanan global ditambahkan di `next.config.mjs` (`X-Frame-Options`, `X-Content-Type-Options`, `Referrer-Policy`, `Permissions-Policy: camera=(self), microphone=(), geolocation=()`, `HSTS`). |
