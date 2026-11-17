# Flow Sistem & Tech Stack - StockFlow

Dokumen ini memvisualisasikan alur sistem StockFlow sesuai kode saat ini, lengkap dengan teknologi yang dipakai di setiap bagian.

> Diagram ditulis dengan **Mermaid**. Tampil otomatis di GitHub, GitLab, dan VS Code (ekstensi *Markdown Preview Mermaid Support*).
>
> **Cara copas ke tempat visualisasi:**
> 1. Buka https://mermaid.live
> 2. Salin **seluruh isi** blok kode diagram, mulai baris pertama (`flowchart`, `sequenceDiagram`, `stateDiagram-v2`, atau `erDiagram`) sampai baris terakhir sebelum penutup ` ``` `. Jangan ikut menyalin baris ` ```mermaid ` dan ` ``` `.
> 3. Tempel di panel **Code** (hapus contoh bawaan dulu). Diagram langsung tampil.
> 4. Klik **Actions → PNG / SVG** untuk mengunduh gambar ke laporan.
>
> Setiap blok sudah lengkap dan berdiri sendiri, tidak bergantung pada blok lain.

---

## 1. Tech Stack

| Lapisan | Teknologi | Versi | Fungsi |
|---|---|---|---|
| Framework | **Next.js** (App Router) | 14.2.15 | Halaman web + API Route dalam satu proyek |
| UI | **React** | 18.3 | Komponen antarmuka |
| Bahasa | **TypeScript** | 5 | Tipe statis untuk seluruh kode |
| Styling | **Tailwind CSS** + PostCSS + Autoprefixer | 3.4 | Desain responsif (desktop & HP) |
| Ikon | **lucide-react** | 0.453 | Ikon antarmuka |
| Grafik | **Recharts** | 2.13 | Grafik pergerakan stok di dashboard |
| QR Code | **qrcode** | 1.5 | QR menuju bot Telegram |
| Validasi | **Zod** | 3.23 | Validasi input API |
| ORM | **Prisma** | 5.21 | Akses database, schema, migrasi |
| Database | **PostgreSQL** (Neon / Supabase) | - | Data barang, stok, tugas, log |
| Penyimpanan foto | **Vercel Blob** (produksi) / folder lokal (development) | 0.27 | Foto bukti pemasangan |
| Bot | **Telegram Bot API** (webhook) | - | Admin mengelola stok & tugas lewat Telegram |
| AI Asisten (Beta) | **OpenAI-compatible API** (mis. Qwen2.5-VL lokal) atau **Google Gemini** 2.5 Flash | - | Tanya-jawab stok dengan *tool calling* |
| Autentikasi | Cookie sesi bertanda tangan **HMAC-SHA256** (Web Crypto) + password **scrypt** | - | Login admin web |
| Hosting | **Vercel** (region `sin1` Singapura) | - | Server Next.js serverless |
| Kanal pemasang | **WhatsApp** (link dibagikan manual) | - | Pemasang menerima link upload bukti |

### Peta Tech Stack

```mermaid
flowchart TB
    subgraph CLIENT["Klien"]
        BROWSER["Browser Admin<br/>React 18 + Tailwind CSS<br/>Recharts, lucide-react"]
        HP["HP Pemasang<br/>Halaman bukti foto<br/>Kompres foto Canvas API"]
        TG["Aplikasi Telegram<br/>Admin"]
        WA["WhatsApp<br/>(berbagi link)"]
    end

    subgraph VERCEL["Vercel - region sin1 (Singapura)"]
        MW["Middleware Edge<br/>Cek cookie sesi HMAC"]
        PAGES["Next.js 14 App Router<br/>Halaman dashboard"]
        API["API Routes<br/>/api/*  (TypeScript + Zod)"]
        SVC["Services<br/>Inventory, Product, Report,<br/>InstallationTask, Notification,<br/>Telegram, TaskWizard, Assistant"]
        PRISMA["Prisma Client 5"]
    end

    subgraph EXT["Layanan Eksternal"]
        PG[("PostgreSQL<br/>Neon / Supabase")]
        BLOB[("Vercel Blob<br/>foto bukti")]
        TGAPI["Telegram Bot API"]
        AI["AI Provider<br/>OpenAI-compatible (Qwen)<br/>atau Google Gemini"]
    end

    BROWSER --> MW --> PAGES
    BROWSER -->|fetch JSON| MW --> API
    HP -->|/proof/token| API
    TG <--> TGAPI
    TGAPI -->|webhook POST| API
    WA -.link bukti.-> HP

    API --> SVC --> PRISMA --> PG
    SVC --> BLOB
    SVC -->|sendMessage / sendPhoto| TGAPI
    SVC --> AI
