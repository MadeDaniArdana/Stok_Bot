# Use Case & Activity Diagram (PlantUML) - StockFlow

Diagram UML untuk laporan, disusun sesuai fitur yang ada di kode saat ini.

> **Cara copas:**
> 1. Buka https://www.plantuml.com/plantuml/uml (atau ekstensi *PlantUML* di VS Code).
> 2. Salin seluruh isi satu blok, **mulai `@startuml` sampai `@enduml`**.
> 3. Tempel lalu klik **Submit**. Gambar bisa diunduh sebagai PNG atau SVG.
>
> Setiap blok lengkap dan berdiri sendiri.

---

## 1. Use Case Diagram

### Daftar Aktor

| Aktor | Keterangan |
|---|---|
| Admin | Admin gudang yang login ke web |
| Admin Telegram | Admin yang ID Telegram-nya sudah diizinkan, memakai bot |
| Calon Admin Telegram | Pengguna Telegram yang belum terdaftar |
| Pemasang | Petugas lapangan, menerima link lewat WhatsApp, tidak perlu akun |
| Layanan AI | Sistem eksternal (Qwen/Gemini) untuk asisten AI |

### 1a. Use Case Diagram Lengkap

```plantuml
@startuml UseCase_StockFlow
left to right direction
skinparam packageStyle rectangle
skinparam actorStyle awesome
skinparam usecase {
  BackgroundColor #FFF7F8
  BorderColor #7A1630
}
skinparam rectangle {
  BorderColor #7A1630
}

actor "Admin" as Admin
actor "Admin Telegram" as AdminTG
actor "Calon Admin\nTelegram" as Calon
actor "Pemasang" as Pemasang
actor "Layanan AI\n(Qwen / Gemini)" as AI <<system>>

rectangle "Sistem StockFlow" {

  package "Aplikasi Web" {
    usecase "Login" as UC_Login
    usecase "Logout" as UC_Logout
    usecase "Melihat Dashboard" as UC_Dash
    usecase "Mengelola Barang" as UC_Barang
    usecase "Mengelola Kategori" as UC_Kategori
    usecase "Mencatat Barang Masuk" as UC_Masuk
    usecase "Melihat Riwayat Transaksi" as UC_Riwayat
    usecase "Membuat Koreksi\nPembalik Transaksi" as UC_Koreksi
    usecase "Melihat Laporan\nPemasangan" as UC_LapTugas
    usecase "Melihat Laporan Stok" as UC_Laporan
    usecase "Melihat Notifikasi\nStok Menipis" as UC_Notif
    usecase "Mengelola Admin Telegram\n(QR dan ID Telegram)" as UC_KelolaTG
    usecase "Mengelola Pengguna" as UC_User
    usecase "Melihat Log Error" as UC_Log
    usecase "Bertanya ke\nAsisten AI" as UC_AI
  }

  package "Bot Telegram" {
    usecase "Memulai Bot (/start)" as UC_Start
    usecase "Melihat ID Telegram" as UC_LihatID
    usecase "Cek Stok" as UC_Stok
    usecase "Cari Barang" as UC_Cari
    usecase "Melihat Tugas Terbaru" as UC_ListTugas
    usecase "Melihat Riwayat Stok" as UC_RiwayatTG
    usecase "Membuat Tugas\nPemasangan" as UC_Tugas
    usecase "Format Cepat\nSatu Baris" as UC_Cepat
    usecase "Membagikan Link Bukti\nke Pemasang" as UC_Bagikan
    usecase "Menerima Notifikasi\ndan Foto Bukti" as UC_TerimaNotif
  }

  package "Halaman Bukti Pemasangan" {
    usecase "Membuka Link Bukti" as UC_Link
    usecase "Mengunggah Foto Bukti" as UC_Upload
    usecase "Mengompres Foto" as UC_Kompres
    usecase "Mengurangi Stok\nOtomatis" as UC_Kurangi
  }
}

' ===== Admin Web =====
Admin --> UC_Login
Admin --> UC_Logout
Admin --> UC_Dash
Admin --> UC_Barang
Admin --> UC_Kategori
Admin --> UC_Masuk
Admin --> UC_Riwayat
Admin --> UC_LapTugas
Admin --> UC_Laporan
Admin --> UC_Notif
Admin --> UC_KelolaTG
Admin --> UC_User
Admin --> UC_Log
Admin --> UC_AI

UC_Dash ..> UC_Login : <<include>>
UC_Barang ..> UC_Login : <<include>>
UC_Kategori ..> UC_Login : <<include>>
UC_Masuk ..> UC_Login : <<include>>
UC_Riwayat ..> UC_Login : <<include>>
UC_LapTugas ..> UC_Login : <<include>>
UC_Laporan ..> UC_Login : <<include>>
UC_Notif ..> UC_Login : <<include>>
UC_KelolaTG ..> UC_Login : <<include>>
UC_User ..> UC_Login : <<include>>
UC_Log ..> UC_Login : <<include>>
UC_AI ..> UC_Login : <<include>>
UC_Koreksi .> UC_Riwayat : <<extend>>
UC_AI --> AI

' ===== Calon Admin Telegram =====
Calon --> UC_Start
UC_LihatID .> UC_Start : <<extend>>

' ===== Admin Telegram =====
AdminTG --> UC_Start
AdminTG --> UC_Stok
AdminTG --> UC_Cari
AdminTG --> UC_ListTugas
AdminTG --> UC_RiwayatTG
AdminTG --> UC_Tugas
AdminTG --> UC_Bagikan
AdminTG --> UC_TerimaNotif
UC_Cepat .> UC_Tugas : <<extend>>

' ===== Pemasang =====
Pemasang --> UC_Link
Pemasang --> UC_Upload
UC_Upload ..> UC_Kompres : <<include>>
UC_Upload ..> UC_Kurangi : <<include>>
@enduml
```

