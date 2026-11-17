# StockFlow - Paket Dokumentasi

Paket ini berisi lima dokumen perencanaan dan rancangan untuk membangun StockFlow, sistem inventory berbasis website dengan integrasi Telegram.

## Isi folder
1. `01-PRD.md` - tujuan produk, pengguna, ruang lingkup, fitur, aturan bisnis, dan kriteria keberhasilan.
2. `02-Schema_Database.md` - ERD, tabel, relasi, constraint, contoh Prisma schema, dan aturan integritas.
3. `03-MVP.md` - prioritas fitur, sprint, user stories, pengujian, UAT, dan kriteria go-live.
4. `04-Desain-UI-UX.md` - navigasi, layout, design tokens, spesifikasi halaman, microcopy, dan aksesibilitas.
5. `05-Arsitektur.md` - diagram sistem, alur Telegram, struktur folder, API, keamanan, deployment, dan monitoring.

## Urutan membaca
Mulai dari PRD → MVP → UI/UX → Database Schema → Arsitektur. Saat implementasi, developer sebaiknya membaca Database Schema dan Arsitektur secara bersamaan.

## Catatan
Dokumen ini adalah rancangan awal berdasarkan konsep StockFlow yang diberikan. Beberapa keputusan operasional masih perlu dikonfirmasi sebelum production, terutama kebijakan approval pengambilan, linking Telegram, satuan dasar, dan aturan adjustment stok.
