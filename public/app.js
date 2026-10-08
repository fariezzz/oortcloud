// ============================================================================
// CLOUD DRIVE - LOGIKA UTAMA (app.js)
// Tema Terang & Aksen Hijau Daun - Drag & Drop Satu Halaman Penuh
// ============================================================================

const state = {
  files: [],
  currentCategory: "all",
  searchQuery: "",
  sortBy: "date-desc",
  viewMode: localStorage.getItem("cloud_drive_view") || "grid", // 'grid' | 'list'
  pendingDeleteFile: null,
  pendingRenameKey: null,
  totalStorageQuotaGB: 4,
  remainingBytes: Infinity,
  isUploading: false,
};

// ============================================================================
// 1. REFERENSI ELEMEN DOM
// ============================================================================
// Header & Status
const serverStatusPill = document.getElementById("server-status-pill");
const statusDot = document.getElementById("status-dot");
const statusText = document.getElementById("status-text");
const statusLatency = document.getElementById("status-latency");
const searchInput = document.getElementById("search-input");
const btnClearSearch = document.getElementById("btn-clear-search");

// Sidebar & Navigasi
const sidebar = document.getElementById("sidebar");
const sidebarResizer = document.getElementById("sidebar-resizer");
const sidebarBackdrop = document.getElementById("sidebar-backdrop");
const btnToggleSidebar = document.getElementById("btn-toggle-sidebar");
const btnCollapseSidebar = document.getElementById("btn-collapse-sidebar");
const btnSidebarEdgeToggle = document.getElementById("btn-sidebar-edge-toggle");
const edgeToggleIcon = document.getElementById("edge-toggle-icon");
const btnSidebarUpload = document.getElementById("btn-sidebar-upload");
const btnFabUpload = document.getElementById("btn-fab-upload");
const fileInput = document.getElementById("file-input");

// Sidebar Storage Widget
const sidebarStorageBar = document.getElementById("sidebar-storage-bar");
const sidebarUsedText = document.getElementById("sidebar-used-text");
const sidebarQuotaText = document.getElementById("sidebar-quota-text");
const sidebarRemainingText = document.getElementById("sidebar-remaining-text");

// Workspace Toolbar & Containers
const viewTitle = document.getElementById("view-title");
const btnViewGrid = document.getElementById("btn-view-grid");
const btnViewList = document.getElementById("btn-view-list");
const sortSelect = document.getElementById("sort-select");
const uploadLimitInfo = document.getElementById("upload-limit-info");
const dropOverlay = document.getElementById("fullscreen-drop-overlay");

const filesGridContainer = document.getElementById("files-grid-container");
const filesListContainer = document.getElementById("files-list-container");
const fileListBody = document.getElementById("file-list-body");
const emptyState = document.getElementById("empty-state");

// Floating Upload Progress Widget
const uploadWidget = document.getElementById("upload-widget");
const uploadWidgetFilename = document.getElementById("upload-widget-filename");
const uploadWidgetPercent = document.getElementById("upload-widget-percent");
const uploadWidgetProgressBar = document.getElementById("upload-widget-progress-bar");
const uploadWidgetStatus = document.getElementById("upload-widget-status");

// Modal Ganti Nama (Rename)
const renameModal = document.getElementById("rename-modal");
const renameForm = document.getElementById("rename-form");
const renameInputName = document.getElementById("rename-input-name");
const renameError = document.getElementById("rename-error");
const btnCloseRename = document.getElementById("btn-close-rename");
const btnCancelRename = document.getElementById("btn-cancel-rename");

// Modal Pratinjau (Preview)
const previewModal = document.getElementById("preview-modal");
const previewIcon = document.getElementById("preview-icon");
const previewTitle = document.getElementById("preview-title");
const previewContent = document.getElementById("preview-content");
const previewMeta = document.getElementById("preview-meta");
const previewBtnRename = document.getElementById("preview-btn-rename");
const previewBtnDownload = document.getElementById("preview-btn-download");
const previewBtnClose = document.getElementById("preview-btn-close");
const btnClosePreview = document.getElementById("btn-close-preview");

// Modal Konfirmasi Hapus
const deleteModal = document.getElementById("delete-modal");
const deleteFilename = document.getElementById("delete-filename");
const btnCancelDelete = document.getElementById("btn-cancel-delete");
const btnConfirmDelete = document.getElementById("btn-confirm-delete");

const toastContainer = document.getElementById("toast-container");

// ============================================================================
// 2. FUNGSI UTILITAS
// ============================================================================
function showToast(message, type = "info") {
  const toast = document.createElement("div");
  toast.className = "toast-anim pointer-events-auto flex items-start gap-3 p-3.5 rounded-xl border shadow-xl text-xs bg-white";

  let iconHtml = '<i class="bi bi-info-circle text-emerald-600 text-sm"></i>';
  let borderClass = "border-slate-200 text-slate-800";

  if (type === "success") {
    iconHtml = '<i class="bi bi-check-circle-fill text-emerald-600 text-sm"></i>';
    borderClass = "border-emerald-200 text-emerald-900 bg-emerald-50/70";
  } else if (type === "error") {
    iconHtml = '<i class="bi bi-exclamation-octagon-fill text-rose-600 text-sm"></i>';
    borderClass = "border-rose-200 text-rose-900 bg-rose-50/70";
  } else if (type === "warning") {
    iconHtml = '<i class="bi bi-exclamation-triangle-fill text-amber-600 text-sm"></i>';
    borderClass = "border-amber-200 text-amber-900 bg-amber-50/70";
  }

  toast.classList.add(...borderClass.split(" "));
  toast.innerHTML = `
    <div class="mt-0.5 shrink-0">${iconHtml}</div>
    <div class="flex-1 font-medium leading-relaxed">${escapeHtml(message)}</div>
  `;

  toastContainer.appendChild(toast);

  setTimeout(() => {
    toast.style.opacity = "0";
    toast.style.transition = "opacity 0.25s ease";
    setTimeout(() => toast.remove(), 250);
  }, 4000);
}

