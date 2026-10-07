const express = require("express");
const cors = require("cors");
const multer = require("multer");
const path = require("path");
const fs = require("fs");

// Inisialisasi Express
const app = express();
const DATA_DIR = path.join(__dirname, "data");
const CONFIG_PATH = path.join(__dirname, "config.json");
const CATALOG_PATH = path.join(DATA_DIR, "catalog.json");

// Pastikan folder data tersedia
if (!fs.existsSync(DATA_DIR)) {
  fs.mkdirSync(DATA_DIR, { recursive: true });
}

// Inisialisasi katalog jika belum ada
if (!fs.existsSync(CATALOG_PATH)) {
  fs.writeFileSync(CATALOG_PATH, JSON.stringify([], null, 2), "utf8");
}

// Pembacaan konfigurasi
function loadConfig() {
  try {
    if (fs.existsSync(CONFIG_PATH)) {
      const raw = fs.readFileSync(CONFIG_PATH, "utf8");
      return JSON.parse(raw);
    }
  } catch (err) {
    console.error("Gagal membaca config.json, menggunakan konfigurasi default:", err.message);
  }
  return {
    serverUrl: "https://unvitrifiable-alecia-undeprecatingly.ngrok-free.dev",
    port: 4000,
    totalStorageQuotaGB: 4,
  };
}

// Penyimpanan konfigurasi
function saveConfig(cfg) {
  fs.writeFileSync(CONFIG_PATH, JSON.stringify(cfg, null, 2), "utf8");
}

// Pembacaan katalog berkas
function loadCatalog() {
  try {
    if (fs.existsSync(CATALOG_PATH)) {
      const raw = fs.readFileSync(CATALOG_PATH, "utf8");
      return JSON.parse(raw);
    }
  } catch (err) {
    console.error("Gagal membaca catalog.json:", err.message);
  }
  return [];
}

// Penyimpanan katalog berkas
function saveCatalog(catalog) {
  fs.writeFileSync(CATALOG_PATH, JSON.stringify(catalog, null, 2), "utf8");
}

// Penentuan kategori berkas berdasarkan ekstensi / MIME type
function determineCategory(mimeType, filename) {
  const ext = path.extname(filename).toLowerCase();

  if (mimeType.startsWith("image/") || [".jpg", ".jpeg", ".png", ".gif", ".webp", ".svg", ".bmp"].includes(ext)) {
    return "image";
  }
  if (mimeType.startsWith("audio/") || [".mp3", ".wav", ".ogg", ".aac", ".flac", ".m4a"].includes(ext)) {
    return "audio";
  }
  if (mimeType.startsWith("video/") || [".mp4", ".webm", ".mkv", ".mov", ".avi"].includes(ext)) {
    return "video";
  }
  if (
    mimeType.includes("pdf") ||
    mimeType.includes("document") ||
    mimeType.includes("text") ||
    [".pdf", ".txt", ".doc", ".docx", ".xls", ".xlsx", ".ppt", ".pptx", ".csv", ".json", ".md"].includes(ext)
  ) {
    return "document";
  }
  if ([".zip", ".tar", ".gz", ".7z", ".rar"].includes(ext)) {
    return "archive";
  }
  return "other";
}

// Konfigurasi Multer (Penyimpanan memori sementara untuk diteruskan ke Proxmox)
// Tanpa batasan ukuran file per-item, dibatasi langsung oleh total kapasitas storage
const storage = multer.memoryStorage();
const upload = multer({
  storage,
});

// Middleware standar
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(express.static(path.join(__dirname, "public")));

// ============================================================================
// ROUTE API
// ============================================================================

// Helper header untuk bypass interstitial ngrok
const PROXMOX_REQUEST_HEADERS = {
  "ngrok-skip-browser-warning": "true",
  "User-Agent": "ProxmoxCloudStorageClient/1.0",
};

