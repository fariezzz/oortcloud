# Cloud Drive (OortCloud Storage)

Aplikasi web manajemen penyimpanan awan pribadi (*private cloud storage*) berbasis web modern bergaya **Google Drive** yang terhubung langsung ke server virtualisasi **Proxmox VE (LXC Container `server-3`)**.

Aplikasi ini dapat dijalankan secara lokal di Windows maupun di-deploy langsung di dalam server Proxmox dengan reverse proxy **Nginx (Port 80)** dan dapat diakses secara publik oleh siapa saja di internet tanpa memerlukan VPN melalui **Cloudflare Tunnel (`drive.kiraya.my.id`)**.

---

## Fitur Utama

* **Antarmuka Google Drive (Tema Terang Hijau Daun):**
  Desain clean dan responsif dengan palet warna hijau daun alami (*leaf green* `#16a34a`), ramah digunakan di desktop maupun layar ponsel/tablet.
* **Sidebar Sticky & Non-Scrollable:**
  Sidebar navigasi terkunci rapi di sisi kiri layar dengan tinggi pas, tanpa scrollbar internal yang mengganggu, menyisakan area kerja berkas (*workspace*) yang dapat di-scroll secara bebas dan independen.
* **Full-Screen Invisible Drag & Drop Upload:**
  Area unggah banner konvensional digantikan dengan pendeteksi seret berkas satu layar penuh (*full-screen drop overlay*). Cukup tarik berkas dari komputer ke area peramban mana saja untuk mengunggah secara instan.
* **Unggahan Tanpa Batasan Ukuran Per-Item:**
  Tidak ada batasan ukuran berkas (unlimited file size). Ukuran berkas hanya dibatasi oleh sisa kapasitas penyimpanan riil server Proxmox.
* **Pemantau Kapasitas & Sisa Storage Real-Time:**
  Menghitung kapasitas terpakai, sisa ruang penyimpanan bebas (MB / GB), serta bilah meteran visual berdasarkan kuota alokasi disk server (default: 4 GB).
* **Fitur Ganti Nama Berkas (Rename):**
  Mengubah nama berkas asli kapan saja langsung dari antarmuka web melalui endpoint `PATCH /api/files/:storageKey/rename`, dengan pengamanan otomatis menjaga ekstensi asli berkas.
* **Indikator Loading Unduhan Interaktif:**
  Tombol unduh dilengkapi feedback animasi spinner berputar (`animate-spin`) dan notifikasi status persiapan unduhan sebelum berkas tersimpan ke komputer dengan nama aslinya.
* **Pratinjau Multi-Format (Instant Preview):**
  Pratinjau langsung di dalam browser tanpa perlu mengunduh terlebih dahulu:
  * Gambar (PNG, JPG, JPEG, WEBP, GIF, SVG)
  * Pemutar Video (MP4, WEBM)
  * Pemutar Audio (MP3, WAV, OGG, FLAC) dengan petunjuk teks
  * Dokumen PDF (Viewer interaktif)
  * File teks dan kode (TXT, JSON, MD, JS, HTML, CSS, CSV)
* **Mode Tampilan Ganda:**
  Beralih antara **Tampilan Kisi (Grid View)** berupa kartu thumbnail dan **Tampilan Daftar (List View)** berupa tabel data ringkas.
* **Pencarian Cepat & Filter Kategori:**
  Pencarian instan berdasarkan nama berkas serta filter kategori: Drive Saya (Semua), Dokumen, Gambar, Audio, Video, Arsip, dan Lainnya.
* **Akses Publik 24/7 Tanpa VPN:**
  Dapat diekspos ke publik menggunakan Cloudflare Tunnel resmi di bawah subdomain `https://drive.kiraya.my.id` (bebas kuota bandwidth dan otomatis HTTPS).

---

## Arsitektur Sistem

```text
[ Browser Klien (Desktop / Mobile) ]
                 │
                 │ HTTPS (Port 443) / HTTP (Port 80)
                 ▼
[ Nginx Reverse Proxy / Cloudflare Edge ]
                 │
                 │ Proxy Internal ke Port 4000
                 ▼
[ Web Client Application (Express) ] (Port 4000)
  - Lokasi: /var/www/oortcloud (Server) atau Lokal (Windows)
  - Metadata: data/catalog.json
                 │
                 │ REST API Call (Loopback: http://127.0.0.1:3000)
                 ▼
[ Storage REST API Service ] (Port 3000)
  - Lokasi: /opt/oortcloud-storage/server.js
                 │
                 │ File System Operations
                 ▼
[ Direktori Berkas Fisik: /data/oortcloud/ ]
```

---

## Struktur Berkas Project