function formatBytes(bytes) {
  if (!bytes || bytes === 0) return "0 B";
  const k = 1024;
  const sizes = ["B", "KB", "MB", "GB", "TB"];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return `${parseFloat((bytes / Math.pow(k, i)).toFixed(2))} ${sizes[i]}`;
}

function formatWibDate(dateStr) {
  if (!dateStr) return "-";
  try {
    const d = new Date(dateStr);
    return new Intl.DateTimeFormat("id-ID", {
      timeZone: "Asia/Jakarta",
      day: "numeric",
      month: "short",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    }).format(d);
  } catch (e) {
    return dateStr;
  }
}

function escapeHtml(text) {
  if (!text) return "";
  return String(text)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

function getCategoryIcon(category, size = "text-base") {
  switch (category) {
    case "image":
      return `<i class="bi bi-file-earmark-image text-emerald-600 ${size}"></i>`;
    case "document":
      return `<i class="bi bi-file-earmark-text text-emerald-700 ${size}"></i>`;
    case "audio":
      return `<i class="bi bi-file-earmark-music text-emerald-600 ${size}"></i>`;
    case "video":
      return `<i class="bi bi-file-earmark-play text-emerald-600 ${size}"></i>`;
    case "archive":
      return `<i class="bi bi-file-earmark-zip text-emerald-700 ${size}"></i>`;
    default:
      return `<i class="bi bi-file-earmark text-slate-500 ${size}"></i>`;
  }
}

function getCategoryLabel(category) {
  switch (category) {
    case "image": return "Gambar";
    case "document": return "Dokumen";
    case "audio": return "Audio";
    case "video": return "Video";
    case "archive": return "Arsip";
    default: return "Lainnya";
  }
}

// ============================================================================
// 3. METRIK KAPASITAS & INDIKATOR STORAGE
// ============================================================================
function updateStorageMetrics(totalBytes, quotaGB) {
  const currentTotalBytes = totalBytes !== undefined 
    ? totalBytes 
    : state.files.reduce((acc, curr) => acc + (curr.size || 0), 0);
  
  const currentQuotaGB = quotaGB !== undefined 
    ? quotaGB 
    : (state.totalStorageQuotaGB || 4);
  
  state.totalStorageQuotaGB = currentQuotaGB;

  const totalQuotaBytes = currentQuotaGB * 1024 * 1024 * 1024;
  const remainingBytes = Math.max(0, totalQuotaBytes - currentTotalBytes);
  const usedPercent = Math.min(100, (currentTotalBytes / totalQuotaBytes) * 100);
  const remainingPercent = Math.max(0, 100 - usedPercent);

  state.remainingBytes = remainingBytes;

  if (sidebarUsedText) sidebarUsedText.textContent = formatBytes(currentTotalBytes);
  if (sidebarQuotaText) sidebarQuotaText.textContent = `${currentQuotaGB} GB`;
  if (sidebarRemainingText) {
    sidebarRemainingText.textContent = `Sisa ${formatBytes(remainingBytes)} bebas (${remainingPercent.toFixed(1)}%)`;
  }
  if (sidebarStorageBar) {
    sidebarStorageBar.style.width = `${usedPercent}%`;
    if (usedPercent > 90) {
      sidebarStorageBar.className = "bg-rose-500 h-1.5 rounded-full transition-all duration-300";
    } else if (usedPercent > 75) {
      sidebarStorageBar.className = "bg-amber-500 h-1.5 rounded-full transition-all duration-300";
    } else {
      sidebarStorageBar.className = "bg-emerald-600 h-1.5 rounded-full transition-all duration-300";
    }
  }

  if (uploadLimitInfo) {
    uploadLimitInfo.textContent = `Sisa Storage: ${formatBytes(remainingBytes)}`;
  }
}

// ============================================================================
// 4. CEK STATUS SERVER PROXMOX
// ============================================================================
async function checkServerStatus() {
  if (statusDot) statusDot.className = "w-2.5 h-2.5 rounded-full bg-amber-400 animate-pulse";
  if (statusText) statusText.textContent = "Memeriksa...";
  if (statusLatency) statusLatency.textContent = "";

  try {
    const res = await fetch("/api/status");
    const data = await res.json();

    if (data.totalStorageQuotaGB) {
      state.totalStorageQuotaGB = data.totalStorageQuotaGB;
    }

    if (data.online) {
      if (statusDot) statusDot.className = "w-2.5 h-2.5 rounded-full bg-emerald-500";
      if (statusText) statusText.textContent = "Online";
      if (statusLatency) statusLatency.textContent = `(${data.latency} ms)`;
    } else {
      if (statusDot) statusDot.className = "w-2.5 h-2.5 rounded-full bg-rose-500";
      if (statusText) statusText.textContent = "Offline";
      if (statusLatency) statusLatency.textContent = data.latency ? `(${data.latency} ms)` : "";
    }

    updateStorageMetrics(data.totalBytes, data.totalStorageQuotaGB);
  } catch (err) {
    console.error("Kesalahan cek status:", err);
    if (statusDot) statusDot.className = "w-2.5 h-2.5 rounded-full bg-rose-500";
    if (statusText) statusText.textContent = "Offline";
    if (statusLatency) statusLatency.textContent = "";

    updateStorageMetrics();
  }
}

// ============================================================================
// 5. MEMUAT & MERENDER DAFTAR BERKAS (GRID VIEW & LIST VIEW)
// ============================================================================
async function loadFiles() {
  try {
    const params = new URLSearchParams();
    if (state.searchQuery) params.append("q", state.searchQuery);
    if (state.currentCategory && state.currentCategory !== "all") params.append("category", state.currentCategory);
    if (state.sortBy) params.append("sort", state.sortBy);

    const res = await fetch(`/api/files?${params.toString()}`);
    const data = await res.json();

    state.files = data.files || [];
    renderFiles();
    updateStorageMetrics();
  } catch (err) {
    console.error("Gagal memuat katalog berkas:", err);
  }
}

function renderFiles() {
  if (state.files.length === 0) {
    if (filesGridContainer) filesGridContainer.classList.add("hidden");
    if (filesListContainer) filesListContainer.classList.add("hidden");
    if (emptyState) emptyState.classList.remove("hidden");
    return;
  }

  if (emptyState) emptyState.classList.add("hidden");

  if (state.viewMode === "grid") {
    if (filesGridContainer) filesGridContainer.classList.remove("hidden");
    if (filesListContainer) filesListContainer.classList.add("hidden");
    renderGridView();
  } else {
    if (filesGridContainer) filesGridContainer.classList.add("hidden");
    if (filesListContainer) filesListContainer.classList.remove("hidden");
    renderListView();
  }
}

// Render Tampilan Grid (Google Drive Cards dengan Aksen Hijau Daun)
function renderGridView() {
  if (!filesGridContainer) return;

  filesGridContainer.innerHTML = state.files
    .map((file) => {
      const isImage = file.category === "image";
      const previewUrl = `/api/files/${file.storageKey}/preview`;

      return `
        <div class="drive-card bg-white border border-slate-200 rounded-xl p-4 flex flex-col justify-between shadow-2xs hover:shadow-md transition group">
          
          <!-- Header Kartu: Ikon Kategori & Nama -->
          <div class="flex items-start justify-between gap-2 mb-3">
            <div class="flex items-center gap-2 overflow-hidden flex-1">
              <div class="w-8 h-8 rounded-lg bg-emerald-50 border border-emerald-100 flex items-center justify-center shrink-0">
                ${getCategoryIcon(file.category, "text-base")}
              </div>
              <h3 class="text-xs font-semibold text-slate-800 truncate cursor-pointer hover:text-emerald-700" onclick="openPreview('${file.storageKey}')" title="${escapeHtml(file.originalName)}">
                ${escapeHtml(file.originalName)}
              </h3>
            </div>
            
            <!-- Tombol Cepat Ganti Nama -->
            <button onclick="openRenameModal('${file.storageKey}')" class="h-7 w-7 rounded-lg text-slate-400 hover:text-emerald-700 hover:bg-slate-100 transition flex items-center justify-center" title="Ganti Nama">
              <i class="bi bi-pencil text-xs"></i>
            </button>
          </div>

          <!-- Body Kartu: Thumbnail atau Preview Box -->
          <div class="w-full h-32 rounded-lg bg-slate-50 border border-slate-100 overflow-hidden flex items-center justify-center cursor-pointer mb-3 relative group/thumb" onclick="openPreview('${file.storageKey}')">
            ${
              isImage
                ? `<img src="${previewUrl}" alt="${escapeHtml(file.originalName)}" class="w-full h-full object-cover group-hover/thumb:scale-105 transition duration-200" loading="lazy">`
                : `<div class="flex flex-col items-center justify-center text-slate-400 gap-1.5">
                     ${getCategoryIcon(file.category, "text-3xl")}
                     <span class="text-[10px] font-medium uppercase tracking-wider text-slate-400">${getCategoryLabel(file.category)}</span>
                   </div>`
            }
          </div>

          <!-- Footer Kartu: Ukuran & Aksi Toolbar -->
          <div class="pt-2 border-t border-slate-100 flex items-center justify-between text-[11px] text-slate-500">
            <div>
              <span class="font-mono font-medium">${formatBytes(file.size)}</span>
            </div>

            <!-- Tombol Aksi Cepat (h-7 w-7 rounded-lg) -->
            <div class="flex items-center gap-1">
              <button onclick="openPreview('${file.storageKey}')" class="h-7 w-7 rounded-lg text-slate-500 hover:text-emerald-700 hover:bg-slate-100 transition flex items-center justify-center" title="Pratinjau">
                <i class="bi bi-eye"></i>
              </button>
              <button onclick="downloadFile('${file.storageKey}', this)" class="h-7 w-7 rounded-lg text-slate-500 hover:text-emerald-700 hover:bg-slate-100 transition flex items-center justify-center" title="Unduh Berkas">
                <i class="bi bi-download"></i>
              </button>
              <button onclick="copyDirectLink('${file.storageKey}')" class="h-7 w-7 rounded-lg text-slate-500 hover:text-emerald-700 hover:bg-slate-100 transition flex items-center justify-center" title="Salin Tautan">
                <i class="bi bi-link-45deg"></i>
              </button>
              <button onclick="openDeleteModal('${file.storageKey}')" class="h-7 w-7 rounded-lg text-slate-500 hover:text-rose-600 hover:bg-slate-100 transition flex items-center justify-center" title="Hapus">
                <i class="bi bi-trash"></i>
              </button>
            </div>
          </div>

        </div>
      `;
    })
    .join("");
}

// Render Tampilan List (Google Drive Table)
function renderListView() {
  if (!fileListBody) return;

  fileListBody.innerHTML = state.files
    .map((file) => {
      return `
        <tr class="hover:bg-slate-50/80 transition group">
          <!-- Nama Berkas -->
          <td class="py-3 px-4 font-medium text-slate-800">
            <div class="flex items-center gap-2.5 max-w-[280px] sm:max-w-[380px]">
              <div class="w-7 h-7 rounded-lg bg-emerald-50 border border-emerald-100 flex items-center justify-center shrink-0">
                ${getCategoryIcon(file.category, "text-sm")}
              </div>
              <span class="truncate hover:text-emerald-700 cursor-pointer" onclick="openPreview('${file.storageKey}')" title="${escapeHtml(file.originalName)}">
                ${escapeHtml(file.originalName)}
              </span>
            </div>
          </td>

          <!-- Kategori -->
          <td class="py-3 px-4 hidden sm:table-cell">
            <span class="px-2 py-0.5 rounded-md text-[11px] font-medium bg-slate-100 text-slate-600 border border-slate-200">
              ${getCategoryLabel(file.category)}
            </span>
          </td>

          <!-- Ukuran -->
          <td class="py-3 px-4 font-mono text-slate-700">
            ${formatBytes(file.size)}
          </td>

          <!-- Waktu Unggah -->
          <td class="py-3 px-4 text-slate-500 text-[11px] hidden md:table-cell">
            ${formatWibDate(file.uploadedAt)}
          </td>

          <!-- Aksi Toolbar (h-7 w-7 rounded-lg) -->
          <td class="py-3 px-4 text-right">
            <div class="flex items-center justify-end gap-1">
              <button onclick="openRenameModal('${file.storageKey}')" class="h-7 w-7 rounded-lg text-slate-500 hover:text-emerald-700 hover:bg-slate-100 transition flex items-center justify-center" title="Ganti Nama">
                <i class="bi bi-pencil"></i>
              </button>
              <button onclick="openPreview('${file.storageKey}')" class="h-7 w-7 rounded-lg text-slate-500 hover:text-emerald-700 hover:bg-slate-100 transition flex items-center justify-center" title="Pratinjau">
                <i class="bi bi-eye"></i>
              </button>
              <button onclick="downloadFile('${file.storageKey}', this)" class="h-7 w-7 rounded-lg text-slate-500 hover:text-emerald-700 hover:bg-slate-100 transition flex items-center justify-center" title="Unduh Berkas">
                <i class="bi bi-download"></i>
              </button>
              <button onclick="copyDirectLink('${file.storageKey}')" class="h-7 w-7 rounded-lg text-slate-500 hover:text-emerald-700 hover:bg-slate-100 transition flex items-center justify-center" title="Salin Tautan">
                <i class="bi bi-link-45deg"></i>
              </button>
              <button onclick="openDeleteModal('${file.storageKey}')" class="h-7 w-7 rounded-lg text-slate-500 hover:text-rose-600 hover:bg-slate-100 transition flex items-center justify-center" title="Hapus Berkas">
                <i class="bi bi-trash"></i>
              </button>
            </div>
          </td>
        </tr>
      `;
    })
    .join("");
}

// Switcher Tampilan Grid vs List
function setViewMode(mode) {
  state.viewMode = mode;
  localStorage.setItem("cloud_drive_view", mode);

  if (mode === "grid") {
    btnViewGrid.className = "h-8 w-8 rounded-md text-emerald-700 bg-emerald-50 flex items-center justify-center transition";
    btnViewList.className = "h-8 w-8 rounded-md text-slate-400 hover:text-slate-700 flex items-center justify-center transition";
  } else {
    btnViewList.className = "h-8 w-8 rounded-md text-emerald-700 bg-emerald-50 flex items-center justify-center transition";
    btnViewGrid.className = "h-8 w-8 rounded-md text-slate-400 hover:text-slate-700 flex items-center justify-center transition";
  }

  renderFiles();
}

if (btnViewGrid) btnViewGrid.addEventListener("click", () => setViewMode("grid"));
if (btnViewList) btnViewList.addEventListener("click", () => setViewMode("list"));

setViewMode(state.viewMode);

// ============================================================================
// 6. RESPONSIVE SIDEBAR & RESIZING (DRAG SPLITTER & COLLAPSE)
// ============================================================================
const DEFAULT_SIDEBAR_WIDTH = 256;
const MIN_SIDEBAR_WIDTH = 180;

function getMaxSidebarWidth() {
  return Math.max(MIN_SIDEBAR_WIDTH, Math.min(520, Math.floor(window.innerWidth * 0.45)));
}

function updateSidebarUIState() {
  if (!sidebar) return;
  const isDesktop = window.innerWidth >= 1024;
  const isCollapsed = sidebar.classList.contains("desktop-collapsed");

  // Tombol Chevron Pinned di Garis Divider Resizer
  if (btnSidebarEdgeToggle) {
    if (isDesktop) {
      btnSidebarEdgeToggle.style.display = "flex";
      if (isCollapsed) {
        btnSidebarEdgeToggle.title = "Buka Sidebar (Ctrl+B)";
        if (edgeToggleIcon) edgeToggleIcon.className = "bi bi-chevron-right text-xs";
      } else {
        btnSidebarEdgeToggle.title = "Tutup Sidebar (Ctrl+B)";
        if (edgeToggleIcon) edgeToggleIcon.className = "bi bi-chevron-left text-xs";
      }
    } else {
      btnSidebarEdgeToggle.style.display = "none";
    }
  }

  // Divider Resizer: selalu aktif di desktop
  if (sidebarResizer) {
    if (isDesktop) {
      sidebarResizer.style.display = "flex";
      if (isCollapsed) {
        sidebarResizer.classList.add("is-collapsed");
      } else {
        sidebarResizer.classList.remove("is-collapsed");
      }
    } else {
      sidebarResizer.style.display = "none";
    }
  }

  // Tooltip tombol hamburger di navbar
  if (btnToggleSidebar) {
    btnToggleSidebar.title = isCollapsed ? "Buka Sidebar (Ctrl+B)" : "Tutup Sidebar (Ctrl+B)";
  }
}

function toggleSidebar() {
  if (!sidebar) return;
  if (window.innerWidth < 1024) {
    // Mode Mobile: Toggle Drawer
    const isOpen = sidebar.classList.contains("open");
    if (isOpen) {
      sidebar.classList.remove("open");
      if (sidebarBackdrop) sidebarBackdrop.classList.add("hidden");
    } else {
      sidebar.classList.add("open");
      if (sidebarBackdrop) sidebarBackdrop.classList.remove("hidden");
    }
  } else {
    // Mode Desktop: Toggle Collapse
    const isCollapsed = sidebar.classList.toggle("desktop-collapsed");
    localStorage.setItem("oortcloud_sidebar_collapsed", isCollapsed ? "true" : "false");

    if (!isCollapsed) {
      const savedWidth = localStorage.getItem("oortcloud_sidebar_width");
      const targetWidth = savedWidth ? parseInt(savedWidth, 10) : DEFAULT_SIDEBAR_WIDTH;
      sidebar.style.width = `${Math.max(MIN_SIDEBAR_WIDTH, Math.min(getMaxSidebarWidth(), targetWidth))}px`;
    } else {
      sidebar.style.width = "0px";
    }

    updateSidebarUIState();
  }
}

// Event listener tombol toggle sidebar
if (btnToggleSidebar) btnToggleSidebar.addEventListener("click", toggleSidebar);
if (sidebarBackdrop) sidebarBackdrop.addEventListener("click", toggleSidebar);

if (btnSidebarEdgeToggle) {
  btnSidebarEdgeToggle.addEventListener("pointerdown", (e) => {
    e.stopPropagation();
  });
  btnSidebarEdgeToggle.addEventListener("mousedown", (e) => {
    e.stopPropagation();
  });
  btnSidebarEdgeToggle.addEventListener("click", (e) => {
    e.preventDefault();
    e.stopPropagation();
    toggleSidebar();
  });
}

// Pintasan keyboard Ctrl+B / Cmd+B untuk Buka/Tutup Sidebar
window.addEventListener("keydown", (e) => {
  if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "b") {
    e.preventDefault();
    toggleSidebar();
  }
});