// 1. Status & Cek Kesehatan Server Proxmox
app.get("/api/status", async (req, res) => {
  const config = loadConfig();
  const startTime = Date.now();

  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 6000);

    const response = await fetch(`${config.serverUrl}/health`, {
      method: "GET",
      headers: PROXMOX_REQUEST_HEADERS,
      signal: controller.signal,
    });
    clearTimeout(timeoutId);

    const latency = Date.now() - startTime;
    const catalog = loadCatalog();
    const totalBytes = catalog.reduce((acc, curr) => acc + (curr.size || 0), 0);
    const totalStorageQuotaGB = config.totalStorageQuotaGB || 20;
    const totalQuotaBytes = totalStorageQuotaGB * 1024 * 1024 * 1024;
    const remainingBytes = Math.max(0, totalQuotaBytes - totalBytes);
    const usedPercent = Math.min(100, (totalBytes / totalQuotaBytes) * 100);
    const remainingPercent = Math.max(0, 100 - usedPercent);

    if (response.ok) {
      const data = await response.json().catch(() => ({}));
      return res.json({
        online: true,
        latency,
        serverUrl: config.serverUrl,
        service: data.service || "oortcloud-storage",
        rawResponse: data,
        totalFiles: catalog.length,
        totalBytes,
        totalQuotaBytes,
        remainingBytes,
        totalStorageQuotaGB,
        usedPercent: Number(usedPercent.toFixed(2)),
        remainingPercent: Number(remainingPercent.toFixed(2)),
      });
    }

    return res.json({
      online: false,
      latency,
      serverUrl: config.serverUrl,
      error: `Server mengembalikan status HTTP ${response.status} ${response.statusText}`,
      totalFiles: catalog.length,
      totalBytes,
      totalQuotaBytes,
      remainingBytes,
      totalStorageQuotaGB,
      usedPercent: Number(usedPercent.toFixed(2)),
      remainingPercent: Number(remainingPercent.toFixed(2)),
    });
  } catch (err) {
    const latency = Date.now() - startTime;
    const catalog = loadCatalog();
    const totalBytes = catalog.reduce((acc, curr) => acc + (curr.size || 0), 0);
    const totalStorageQuotaGB = config.totalStorageQuotaGB || 20;
    const totalQuotaBytes = totalStorageQuotaGB * 1024 * 1024 * 1024;
    const remainingBytes = Math.max(0, totalQuotaBytes - totalBytes);
    const usedPercent = Math.min(100, (totalBytes / totalQuotaBytes) * 100);
    const remainingPercent = Math.max(0, 100 - usedPercent);

    return res.json({
      online: false,
      latency,
      serverUrl: config.serverUrl,
      error: err.name === "AbortError" ? "Koneksi ke server Proxmox melebihi batas waktu (Timeout 6 detik)" : err.message,
      totalFiles: catalog.length,
      totalBytes,
      totalQuotaBytes,
      remainingBytes,
      totalStorageQuotaGB,
      usedPercent: Number(usedPercent.toFixed(2)),
      remainingPercent: Number(remainingPercent.toFixed(2)),
    });
  }
});

// 2. Baca Konfigurasi
app.get("/api/config", (req, res) => {
  const config = loadConfig();
  res.json(config);
});

// 3. Simpan Konfigurasi Baru
app.post("/api/config", async (req, res) => {
  const { serverUrl, totalStorageQuotaGB } = req.body;

  if (!serverUrl || typeof serverUrl !== "string") {
    return res.status(400).json({ error: "URL server Proxmox wajib diisi." });
  }

  let formattedUrl = serverUrl.trim();
  if (!formattedUrl.startsWith("http://") && !formattedUrl.startsWith("https://")) {
    formattedUrl = `https://${formattedUrl}`;
  }
  // Hilangkan trailing slash
  formattedUrl = formattedUrl.replace(/\/+$/, "");

  // Uji koneksi ke endpoint baru
  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 5000);

    const checkRes = await fetch(`${formattedUrl}/health`, {
      method: "GET",
      headers: PROXMOX_REQUEST_HEADERS,
      signal: controller.signal,
    });
    clearTimeout(timeoutId);

    if (!checkRes.ok) {
      return res.status(400).json({
        error: `URL dapat dihubungi tetapi endpoint /health mengembalikan HTTP ${checkRes.status}`,
      });
    }
  } catch (err) {
    return res.status(400).json({
      error: `Gagal menghubungkan ke ${formattedUrl}: ${err.message}`,
    });
  }

  const currentConfig = loadConfig();
  currentConfig.serverUrl = formattedUrl;
  if (totalStorageQuotaGB && !isNaN(totalStorageQuotaGB)) {
    currentConfig.totalStorageQuotaGB = parseFloat(totalStorageQuotaGB);
  }
  saveConfig(currentConfig);

  res.json({
    message: "Konfigurasi server berhasil diperbarui dan diverifikasi.",
    config: currentConfig,
  });
});