```

---

## 2. Arsitektur Berlapis

```mermaid
flowchart LR
    A["Presentasi<br/>src/app/(dashboard)<br/>src/components"] --> B["API Route<br/>src/app/api"]
    B --> C["Service / Logika Bisnis<br/>src/services"]
    C --> D["Library<br/>src/lib<br/>prisma, session, password,<br/>telegram-client, storage, ai, error-log"]
    D --> E[("PostgreSQL")]
    D --> F[("Vercel Blob")]
    D --> G["Telegram API"]
    D --> H["AI Provider"]
```

| Folder | Isi |
|---|---|
| `src/app/(auth)` | Halaman login |
| `src/app/(dashboard)` | Dashboard, Barang, Kategori, Barang Masuk/Keluar, Riwayat, Tugas, Laporan, Telegram, Pengguna, Log, Asisten AI, Pengaturan |
| `src/app/proof` | Halaman publik upload foto bukti (tanpa login) |
| `src/app/api` | REST API (JSON) |
| `src/services` | Logika bisnis (transaksi stok, tugas, notifikasi, bot, AI) |
| `src/lib` | Koneksi Prisma, sesi, hash password, klien Telegram, penyimpanan foto, provider AI, log error |
| `src/middleware.ts` | Penjaga akses: hanya admin login yang boleh masuk |
| `prisma/schema.prisma` | Struktur database |

---

## 3. Alur Login & Akses Halaman

```mermaid
sequenceDiagram
    autonumber
    actor Admin
    participant B as Browser
    participant MW as Middleware (Edge)
    participant API as /api/auth/login
    participant DB as PostgreSQL (Prisma)

    Admin->>B: Buka halaman dashboard
    B->>MW: GET /dashboard
    MW->>MW: Verifikasi cookie stockflow_session (HMAC-SHA256)
    alt Belum login / sesi kedaluwarsa
        MW-->>B: Redirect ke /login?next=/dashboard
        Admin->>B: Isi email dan password
        B->>API: POST email + password
        API->>DB: Cari user aktif
        API->>API: Cocokkan password (scrypt)
        API-->>B: Set cookie sesi (berlaku 7 hari)
        B->>MW: GET /dashboard
    end
    MW-->>B: Lanjut, halaman ditampilkan