let isResizingSidebar = false;
let resizeStartX = 0;
let resizeStartWidth = 0;

function initSidebarResizer() {
  if (!sidebar || !sidebarResizer) return;

  // Pulihkan status collapse dan lebar sidebar dari localStorage
  if (window.innerWidth >= 1024) {
    const isSavedCollapsed = localStorage.getItem("oortcloud_sidebar_collapsed") === "true";
    if (isSavedCollapsed) {
      sidebar.classList.add("desktop-collapsed");
    } else {
      const savedWidth = localStorage.getItem("oortcloud_sidebar_width");
      if (savedWidth) {
        const parsed = parseInt(savedWidth, 10);
        if (!isNaN(parsed) && parsed >= MIN_SIDEBAR_WIDTH) {
          sidebar.style.width = `${Math.min(parsed, getMaxSidebarWidth())}px`;
        }
      }
    }
  }

  updateSidebarUIState();

  sidebarResizer.addEventListener("pointerdown", (e) => {
    // Jangan mulai drag resize jika pointer mendarat di tombol toggle
    if (e.target.closest("#btn-sidebar-edge-toggle")) {
      return;
    }
    if (e.button !== 0) return; // Hanya klik kiri mouse
    if (window.innerWidth < 1024) return;
    if (sidebar.classList.contains("desktop-collapsed")) return;

    isResizingSidebar = true;
    resizeStartX = e.clientX;
    resizeStartWidth = sidebar.getBoundingClientRect().width;

    try {
      sidebarResizer.setPointerCapture(e.pointerId);
    } catch (_) {}

    document.body.classList.add("is-resizing");
    sidebar.classList.add("no-transition");
    e.preventDefault();
  });

  sidebarResizer.addEventListener("pointermove", (e) => {
    if (!isResizingSidebar) return;

    const deltaX = e.clientX - resizeStartX;
    const maxWidth = getMaxSidebarWidth();
    let newWidth = resizeStartWidth + deltaX;

    if (newWidth < MIN_SIDEBAR_WIDTH) newWidth = MIN_SIDEBAR_WIDTH;
    if (newWidth > maxWidth) newWidth = maxWidth;

    sidebar.style.width = `${newWidth}px`;
  });

  const stopResize = (e) => {
    if (!isResizingSidebar) return;
    isResizingSidebar = false;

    try {
      if (e && e.pointerId) sidebarResizer.releasePointerCapture(e.pointerId);
    } catch (_) {}

    document.body.classList.remove("is-resizing");
    sidebar.classList.remove("no-transition");

    const currentWidth = Math.round(sidebar.getBoundingClientRect().width);
    if (currentWidth >= MIN_SIDEBAR_WIDTH) {
      localStorage.setItem("oortcloud_sidebar_width", currentWidth);
    }
    updateSidebarUIState();
  };

  sidebarResizer.addEventListener("pointerup", stopResize);
  sidebarResizer.addEventListener("pointercancel", stopResize);

  // Klik ganda pada resizer untuk mereset ukuran ke default (256px)
  sidebarResizer.addEventListener("dblclick", () => {
    if (window.innerWidth < 1024) return;
    sidebar.style.width = `${DEFAULT_SIDEBAR_WIDTH}px`;
    localStorage.setItem("oortcloud_sidebar_width", DEFAULT_SIDEBAR_WIDTH);
    updateSidebarUIState();
    showToast("Ukuran sidebar diatur ulang ke default.", "info");
  });

  // Penyesuaian responsif saat ukuran browser berubah
  window.addEventListener("resize", () => {
    if (window.innerWidth < 1024) {
      sidebar.style.width = "";
      if (sidebarResizer) sidebarResizer.style.display = "none";
      sidebar.classList.remove("desktop-collapsed");
    } else {
      if (!sidebar.classList.contains("desktop-collapsed")) {
        const saved = localStorage.getItem("oortcloud_sidebar_width");
        const target = saved ? parseInt(saved, 10) : DEFAULT_SIDEBAR_WIDTH;
        sidebar.style.width = `${Math.max(MIN_SIDEBAR_WIDTH, Math.min(getMaxSidebarWidth(), target))}px`;
        if (sidebarResizer) sidebarResizer.style.display = "flex";
      }
    }
    updateSidebarUIState();
  });
}