// 4. Ambil Daftar Berkas (Katalog Terpadu)
app.get("/api/files", (req, res) => {
  const catalog = loadCatalog();
  const { q, category, sort } = req.query;

  let filtered = [...catalog];

  // Pencarian berdasarkan nama berkas
  if (q && typeof q === "string") {
    const keyword = q.toLowerCase().trim();
    filtered = filtered.filter(
      (f) =>
        f.originalName.toLowerCase().includes(keyword) ||
        f.storageKey.toLowerCase().includes(keyword)
    );
  }

  // Filter kategori
  if (category && category !== "all") {
    filtered = filtered.filter((f) => f.category === category);
  }

  // Pengurutan
  if (sort === "name-asc") {
    filtered.sort((a, b) => a.originalName.localeCompare(b.originalName));
  } else if (sort === "name-desc") {
    filtered.sort((a, b) => b.originalName.localeCompare(a.originalName));
  } else if (sort === "size-asc") {
    filtered.sort((a, b) => a.size - b.size);
  } else if (sort === "size-desc") {
    filtered.sort((a, b) => b.size - a.size);
  } else if (sort === "date-asc") {
    filtered.sort((a, b) => new Date(a.uploadedAt) - new Date(b.uploadedAt));
  } else {
    // Default: date-desc (terbaru ke terlama)
    filtered.sort((a, b) => new Date(b.uploadedAt) - new Date(a.uploadedAt));
  }

  res.json({
    total: catalog.length,
    filteredCount: filtered.length,
    files: filtered,
  });
});

// 5. Unggah Berkas ke Server Proxmox
app.post("/api/files/upload", upload.single("file"), async (req, res) => {
  if (!req.file) {
    return res.status(400).json({ error: "Tidak ada berkas yang dikirim." });
  }

  const config = loadConfig();
  const catalog = loadCatalog();

  // Validasi sisa kapasitas total storage (Batalkan jika melebihi kapasitas)
  const currentTotalBytes = catalog.reduce((acc, curr) => acc + (curr.size || 0), 0);
  const totalQuotaBytes = (config.totalStorageQuotaGB || 20) * 1024 * 1024 * 1024;
  const remainingBytes = Math.max(0, totalQuotaBytes - currentTotalBytes);

  if (req.file.size > remainingBytes) {
    const fileSizeMB = (req.file.size / (1024 * 1024)).toFixed(2);
    const remainingMB = (remainingBytes / (1024 * 1024)).toFixed(2);
    const remainingGB = (remainingBytes / (1024 * 1024 * 1024)).toFixed(2);

    return res.status(400).json({
      error: `Proses unggah dibatalkan: Ukuran berkas (${fileSizeMB} MB) melebihi sisa kapasitas total penyimpanan yang tersedia (${remainingMB} MB / ${remainingGB} GB).`,
    });
  }

  // Pencegahan duplikasi nama berkas yang identik
  const isDuplicate = catalog.some(
    (item) => item.originalName.toLowerCase() === req.file.originalname.toLowerCase()
  );
  if (isDuplicate) {
    return res.status(409).json({
      error: `Berkas dengan nama "${req.file.originalname}" sudah ada di repositori. Silakan ganti nama berkas atau hapus berkas lama terlebih dahulu.`,
    });
  }

  try {
    // Siapkan form data untuk forward ke Proxmox backend
    const formData = new FormData();
    const fileBlob = new Blob([req.file.buffer], { type: req.file.mimetype });
    formData.append("file", fileBlob, req.file.originalname);

    const controller = new AbortController();
    // Timeout 10 menit untuk mengakomodasi file berukuran besar
    const timeoutId = setTimeout(() => controller.abort(), 600000);

    const serverRes = await fetch(`${config.serverUrl}/files`, {
      method: "POST",
      body: formData,
      headers: PROXMOX_REQUEST_HEADERS,
      signal: controller.signal,
    });
    clearTimeout(timeoutId);

    if (!serverRes.ok) {
      const errBody = await serverRes.text().catch(() => "");
      return res.status(serverRes.status).json({
        error: `Server Proxmox gagal menyimpan berkas (HTTP ${serverRes.status}): ${errBody || "Error internal server"}`,
      });
    }

    const result = await serverRes.json();
    const serverFile = result.file;

    if (!serverFile || !serverFile.storageName) {
      return res.status(502).json({
        error: "Format respons dari server Proxmox tidak sesuai ekspektasi (storageName tidak ditemukan).",
      });
    }

    // Catat ke katalog persisten lokal
    const newEntry = {
      id: `file_${Date.now()}_${Math.random().toString(36).substring(2, 8)}`,
      originalName: req.file.originalname,
      storageKey: serverFile.storageName,
      size: req.file.size,
      mimeType: req.file.mimetype || "application/octet-stream",
      category: determineCategory(req.file.mimetype || "", req.file.originalname),
      serverPath: serverFile.path || `/data/oortcloud/${serverFile.storageName}`,
      uploadedAt: new Date().toISOString(),
      serverUrl: config.serverUrl,
    };

    catalog.unshift(newEntry);
    saveCatalog(catalog);

    res.status(201).json({
      message: "Berkas berhasil diunggah ke Cloud Storage Proxmox.",
      file: newEntry,
    });
  } catch (err) {
    console.error("Kesalahan saat mengunggah ke Proxmox:", err);
    return res.status(502).json({
      error: `Gagal berkomunikasi dengan server Proxmox: ${err.message}`,
    });
  }
});