### 1b. Use Case Diagram Dipecah (opsional, lebih mudah dibaca)

Jika diagram lengkap terlalu padat untuk satu halaman laporan, gunakan dua diagram berikut.

**Use Case Aplikasi Web**

```plantuml
@startuml UseCase_Web
left to right direction
skinparam actorStyle awesome
skinparam usecase {
  BackgroundColor #FFF7F8
  BorderColor #7A1630
}

actor "Admin" as Admin
actor "Layanan AI\n(Qwen / Gemini)" as AI <<system>>

rectangle "Aplikasi Web StockFlow" {
  usecase "Login" as UC_Login
  usecase "Logout" as UC_Logout
  usecase "Melihat Dashboard" as UC_Dash
  usecase "Mengelola Barang" as UC_Barang
  usecase "Mengelola Kategori" as UC_Kategori
  usecase "Mencatat Barang Masuk" as UC_Masuk
  usecase "Melihat Riwayat Transaksi" as UC_Riwayat
  usecase "Membuat Koreksi\nPembalik Transaksi" as UC_Koreksi
  usecase "Melihat Laporan\nPemasangan" as UC_LapTugas
  usecase "Melihat Laporan Stok" as UC_Laporan
  usecase "Melihat Notifikasi\nStok Menipis" as UC_Notif
  usecase "Mengelola Admin Telegram\n(QR dan ID Telegram)" as UC_KelolaTG
  usecase "Mengelola Pengguna" as UC_User
  usecase "Melihat Log Error" as UC_Log
  usecase "Bertanya ke\nAsisten AI" as UC_AI
}

Admin --> UC_Login
Admin --> UC_Logout
Admin --> UC_Dash
Admin --> UC_Barang
Admin --> UC_Kategori
Admin --> UC_Masuk
Admin --> UC_Riwayat
Admin --> UC_LapTugas
Admin --> UC_Laporan
Admin --> UC_Notif
Admin --> UC_KelolaTG
Admin --> UC_User
Admin --> UC_Log
Admin --> UC_AI

UC_Dash ..> UC_Login : <<include>>
UC_Barang ..> UC_Login : <<include>>
UC_Kategori ..> UC_Login : <<include>>
UC_Masuk ..> UC_Login : <<include>>
UC_Riwayat ..> UC_Login : <<include>>
UC_LapTugas ..> UC_Login : <<include>>
UC_Laporan ..> UC_Login : <<include>>
UC_Notif ..> UC_Login : <<include>>
UC_KelolaTG ..> UC_Login : <<include>>
UC_User ..> UC_Login : <<include>>
UC_Log ..> UC_Login : <<include>>
UC_AI ..> UC_Login : <<include>>
UC_Koreksi .> UC_Riwayat : <<extend>>
UC_AI --> AI
@enduml
```

**Use Case Bot Telegram dan Pemasang**