// Navigasi Kategori Sidebar (Tanpa Sisa Border Saat Berpindah Menu)
document.querySelectorAll(".cat-nav-btn").forEach((btn) => {
  btn.addEventListener("click", () => {
    document.querySelectorAll(".cat-nav-btn").forEach((b) => {
      b.classList.remove("active");
    });

    btn.classList.add("active");

    const category = btn.getAttribute("data-cat");
    state.currentCategory = category;

    if (viewTitle) {
      if (category === "all") viewTitle.textContent = "Drive Saya";
      else viewTitle.textContent = getCategoryLabel(category);
    }

    loadFiles();

    if (window.innerWidth < 1024 && sidebar && sidebar.classList.contains("open")) {
      toggleSidebar();
    }
  });
});

// ============================================================================
// 7. DRAG & DROP SATU HALAMAN PENUH (INVISIBLE OVERLAY)
// ============================================================================
let dragCounter = 0;

window.addEventListener("dragenter", (e) => {
  e.preventDefault();
  dragCounter++;
  if (e.dataTransfer && e.dataTransfer.types && Array.from(e.dataTransfer.types).includes("Files")) {
    if (dropOverlay) {
      dropOverlay.classList.remove("hidden");
      dropOverlay.classList.remove("pointer-events-none");
      dropOverlay.classList.add("flex", "pointer-events-auto");
    }
  }
});