// 6. Unduh Berkas dari Server Proxmox
app.get("/api/files/:storageKey/download", async (req, res) => {
  const { storageKey } = req.params;
  const config = loadConfig();
  const catalog = loadCatalog();

  const item = catalog.find((f) => f.storageKey === storageKey);
  const downloadName = item ? item.originalName : storageKey;

  try {
    const serverRes = await fetch(`${config.serverUrl}/files/${storageKey}`, {
      headers: PROXMOX_REQUEST_HEADERS,
    });

    if (!serverRes.ok) {
      return res.status(serverRes.status).json({
        error: `Berkas tidak ditemukan atau server Proxmox merespons dengan HTTP ${serverRes.status}.`,
      });
    }

    // Atur header untuk pengunduhan berkas dengan nama asli
    res.setHeader("Content-Disposition", `attachment; filename="${encodeURIComponent(downloadName)}"`);
    res.setHeader("Content-Type", item ? item.mimeType : "application/octet-stream");

    const arrayBuffer = await serverRes.arrayBuffer();
    res.send(Buffer.from(arrayBuffer));
  } catch (err) {
    res.status(502).json({
      error: `Gagal mengambil berkas dari server Proxmox: ${err.message}`,
    });
  }
});

// 7. Pratinjau Berkas (Stream Inline untuk Gambar, Audio, Video, PDF, Teks)
app.get("/api/files/:storageKey/preview", async (req, res) => {
  const { storageKey } = req.params;
  const config = loadConfig();
  const catalog = loadCatalog();

  const item = catalog.find((f) => f.storageKey === storageKey);

  try {
    const serverRes = await fetch(`${config.serverUrl}/files/${storageKey}`, {
      headers: PROXMOX_REQUEST_HEADERS,
    });

    if (!serverRes.ok) {
      return res.status(serverRes.status).json({
        error: `Berkas tidak ditemukan di server Proxmox (HTTP ${serverRes.status}).`,
      });
    }

    const contentType = item ? item.mimeType : (serverRes.headers.get("content-type") || "application/octet-stream");
    res.setHeader("Content-Type", contentType);
    res.setHeader("Content-Disposition", "inline");

    const arrayBuffer = await serverRes.arrayBuffer();
    res.send(Buffer.from(arrayBuffer));
  } catch (err) {
    res.status(502).json({
      error: `Gagal memuat pratinjau dari server Proxmox: ${err.message}`,
    });
  }
});