```plantuml
@startuml UseCase_Telegram
left to right direction
skinparam actorStyle awesome
skinparam usecase {
  BackgroundColor #FFF7F8
  BorderColor #7A1630
}

actor "Calon Admin\nTelegram" as Calon
actor "Admin Telegram" as AdminTG
actor "Pemasang" as Pemasang

rectangle "Bot Telegram StockFlow" {
  usecase "Memulai Bot (/start)" as UC_Start
  usecase "Melihat ID Telegram" as UC_LihatID
  usecase "Cek Stok" as UC_Stok
  usecase "Cari Barang" as UC_Cari
  usecase "Melihat Tugas Terbaru" as UC_ListTugas
  usecase "Melihat Riwayat Stok" as UC_RiwayatTG
  usecase "Membuat Tugas\nPemasangan" as UC_Tugas
  usecase "Format Cepat\nSatu Baris" as UC_Cepat
  usecase "Membagikan Link Bukti\nke Pemasang" as UC_Bagikan
  usecase "Menerima Notifikasi\ndan Foto Bukti" as UC_TerimaNotif
}

rectangle "Halaman Bukti Pemasangan" {
  usecase "Membuka Link Bukti" as UC_Link
  usecase "Mengunggah Foto Bukti" as UC_Upload
  usecase "Mengompres Foto" as UC_Kompres
  usecase "Mengurangi Stok\nOtomatis" as UC_Kurangi
}

Calon --> UC_Start
UC_LihatID .> UC_Start : <<extend>>

AdminTG --> UC_Start
AdminTG --> UC_Stok
AdminTG --> UC_Cari
AdminTG --> UC_ListTugas
AdminTG --> UC_RiwayatTG
AdminTG --> UC_Tugas
AdminTG --> UC_Bagikan
AdminTG --> UC_TerimaNotif
UC_Cepat .> UC_Tugas : <<extend>>

Pemasang --> UC_Link
Pemasang --> UC_Upload
UC_Upload ..> UC_Kompres : <<include>>
UC_Upload ..> UC_Kurangi : <<include>>
@enduml
```

---

## 2. Activity Diagram

Semua activity diagram memakai **swimlane** (kolom per aktor/sistem).

### 2.1 Login Admin

```plantuml
@startuml Activity_Login
skinparam ActivityBackgroundColor #FFF7F8
skinparam ActivityBorderColor #7A1630
skinparam SwimlaneTitleFontStyle bold

|Admin|
start
:Membuka alamat web StockFlow;
|Sistem|
:Memeriksa cookie sesi;
if (Sesi valid?) then (ya)
  :Menampilkan dashboard;
  |Admin|
  stop
else (tidak)
  :Menampilkan halaman login;
endif
|Admin|
repeat
  :Mengisi email dan password;
  :Menekan tombol Masuk;
  |Sistem|
  :Mencari akun admin aktif;
  :Mencocokkan password (scrypt);
  backward:Menampilkan pesan\nemail atau password salah;
repeat while (Data valid?) is (tidak) not (ya)
:Membuat cookie sesi (berlaku 7 hari);
:Menampilkan dashboard;
|Admin|
stop
@enduml
```

### 2.2 Mencatat Barang Masuk

```plantuml
@startuml Activity_BarangMasuk
skinparam ActivityBackgroundColor #FFF7F8
skinparam ActivityBorderColor #7A1630
skinparam SwimlaneTitleFontStyle bold

|Admin|
start
:Membuka menu Barang Masuk;
|Sistem|
:Menampilkan daftar barang aktif\nbeserta stok saat ini;
|Admin|
:Memilih barang;
:Mengisi jumlah dan catatan;
:Menekan tombol Simpan;
|Sistem|
if (Jumlah bilangan bulat > 0\ndan barang aktif?) then (ya)
  :Menambah stok barang;
  :Mencatat StockMovement IN\n(stok sebelum dan sesudah);
  :Menampilkan notifikasi berhasil;
else (tidak)
  :Menampilkan pesan kesalahan;
endif
|Admin|
stop
@enduml
```

### 2.3 Membuat Tugas Pemasangan sampai Stok Berkurang (Alur Utama)