window.addEventListener("dragleave", (e) => {
  e.preventDefault();
  dragCounter--;
  if (dragCounter <= 0) {
    dragCounter = 0;
    if (dropOverlay) {
      dropOverlay.classList.add("hidden", "pointer-events-none");
      dropOverlay.classList.remove("flex", "pointer-events-auto");
    }
  }
});

window.addEventListener("dragover", (e) => {
  e.preventDefault();
});

window.addEventListener("drop", (e) => {
  e.preventDefault();
  dragCounter = 0;
  if (dropOverlay) {
    dropOverlay.classList.add("hidden", "pointer-events-none");
    dropOverlay.classList.remove("flex", "pointer-events-auto");
  }
  if (e.dataTransfer && e.dataTransfer.files && e.dataTransfer.files.length > 0) {
    handleFileUpload(e.dataTransfer.files[0]);
  }
});

// Tombol Upload Biasa
if (btnSidebarUpload) btnSidebarUpload.addEventListener("click", () => fileInput.click());
if (btnFabUpload) btnFabUpload.addEventListener("click", () => fileInput.click());

fileInput.addEventListener("change", (e) => {
  if (e.target.files && e.target.files.length > 0) {
    handleFileUpload(e.target.files[0]);
  }
});

function handleFileUpload(file) {
  if (state.isUploading) {
    showToast("Unggahan lain sedang berlangsung. Harap tunggu.", "warning");
    return;
  }

  // Cek duplikasi nama di katalog
  const isDuplicate = state.files.some(
    (f) => f.originalName.toLowerCase() === file.name.toLowerCase()
  );
  if (isDuplicate) {
    showToast(`Berkas "${file.name}" sudah ada di repositori.`, "error");
    fileInput.value = "";
    return;
  }

  // Batalkan jika melebihi sisa kapasitas storage yang tersedia
  if (state.remainingBytes !== undefined && file.size > state.remainingBytes) {
    showToast(
      `Proses unggah dibatalkan: Ukuran berkas (${formatBytes(file.size)}) melebihi sisa kapasitas penyimpanan (${formatBytes(state.remainingBytes)}).`,
      "error"
    );
    fileInput.value = "";
    return;
  }

  state.isUploading = true;
  if (uploadWidgetFilename) uploadWidgetFilename.textContent = file.name;
  if (uploadWidgetPercent) uploadWidgetPercent.textContent = "0%";
  if (uploadWidgetProgressBar) uploadWidgetProgressBar.style.width = "0%";
  if (uploadWidgetStatus) {
    uploadWidgetStatus.innerHTML = '<i class="bi bi-arrow-repeat animate-spin text-emerald-600"></i><span>Mengunggah ke Cloud Storage...</span>';
  }
  if (uploadWidget) uploadWidget.classList.remove("hidden");

  const formData = new FormData();
  formData.append("file", file);

  const xhr = new XMLHttpRequest();
  xhr.open("POST", "/api/files/upload", true);

  xhr.upload.onprogress = (e) => {
    if (e.lengthComputable) {
      const percent = Math.round((e.loaded / e.total) * 100);
      if (uploadWidgetPercent) uploadWidgetPercent.textContent = `${percent}%`;
      if (uploadWidgetProgressBar) uploadWidgetProgressBar.style.width = `${percent}%`;
      if (percent === 100 && uploadWidgetStatus) {
        uploadWidgetStatus.innerHTML = '<i class="bi bi-hdd-network animate-pulse text-emerald-600"></i><span>Menyimpan ke direktori node...</span>';
      }
    }
  };

  xhr.onload = () => {
    state.isUploading = false;
    fileInput.value = "";

    try {
      const res = JSON.parse(xhr.responseText);
      if (xhr.status === 201) {
        showToast(`Berkas "${file.name}" berhasil diunggah.`, "success");
        if (uploadWidgetStatus) {
          uploadWidgetStatus.innerHTML = '<i class="bi bi-check-circle-fill text-emerald-600"></i><span class="text-emerald-700">Unggahan selesai</span>';
        }
        setTimeout(() => {
          if (uploadWidget) uploadWidget.classList.add("hidden");
        }, 2000);
        loadFiles();
        checkServerStatus();
      } else {
        if (uploadWidget) uploadWidget.classList.add("hidden");
        showToast(res.error || `Gagal mengunggah berkas (HTTP ${xhr.status})`, "error");
      }
    } catch (err) {
      if (uploadWidget) uploadWidget.classList.add("hidden");
      showToast(`Kesalahan respon dari server: ${xhr.responseText}`, "error");
    }
  };

  xhr.onerror = () => {
    state.isUploading = false;
    if (uploadWidget) uploadWidget.classList.add("hidden");
    fileInput.value = "";
    showToast("Gagal menghubungi server web lokal.", "error");
  };

  xhr.send(formData);
}