// 8. Ganti Nama Berkas (Rename File)
app.patch("/api/files/:storageKey/rename", (req, res) => {
  const { storageKey } = req.params;
  const { newName } = req.body;

  if (!newName || typeof newName !== "string" || !newName.trim()) {
    return res.status(400).json({ error: "Nama berkas baru tidak boleh kosong." });
  }

  const catalog = loadCatalog();
  const fileIndex = catalog.findIndex((f) => f.storageKey === storageKey);

  if (fileIndex === -1) {
    return res.status(404).json({ error: "Berkas tidak ditemukan dalam repositori." });
  }

  const targetFile = catalog[fileIndex];
  let trimmedName = newName.trim();

  // Pertahankan ekstensi asli jika pengguna tidak menyertakannya
  const oldExt = path.extname(targetFile.originalName);
  const newExt = path.extname(trimmedName);
  if (oldExt && !newExt) {
    trimmedName = `${trimmedName}${oldExt}`;
  }

  // Cek duplikasi nama dengan berkas lain
  const isDuplicate = catalog.some(
    (f, idx) => idx !== fileIndex && f.originalName.toLowerCase() === trimmedName.toLowerCase()
  );
  if (isDuplicate) {
    return res.status(409).json({
      error: `Berkas dengan nama "${trimmedName}" sudah ada. Silakan gunakan nama lain.`,
    });
  }

  targetFile.originalName = trimmedName;
  targetFile.category = determineCategory(targetFile.mimeType || "", trimmedName);
  targetFile.renamedAt = new Date().toISOString();

  catalog[fileIndex] = targetFile;
  saveCatalog(catalog);

  res.json({
    message: "Nama berkas berhasil diubah.",
    file: targetFile,
  });
});

// 9. Hapus Berkas dari Server Proxmox & Katalog
app.delete("/api/files/:storageKey", async (req, res) => {
  const { storageKey } = req.params;
  const config = loadConfig();
  const catalog = loadCatalog();

  try {
    const serverRes = await fetch(`${config.serverUrl}/files/${storageKey}`, {
      method: "DELETE",
      headers: PROXMOX_REQUEST_HEADERS,
    });

    const serverData = await serverRes.json().catch(() => ({}));

    // Hapus dari katalog lokal tanpa memandang apakah di server masih ada atau sudah 404
    const initialCount = catalog.length;
    const updatedCatalog = catalog.filter((f) => f.storageKey !== storageKey);
    saveCatalog(updatedCatalog);

    if (!serverRes.ok && serverRes.status !== 404) {
      return res.status(serverRes.status).json({
        error: `Server Proxmox merespons dengan kesalahan saat menghapus: ${serverData.error || serverRes.statusText}`,
      });
    }

    res.json({
      message: "Berkas berhasil dihapus dari Cloud Storage Proxmox.",
      storageKey,
      removedFromCatalog: initialCount !== updatedCatalog.length,
      serverMessage: serverData.message || "OK",
    });
  } catch (err) {
    // Tetap hapus dari katalog lokal jika pengguna meminta hapus
    const updatedCatalog = catalog.filter((f) => f.storageKey !== storageKey);
    saveCatalog(updatedCatalog);

    res.status(502).json({
      error: `Gagal mengirim perintah hapus ke server Proxmox: ${err.message}. Entri katalog lokal tetap dibersihkan.`,
    });
  }
});

// 9. Sinkronisasi & Verifikasi Integritas Katalog
app.post("/api/files/sync", async (req, res) => {
  const config = loadConfig();
  const catalog = loadCatalog();

  const results = {
    total: catalog.length,
    active: 0,
    missingOnServer: [],
  };

  for (const item of catalog) {
    try {
      const checkRes = await fetch(`${config.serverUrl}/files/${item.storageKey}`, {
        method: "HEAD",
        headers: PROXMOX_REQUEST_HEADERS,
      });
      if (checkRes.ok || checkRes.status === 200) {
        results.active++;
      } else {
        results.missingOnServer.push(item);
      }
    } catch (e) {
      results.missingOnServer.push(item);
    }
  }

  res.json({
    message: "Verifikasi integritas berkas selesai.",
    summary: results,
  });
});

// Jalankan server
const config = loadConfig();
const PORT = process.env.PORT || config.port || 4000;

app.listen(PORT, "0.0.0.0", () => {
  console.log(`=======================================================`);
  console.log(`Cloud Storage Client Web aktif di: http://localhost:${PORT}`);
  console.log(`Target Server Proxmox: ${config.serverUrl}`);
  console.log(`Waktu Mulai: ${new Date().toLocaleString("id-ID", { timeZone: "Asia/Jakarta" })} WIB`);
  console.log(`=======================================================`);
});