```plantuml
@startuml Activity_TugasPemasangan
skinparam ActivityBackgroundColor #FFF7F8
skinparam ActivityBorderColor #7A1630
skinparam SwimlaneTitleFontStyle bold

|Admin Telegram|
start
:Membuka bot Telegram;
if (Cara membuat tugas?) then (menu tombol)
  :Menekan "Buat Tugas Pemasangan";
  |Sistem (Bot)|
  :Menampilkan daftar barang aktif;
  |Admin Telegram|
  :Memilih barang\n(tombol atau ketik nama);
  |Sistem (Bot)|
  :Menampilkan pilihan jumlah;
  |Admin Telegram|
  :Memilih atau mengetik jumlah;
  :Mengetik nama pemasang;
  :Mengetik lokasi pemasangan;
  :Mengetik catatan atau menekan Lewati;
  |Sistem (Bot)|
  :Menampilkan ringkasan tugas;
  |Admin Telegram|
  if (Konfirmasi?) then (Buat tugas)
  else (Batal)
    |Sistem (Bot)|
    :Membatalkan proses\ndan kembali ke menu;
    |Admin Telegram|
    stop
  endif
else (format cepat)
  :Mengirim satu baris\n"pemasang/barang/lokasi/catatan";
endif
|Sistem (Bot)|
:Menghitung stok tersedia\n(stok dikurangi tugas PENDING);
if (Stok cukup?) then (ya)
  :Membuat tugas berstatus PENDING\ndan token link bukti;
  :Mengirim ringkasan + link bukti;
else (tidak)
  :Menampilkan pesan stok tidak cukup;
  |Admin Telegram|
  stop
endif
|Admin Telegram|
:Membagikan link bukti\nke pemasang lewat WhatsApp;
|Pemasang|
:Membuka link bukti di HP;
|Sistem (Web)|
:Menampilkan detail tugas\n(barang, jumlah, lokasi);
|Pemasang|
:Memasang barang di lokasi;
:Mengambil foto bukti;
|Sistem (Web)|
:Mengompres foto di HP\n(maks 1600 px, JPEG 80 persen);
|Pemasang|
:Menekan tombol Kirim Bukti;
|Sistem (Web)|
if (Foto valid dan tugas masih PENDING?) then (ya)
  :Menyimpan foto ke Vercel Blob;
  :Mengurangi stok barang;
  :Mengubah status tugas menjadi COMPLETED;
  :Mencatat StockMovement OUT;
  if (Stok di bawah atau sama dengan minimum?) then (ya)
    :Membuat notifikasi stok menipis/habis;
  else (tidak)
  endif
  :Mengirim foto bukti dan sisa stok\nke Telegram admin;
  :Menampilkan "Bukti terkirim";
else (tidak)
  :Menampilkan pesan kesalahan;
endif
|Pemasang|
stop
@enduml
```

### 2.4 Pendaftaran Admin Telegram (Scan QR)

```plantuml
@startuml Activity_DaftarAdminTelegram
skinparam ActivityBackgroundColor #FFF7F8
skinparam ActivityBorderColor #7A1630
skinparam SwimlaneTitleFontStyle bold

|Admin|
start
:Membuka menu Integrasi Telegram;
|Sistem|
:Memasang deskripsi dan menu perintah bot;
:Menampilkan QR bot (link ?start=admin);
|Admin|
:Memberikan QR ke calon admin;
|Calon Admin Telegram|
:Memindai QR;
:Menekan tombol Mulai / Start;
|Sistem|
if (ID Telegram sudah diizinkan?) then (ya)
  :Menautkan akun Telegram ke admin;
  :Menampilkan menu utama bot;
  |Calon Admin Telegram|
  stop
else (tidak)
  :Menampilkan ID Telegram pengguna;
  :Menampilkan pengguna di daftar\ncalon admin pada web;
endif
|Admin|
:Menambahkan ID sebagai admin Telegram;
|Sistem|
:Menyimpan ID ke daftar admin;
|Calon Admin Telegram|
:Mengirim /start kembali;
|Sistem|
:Menautkan akun dan menampilkan menu utama;
|Calon Admin Telegram|
stop
@enduml
```

### 2.5 Bertanya ke Asisten AI

```plantuml
@startuml Activity_AsistenAI
skinparam ActivityBackgroundColor #FFF7F8
skinparam ActivityBorderColor #7A1630
skinparam SwimlaneTitleFontStyle bold

|Admin|
start
:Membuka menu Asisten AI;
:Mengetik pertanyaan\n(contoh: stok lampu LED berapa?);
|Sistem|
:Mengirim pertanyaan + daftar tools\nke Layanan AI;
|Layanan AI|
if (Perlu data dari database?) then (ya)
  :Memanggil tool\n(cek_stok / cari_tugas_pemasangan / riwayat_stok);
  |Sistem|
  :Menjalankan query baca-saja ke database;
  :Mengirim hasil ke Layanan AI;
  |Layanan AI|
else (tidak)
endif
:Menyusun jawaban bahasa Indonesia;
|Sistem|
:Menampilkan jawaban di chat;
|Admin|
stop
@enduml
```