// ============================================================================
// 8. FITUR GANTI NAMA BERKAS (RENAME FILE)
// ============================================================================
window.openRenameModal = function (storageKey) {
  const file = state.files.find((f) => f.storageKey === storageKey);
  if (!file) return;

  state.pendingRenameKey = storageKey;
  renameInputName.value = file.originalName;
  if (renameError) renameError.classList.add("hidden");
  renameModal.classList.remove("hidden");
  setTimeout(() => renameInputName.focus(), 50);
};

function closeRenameModal() {
  renameModal.classList.add("hidden");
  state.pendingRenameKey = null;
  if (renameError) renameError.classList.add("hidden");
}

if (btnCloseRename) btnCloseRename.addEventListener("click", closeRenameModal);
if (btnCancelRename) btnCancelRename.addEventListener("click", closeRenameModal);

if (renameForm) {
  renameForm.addEventListener("submit", async (e) => {
    e.preventDefault();
    if (!state.pendingRenameKey) return;

    const newName = renameInputName.value.trim();
    if (!newName) {
      if (renameError) {
        renameError.textContent = "Nama berkas tidak boleh kosong.";
        renameError.classList.remove("hidden");
      }
      return;
    }

    const submitBtn = document.getElementById("btn-submit-rename");
    if (submitBtn) {
      submitBtn.disabled = true;
      submitBtn.innerHTML = '<i class="bi bi-arrow-repeat animate-spin"></i> Menyimpan...';
    }

    try {
      const res = await fetch(`/api/files/${state.pendingRenameKey}/rename`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ newName }),
      });
      const data = await res.json();

      if (res.ok) {
        showToast("Nama berkas berhasil diperbarui.", "success");
        closeRenameModal();
        loadFiles();
      } else {
        if (renameError) {
          renameError.textContent = data.error || "Gagal mengubah nama berkas.";
          renameError.classList.remove("hidden");
        }
      }
    } catch (err) {
      if (renameError) {
        renameError.textContent = `Kesalahan: ${err.message}`;
        renameError.classList.remove("hidden");
      }
    } finally {
      if (submitBtn) {
        submitBtn.disabled = false;
        submitBtn.innerHTML = '<i class="bi bi-check2"></i> Simpan Nama';
      }
    }
  });
}