```

Path publik tanpa login: `/login`, `/proof/*`, `/api/auth/login`, `/api/tasks/proof/*`, `/api/telegram/webhook` (dilindungi secret token), `/api/logs/client`.

---

## 4. Alur Utama: Tugas Pemasangan (Telegram → WhatsApp → Foto → Stok Berkurang)

Ini alur inti sistem. Stok **tidak** langsung berkurang saat tugas dibuat, tetapi saat pemasang mengirim foto bukti.

```mermaid
sequenceDiagram
    autonumber
    actor A as Admin (Telegram)
    participant T as Telegram Bot API
    participant W as Webhook Telegram<br/>/api/telegram/webhook
    participant S as TelegramService +<br/>TaskWizardService
    participant DB as PostgreSQL
    actor P as Pemasang (WhatsApp)
    participant PR as Halaman Bukti<br/>/proof/{token}
    participant U as API Upload Foto<br/>/api/tasks/proof/{token}/photo
    participant IS as InstallationTaskService +<br/>NotificationService
    participant BL as Vercel Blob

    Note over A,S: Tahap 1 - Admin membuat tugas lewat Telegram
    A->>T: Tekan "Buat tugas" atau kirim "bimo/lampu led/gsg/-"
    T->>W: POST update (header secret token)
    W->>S: handleWebhookUpdate
    S->>DB: Simpan TelegramUpdate (cegah update ganda)
    S->>DB: Cek stok tersedia = stok dikurangi tugas PENDING
    S->>DB: Buat InstallationTask (status PENDING, simpan hash token)
    S-->>W: Balasan + link /proof/{token}
    W->>T: sendMessage
    T-->>A: Ringkasan tugas + link bukti
    A->>P: Bagikan link lewat WhatsApp

    Note over P,BL: Tahap 2 - Pemasang mengirim foto bukti
    P->>PR: Buka link, ambil foto
    PR->>PR: Kompres foto di HP (maks 1600 px, JPEG 80 persen)
    PR->>U: POST foto bukti
    U->>IS: completeWithProof(token, foto)
    IS->>IS: Validasi tipe dan isi file (JPEG/PNG/WebP, maks 4 MB)
    IS->>BL: Simpan foto
    BL-->>IS: URL foto
    IS->>DB: Transaksi: kurangi stok, tugas COMPLETED,<br/>catat StockMovement OUT (source TELEGRAM)
    IS->>DB: Cek stok minimum, buat Notification jika perlu
    IS->>T: sendPhoto ke admin pembuat tugas
    T-->>A: Foto bukti + sisa stok
    U-->>PR: Sukses
    PR-->>P: "Bukti terkirim, terima kasih"
```

### Status Tugas

```mermaid
stateDiagram-v2
    [*] --> PENDING: Admin membuat tugas (stok dipesan, belum berkurang)
    PENDING --> COMPLETED: Pemasang upload foto (stok berkurang otomatis)
    COMPLETED --> [*]
```

---

## 5. Alur Bot Telegram (Penanganan Pesan)

```mermaid
flowchart TD
    START(["Pengguna scan QR<br/>t.me/bot?start=admin"]) --> S1["Tekan START<br/>kirim /start admin"]
    S1 --> WH["POST /api/telegram/webhook"]
    WH --> SEC{"Secret token<br/>cocok?"}
    SEC -- Tidak --> R401["401 + catat ErrorLog"]
    SEC -- Ya --> DUP{"update_id sudah<br/>PROCESSED?"}
    DUP -- Ya --> IGN["Abaikan (anti duplikat)"]
    DUP -- Tidak --> LINK["autoLinkAdmin:<br/>ID ada di TELEGRAM_ADMIN_IDS<br/>atau tabel TelegramAdmin?"]
    LINK --> REG{"Akun terdaftar?"}
    REG -- Tidak --> ID["Balas: tampilkan ID Telegram<br/>untuk ditambahkan admin di web"]
    REG -- Ya --> TYPE{"Jenis update"}
    TYPE -- "Tombol (callback)" --> CB["menu:stock / tasks / history /<br/>search / create_task / task:*"]
    TYPE -- "Teks" --> TX["/start, /stok, /cari, /tugas,<br/>/riwayat, /bantuan,<br/>format cepat a/b/c/d,<br/>langkah wizard"]
    CB --> RES["Hasil + keyboard menu"]
    TX --> RES
    RES --> SEND["editMessageText / sendMessage"]
```

Saat admin membuka halaman **Integrasi Telegram**, sistem memasang deskripsi bot, deskripsi singkat, dan daftar perintah (`setMyDescription`, `setMyShortDescription`, `setMyCommands`) agar pengguna baru tidak melihat chat kosong.

---

## 6. Alur Barang Masuk & Keluar dari Web

```mermaid
flowchart LR
    F["Form Barang Masuk<br/>/stock/in"] --> API1["POST /api/stock/in"]
    API1 --> INV["InventoryService.recordStockIn"]
    INV --> TX[("Transaksi Prisma:<br/>update Product.currentStock<br/>+ StockMovement IN")]
    TX --> HIS["Riwayat /stock/history"]

    K["Barang Keluar"] --> TASK["Lewat Tugas Pemasangan<br/>(lihat Alur 4)"]
    TASK --> TX2[("StockMovement OUT")]
    TX2 --> NOTIF["NotificationService<br/>cek stok minimum"]
    NOTIF -->|stok ≤ minimum / habis| N1["Notification LOW_STOCK /<br/>OUT_OF_STOCK<br/>(maks 1x per produk per hari)"]
    N1 --> BELL["Lonceng notifikasi web"]
    N1 --> TGN["Pesan Telegram ke admin"]
```

Setiap perubahan stok selalu mencatat `stockBefore` dan `stockAfter` di tabel `StockMovement`, sehingga riwayat bisa diaudit.

---

## 7. Alur Asisten AI (Beta)

```mermaid
sequenceDiagram
    autonumber
    actor A as Admin
    participant UI as /assistant (AssistantChat)
    participant API as /api/assistant
    participant AS as AssistantService
    participant AI as AI Provider<br/>(Qwen OpenAI-compatible / Gemini)
    participant DB as PostgreSQL

    A->>UI: "Stok lampu LED tinggal berapa?"
    UI->>API: POST riwayat chat
    API->>AS: ask(history)
    AS->>AI: Prompt sistem + pertanyaan + daftar tools
    AI-->>AS: Panggil tool cek_stok("lampu led")
    AS->>DB: Query Product (read-only)
    DB-->>AS: Data stok
    AS->>AI: Hasil tool
    AI-->>AS: Jawaban bahasa Indonesia
    AS-->>UI: Jawaban
```

Tools yang tersedia untuk AI (hanya membaca data): `cek_stok`, `cari_tugas_pemasangan`, `riwayat_stok`. Jika model tidak mendukung *tool calling*, sistem mengulang tanpa tools.

---

## 8. Alur Pencatatan Error

```mermaid
flowchart LR
    W["Error di API web"] --> L["logError()"]
    T["Error bot Telegram"] --> L
    U["Error upload foto"] --> L
    N["Gagal kirim notifikasi"] --> L
    AI["Error AI"] --> L
    BR["Error JavaScript di browser<br/>BrowserErrorReporter"] -->|POST /api/logs/client| L
    L --> DB[("Tabel ErrorLog<br/>source: WEB, TELEGRAM, UPLOAD,<br/>NOTIFICATION, AI, BROWSER<br/>level: ERROR / WARNING")]
    DB --> PAGE["Halaman /logs"]
```

---

## 9. Struktur Data (Ringkas)

```mermaid
erDiagram
    User ||--o{ StockMovement : "mencatat"
    User ||--o{ InstallationTask : "membuat"
    User ||--o| TelegramUser : "terhubung"
    Category ||--o{ Product : "mengelompokkan"
    Product ||--o{ StockMovement : "punya riwayat"
    Product ||--o{ InstallationTask : "dipasang"
    Product ||--o{ Notification : "memicu"

    User {
        string email
        string role
        bool isActive
    }
    Product {
        string sku
        string name
        int currentStock
        int minimumStock
        string unit
    }
    StockMovement {
        string type "IN / OUT"
        int quantity
        int stockBefore
        int stockAfter
        string source "WEB / TELEGRAM"
    }
    InstallationTask {
        int quantity
        string assigneeName
        string location
        string status "PENDING / COMPLETED"
        string tokenHash
        string proofFileName
    }
    TelegramUser {
        string telegramUserId
        string telegramChatId
    }
    Notification {
        string type "LOW_STOCK / OUT_OF_STOCK"
        string dedupeKey
        bool isRead
    }
```

Tabel pendukung lain: `TelegramAdmin` (ID admin yang diizinkan), `TelegramUpdate` (log & anti duplikat webhook), `TelegramConversation` (status wizard bot), `ErrorLog`.

---

## 10. Deployment

```mermaid
flowchart LR
    DEV["Developer<br/>VS Code"] -->|git push main| GH["GitHub<br/>Stok_Bot"]
    GH -->|auto deploy| VC["Vercel Build<br/>prisma generate + next build"]
    VC --> RUN["Vercel Functions<br/>region sin1"]
    RUN --> PG[("PostgreSQL")]
    RUN --> BL[("Vercel Blob")]
    TGS["Telegram"] -->|webhook| RUN
```

Variabel lingkungan utama: `DATABASE_URL`, `AUTH_SECRET`, `APP_URL`, `TELEGRAM_BOT_TOKEN`, `TELEGRAM_WEBHOOK_SECRET`, `TELEGRAM_BOT_USERNAME`, `TELEGRAM_ADMIN_IDS`, `BLOB_READ_WRITE_TOKEN`, `AI_PROVIDER`, `OPENAI_BASE_URL` / `OPENAI_MODEL` atau `GEMINI_API_KEY`.