```text
cloud-storage/
├── config.json              # Konfigurasi endpoint server target dan kuota disk
├── data/
│   └── catalog.json         # Penyimpanan persisten metadata berkas
├── nginx/
│   └── oortcloud.conf       # Konfigurasi Nginx Virtual Host (Port 80 Reverse Proxy)
├── setup-nginx.sh           # Script bash otomasi konfigurasi Nginx di server
├── package.json             # Dependensi Node.js (express, cors, multer)
├── server.js                # Backend Express, reverse proxy API, dan handler rename
├── start.bat                # Script peluncur cepat untuk sistem operasi Windows
├── README.md                # Ringkasan informasi dan panduan penggunaan project ini
├── PANDUAN.md               # Dokumentasi detail fitur dan alur REST API
├── DEPLOY_SERVER.md         # Panduan deployment di server Proxmox berbasis Git & Nginx
├── CLOUDFLARE_TUNNEL.md     # Panduan setup Cloudflare Tunnel domain kiraya.my.id
├── LAPORAN_DEPLOYMENT.md    # Laporan teknis lengkap arsitektur dan evaluasi sistem
└── public/
    ├── index.html           # Antarmuka web utama (Tailwind CSS, Bootstrap Icons)
    ├── style.css            # Styling tema hijau daun, scrollbar halus, dan drawer
    └── app.js               # Logika klien: drag-drop, download, rename, preview, tema
```

---

## Panduan Menjalankan Secara Lokal (Windows)

### 1. Instalasi Dependensi
Buka terminal (PowerShell, Command Prompt, atau Terminal VS Code) di folder project:
```bash
cd "C:\Users\ASUS\Documents\Web Projects\cloud-storage"
npm install
```

### 2. Konfigurasi Endpoint Server
Periksa berkas `config.json`. Pastikan `serverUrl` mengarah ke endpoint backend server Proxmox yang aktif:
```json
{
  "serverUrl": "https://unvitrifiable-alecia-undeprecatingly.ngrok-free.dev",
  "port": 4000,
  "totalStorageQuotaGB": 4
}
```

### 3. Jalankan Aplikasi
```bash
npm start
```
*(Atau klik ganda berkas `start.bat` di File Explorer).*

Buka peramban di:
👉 **`http://localhost:4000`**

---

## Panduan Deployment di Server Proxmox (Nginx & Cloudflare Tunnel)

Untuk menjalankan aplikasi secara permanen 24/7 di server Proxmox LXC (`server-3`):

### 1. Clone Repositori di Server
Di terminal Proxmox (user `root`):
```bash
mkdir -p /var/www
git clone <URL_REPOSITORY_GIT_ANDA> /var/www/oortcloud
cd /var/www/oortcloud
npm install --omit=dev
```

### 2. Set Konfigurasi Loopback Internal di Server
Ubah `config.json` di server agar berkomunikasi langsung ke backend internal port 3000:
```json
{
  "serverUrl": "http://127.0.0.1:3000",
  "port": 4000,
  "totalStorageQuotaGB": 4
}
```

### 3. Jalankan dengan PM2 (Auto-Restart & Background)
```bash
pm2 start /opt/oortcloud-storage/server.js --name "storage-backend"
pm2 start server.js --name "oortcloud-web"
pm2 save && pm2 startup
```

### 4. Setup Nginx Reverse Proxy (Port 80)
Cukup jalankan script otomasi yang telah disertakan:
```bash
cd /var/www/oortcloud
bash setup-nginx.sh
```
Aplikasi kini melayani port 80 melalui alamat IP lokal server: `http://<IP_SERVER_PROXMOX>/`.

### 5. Hubungkan ke Domain Publik via Cloudflare Tunnel
Pasang konektor `cloudflared` di server Proxmox dan arahkan hostname publik di dashboard Cloudflare Zero Trust:
* **Public Hostname:** `drive.kiraya.my.id`
* **Service:** `HTTP` ➔ `localhost:80`

Aplikasi web dapat diakses oleh siapa saja di internet melalui:
👉 **`https://drive.kiraya.my.id`**

---

## Dokumentasi Tambahan

Untuk panduan konfigurasi yang lebih spesifik, silakan buka dokumentasi pendukung berikut:
* **[DEPLOY_SERVER.md](./DEPLOY_SERVER.md):** Langkah-langkah detail deployment mandiri di server Proxmox dengan Git, PM2, dan Nginx IP Address.
* **[CLOUDFLARE_TUNNEL.md](./CLOUDFLARE_TUNNEL.md):** Panduan langkah demi langkah setup Cloudflare Tunnel Zero Trust untuk domain `drive.kiraya.my.id`.
* **[LAPORAN_DEPLOYMENT.md](./LAPORAN_DEPLOYMENT.md):** Laporan teknis komprehensif implementasi dan evaluasi sistem (BAB 1 s/d BAB 6).
* **[PANDUAN.md](./PANDUAN.md):** Rincian spesifikasi endpoint REST API dan arsitektur data katalog.

---

## Identitas Pengembang

* **Nama:** Muhammad Fariez Riziq Ilham
* **NIM:** 247006111146
* **Program Studi:** Informatika, Fakultas Teknik, Universitas Siliwangi
* **Kelas:** Informatika E