// ============================================================================
// 9. UNDUH BERKAS DENGAN INDIKATOR LOADING
// ============================================================================
window.downloadFile = async function (storageKey, btnElement) {
  const file = state.files.find((f) => f.storageKey === storageKey);
  const fileName = file ? file.originalName : "berkas";

  let originalHtml = "";
  if (btnElement) {
    originalHtml = btnElement.innerHTML;
    btnElement.disabled = true;
    btnElement.innerHTML = '<i class="bi bi-arrow-repeat animate-spin"></i>';
    btnElement.classList.add("cursor-wait", "opacity-75");
  }

  showToast(`Menyiapkan unduhan "${fileName}"...`, "info");

  try {
    const res = await fetch(`/api/files/${storageKey}/download`);
    if (!res.ok) {
      throw new Error(`Server merespons dengan HTTP ${res.status}`);
    }

    const blob = await res.blob();
    const blobUrl = window.URL.createObjectURL(blob);
    const tempLink = document.createElement("a");
    tempLink.href = blobUrl;
    tempLink.download = fileName;
    document.body.appendChild(tempLink);
    tempLink.click();
    document.body.removeChild(tempLink);
    window.URL.revokeObjectURL(blobUrl);

    showToast(`Unduhan "${fileName}" berhasil dimulai.`, "success");
  } catch (err) {
    console.error("Gagal mengunduh berkas:", err);
    showToast(`Gagal mengunduh berkas: ${err.message}`, "error");
  } finally {
    if (btnElement) {
      btnElement.disabled = false;
      btnElement.innerHTML = originalHtml;
      btnElement.classList.remove("cursor-wait", "opacity-75");
    }
  }
};

// ============================================================================
// 10. MODAL PRATINJAU BERKAS (PREVIEW MODAL)
// ============================================================================
window.openPreview = async function (storageKey) {
  const file = state.files.find((f) => f.storageKey === storageKey);
  if (!file) return;

  previewTitle.textContent = file.originalName;
  previewMeta.textContent = `${formatBytes(file.size)} • ${getCategoryLabel(file.category)} • ${formatWibDate(file.uploadedAt)}`;
  
  if (previewBtnDownload) {
    previewBtnDownload.onclick = () => {
      downloadFile(file.storageKey, previewBtnDownload);
    };
  }

  if (previewBtnRename) {
    previewBtnRename.onclick = () => {
      closePreview();
      openRenameModal(file.storageKey);
    };
  }

  const previewUrl = `/api/files/${file.storageKey}/preview`;
  previewContent.innerHTML = '<div class="py-12 text-slate-400 flex flex-col items-center"><i class="bi bi-arrow-repeat animate-spin text-2xl mb-2 text-emerald-600"></i>Memuat pratinjau...</div>';
  previewModal.classList.remove("hidden");

  if (file.category === "image") {
    previewIcon.className = "bi bi-file-earmark-image text-emerald-600 text-lg";
    previewContent.innerHTML = `
      <div class="w-full flex items-center justify-center p-2">
        <img src="${previewUrl}" alt="${escapeHtml(file.originalName)}" class="max-h-[60vh] max-w-full object-contain rounded-lg border border-slate-200 shadow-md">
      </div>
    `;
  } else if (file.category === "audio") {
    previewIcon.className = "bi bi-file-earmark-music text-emerald-600 text-lg";
    previewContent.innerHTML = `
      <div class="w-full max-w-md p-6 bg-white border border-slate-200 rounded-xl text-center space-y-4 shadow-xs">
        <div class="w-16 h-16 rounded-full bg-emerald-50 border border-emerald-200 flex items-center justify-center mx-auto text-emerald-600">
          <i class="bi bi-music-note-beamed text-2xl"></i>
        </div>
        <div>
          <p class="font-semibold text-slate-800">${escapeHtml(file.originalName)}</p>
          <p class="text-[11px] text-slate-500 mt-1">Petunjuk: Putar pemutar audio untuk mendengarkan langsung berkas.</p>
        </div>
        <audio controls class="w-full mt-2" src="${previewUrl}"></audio>
      </div>
    `;
  } else if (file.category === "video") {
    previewIcon.className = "bi bi-file-earmark-play text-emerald-600 text-lg";
    previewContent.innerHTML = `
      <div class="w-full flex items-center justify-center">
        <video controls class="max-h-[60vh] max-w-full rounded-lg border border-slate-200 shadow-md" src="${previewUrl}"></video>
      </div>
    `;
  } else if (file.mimeType.includes("pdf")) {
    previewIcon.className = "bi bi-file-earmark-pdf text-emerald-600 text-lg";
    previewContent.innerHTML = `
      <iframe src="${previewUrl}" class="w-full h-[65vh] rounded-lg border border-slate-200 bg-white"></iframe>
    `;
  } else if (
    file.mimeType.includes("text") ||
    file.mimeType.includes("json") ||
    [".txt", ".json", ".md", ".js", ".html", ".css", ".csv"].some((ext) => file.originalName.endsWith(ext))
  ) {
    previewIcon.className = "bi bi-file-earmark-text text-emerald-600 text-lg";
    try {
      const res = await fetch(previewUrl);
      const text = await res.text();
      previewContent.innerHTML = `
        <pre class="w-full max-h-[60vh] p-4 bg-slate-50 border border-slate-200 rounded-lg text-slate-800 font-mono text-xs overflow-auto whitespace-pre-wrap">${escapeHtml(text)}</pre>
      `;
    } catch (err) {
      previewContent.innerHTML = `<p class="text-rose-600 text-xs">Gagal membaca isi teks: ${escapeHtml(err.message)}</p>`;
    }
  } else {
    previewIcon.className = "bi bi-file-earmark-zip text-slate-500 text-lg";
    previewContent.innerHTML = `
      <div class="p-8 text-center bg-white border border-slate-200 rounded-xl max-w-md shadow-xs">
        <i class="bi bi-file-earmark-binary text-4xl text-slate-400 mb-3 block"></i>
        <h4 class="font-bold text-slate-800 text-sm mb-1">${escapeHtml(file.originalName)}</h4>
        <p class="text-xs text-slate-500 mb-4">Pratinjau langsung tidak tersedia untuk format berkas ini. Silakan unduh berkas untuk membukanya di komputer Anda.</p>
        <button onclick="downloadFile('${file.storageKey}', this)" class="inline-flex items-center gap-2 h-9 px-4 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white font-medium text-xs transition">
          <i class="bi bi-download"></i> Unduh Berkas Sekarang
        </button>
      </div>
    `;
  }
};

function closePreview() {
  previewModal.classList.add("hidden");
  previewContent.innerHTML = "";
}

if (previewBtnClose) previewBtnClose.addEventListener("click", closePreview);
if (btnClosePreview) btnClosePreview.addEventListener("click", closePreview);

// ============================================================================
// 10. MODAL KONFIRMASI HAPUS
// ============================================================================
window.openDeleteModal = function (storageKey) {
  const file = state.files.find((f) => f.storageKey === storageKey);
  if (!file) return;

  state.pendingDeleteFile = file;
  deleteFilename.textContent = file.originalName;
  deleteModal.classList.remove("hidden");
};

if (btnCancelDelete) {
  btnCancelDelete.addEventListener("click", () => {
    deleteModal.classList.add("hidden");
    state.pendingDeleteFile = null;
  });
}

if (btnConfirmDelete) {
  btnConfirmDelete.addEventListener("click", async () => {
    if (!state.pendingDeleteFile) return;

    const storageKey = state.pendingDeleteFile.storageKey;
    const fileName = state.pendingDeleteFile.originalName;

    btnConfirmDelete.disabled = true;
    btnConfirmDelete.innerHTML = '<i class="bi bi-arrow-repeat animate-spin"></i> Menghapus...';

    try {
      const res = await fetch(`/api/files/${storageKey}`, { method: "DELETE" });
      const data = await res.json();

      if (res.ok) {
        showToast(`Berkas "${fileName}" berhasil dihapus.`, "success");
        loadFiles();
        checkServerStatus();
      } else {
        showToast(data.error || "Gagal menghapus berkas.", "error");
      }
    } catch (err) {
      showToast(`Gagal menghubungi server: ${err.message}`, "error");
    } finally {
      btnConfirmDelete.disabled = false;
      btnConfirmDelete.innerHTML = '<i class="bi bi-trash"></i> Hapus Permanen';
      deleteModal.classList.add("hidden");
      state.pendingDeleteFile = null;
    }
  });
}

// ============================================================================
// 11. SALIN TAUTAN & CLIPBOARD
// ============================================================================
window.copyToClipboard = function (text, label = "Data") {
  navigator.clipboard
    .writeText(text)
    .then(() => showToast(`${label} berhasil disalin ke clipboard.`, "info"))
    .catch(() => showToast("Gagal menyalin ke clipboard.", "error"));
};

window.copyDirectLink = function (storageKey) {
  const fullUrl = `${window.location.origin}/api/files/${storageKey}/download`;
  copyToClipboard(fullUrl, "Tautan unduh langsung");
};

// ============================================================================
// 12. PENCARIAN, PENGURUTAN, & SINKRONISASI
// ============================================================================
let searchDebounceTimer;
if (searchInput) {
  searchInput.addEventListener("input", (e) => {
    const val = e.target.value.trim();
    if (btnClearSearch) {
      if (val) btnClearSearch.classList.remove("hidden");
      else btnClearSearch.classList.add("hidden");
    }

    clearTimeout(searchDebounceTimer);
    searchDebounceTimer = setTimeout(() => {
      state.searchQuery = val;
      loadFiles();
    }, 250);
  });
}

if (btnClearSearch) {
  btnClearSearch.addEventListener("click", () => {
    if (searchInput) searchInput.value = "";
    btnClearSearch.classList.add("hidden");
    state.searchQuery = "";
    loadFiles();
  });
}

if (sortSelect) {
  sortSelect.addEventListener("change", (e) => {
    state.sortBy = e.target.value;
    loadFiles();
  });
}

if (serverStatusPill) {
  serverStatusPill.addEventListener("click", () => {
    checkServerStatus();
    showToast("Memperbarui status koneksi...", "info");
  });
}

// Tutup modal jika mengklik backdrop luar
[previewModal, deleteModal, renameModal].forEach((modal) => {
  if (modal) {
    modal.addEventListener("click", (e) => {
      if (e.target === modal) {
        modal.classList.add("hidden");
      }
    });
  }
});

// Inisialisasi awal saat halaman dimuat
initSidebarResizer();
checkServerStatus();
loadFiles();
setInterval(checkServerStatus, 30000);
