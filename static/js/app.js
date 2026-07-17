"use strict";

const __goMusicAesJs = require("aes-js");
globalThis.aesjs = __goMusicAesJs;
if (typeof window !== "undefined") window.aesjs = __goMusicAesJs;

(() => {
  const state = {
    sources: [],
    selectedSources: new Set(),
    searchType: "song",
    songs: [],
    playlists: [],
    selected: new Set(),
    settings: {},
    currentSong: null,
    currentIndex: -1,
    isPlaying: false,
    page: 1,
    pageSize: 50,
    total: 0,
    totalPages: 1,
    pageStart: 0,
    pageEnd: 0,
    batchMode: false,
    sourceCollapsed: false,
    pendingLoginSource: "",
    currentObjectUrl: "",
    playRequestId: 0,
    fallbackTried: new Set(),
    fallbackBusy: false,
    logFilters: { level: "", context: "", query: "" },
    sourceSortMode: false,
    draggingSourceId: "",
    playMode: "loop",
    lyrics: [],
    lyricRequestId: 0,
    currentLyricIndex: -1,
    invalidCheckRunId: 0,
    invalidCheckTimer: 0,
    pageLoader: null,
    previousView: null,
    currentViewPath: "",
    playlistView: { sourceTabs: false, emptyText: "暂无歌单", title: "", subtitle: "", icon: "" },
    leaderboardPanel: { activeSource: "", activeBoardKey: "", loading: false, songs: [], playlist: null, error: "", page: 1, pageSize: 30, total: 0, totalPages: 0, pageStart: 0, pageEnd: 0 },
    sourceSwitchModal: { open: false, original: null, originalIndex: -1, activeSource: "", selected: null, groups: [], loading: false, error: "", requestId: 0 },
  };

  const LOG_STORAGE_KEY = "go_music_js_logs";
  const MAX_LOG_ENTRIES = 200;
  const $ = (id) => document.getElementById(id);
  const audio = $("audio");
  const searchTypeInputs = Array.from(document.querySelectorAll('input[name="searchType"]'));
  const searchForm = $("searchForm");
  let operationToastTimer = null;

  const SOURCE_SUPPORTS = {
    song: "searchSupported",
    playlist: "playlistSupported",
    album: "albumSupported",
  };
  const QR_LOGIN_SOURCES = {
    netease: "网易云音乐",
    qq: "QQ音乐",
    qq_wx: "QQ音乐微信",
    kugou: "酷狗音乐",
    bilibili: "Bilibili",
  };
  const QR_LOGIN_COOKIE_SOURCES = {
    qq_wx: "qq",
  };
  const RECOMMEND_PLAYLIST_SOURCES = ["kuwo", "netease", "qq", "kugou"];
  const LEADERBOARD_SOURCES = ["kuwo", "netease", "qq", "kugou"];
  const DEFAULT_SOURCE_ORDER = [
    "kuwo",
    "netease",
    "qq",
    "kugou",
    "migu",
    "soda",
    "bilibili",
    "joox",
    "apple",
    "qianqian",
    "fivesing",
    "jamendo",
  ];
  const SETTINGS_PLATFORM_ORDER = [
    "netease",
    "qq",
    "kugou",
    "kuwo",
    "soda",
    "bilibili",
    "migu",
    "joox",
    "apple",
    "qianqian",
    "fivesing",
    "jamendo",
  ];

  const DOWNLOAD_DIR_CUSTOM_VALUE = "__custom__";
  const PLAY_MODES = [
    { id: "repeat-one", title: "单曲循环" },
    { id: "order", title: "顺序播放" },
    { id: "loop", title: "循环播放" },
    { id: "shuffle", title: "随机播放" },
  ];
  const DOWNLOAD_DIR_PRESETS = new Set([
    "data/downloads",
    "downloads",
    "D:/Music/Downloads",
    "/sdcard/Music",
    "/storage/emulated/0/Music",
    "/sdcard/Download",
  ]);
  const DEFAULT_WEB_SETTINGS = {
    embedDownload: true,
    downloadDir: "data/downloads",
    downloadFilenameTemplate: "{name} - {artist}",
    disableFloatingLyrics: false,
    webPageSize: 50,
    cliPageSize: 20,
    downloadConcurrency: 3,
    vgChangeCover: false,
    vgChangeAudio: false,
    vgChangeLyric: false,
    vgExportVideo: false,
    sourceOrder: [],
  };

  function intSetting(value, fallback) {
    const n = Number(value);
    if (!Number.isFinite(n) || n <= 0) return fallback;
    return Math.min(Math.floor(n), 200);
  }

  function concurrencySetting(value, fallback) {
    const n = Number(value);
    if (!Number.isFinite(n) || n <= 0) return fallback;
    return Math.min(Math.floor(n), 16);
  }

  function normalizeWebSettings(raw = {}) {
    const normalized = {
      ...DEFAULT_WEB_SETTINGS,
      ...raw,
      embedDownload: typeof raw.embedDownload === "boolean" ? raw.embedDownload : DEFAULT_WEB_SETTINGS.embedDownload,
      disableFloatingLyrics: typeof raw.disableFloatingLyrics === "boolean" ? raw.disableFloatingLyrics : DEFAULT_WEB_SETTINGS.disableFloatingLyrics,
      webPageSize: intSetting(raw.webPageSize, DEFAULT_WEB_SETTINGS.webPageSize),
      cliPageSize: intSetting(raw.cliPageSize, DEFAULT_WEB_SETTINGS.cliPageSize),
      downloadConcurrency: concurrencySetting(raw.downloadConcurrency, DEFAULT_WEB_SETTINGS.downloadConcurrency),
      vgChangeCover: !!raw.vgChangeCover,
      vgChangeAudio: !!raw.vgChangeAudio,
      vgChangeLyric: !!raw.vgChangeLyric,
      vgExportVideo: !!raw.vgExportVideo,
      sourceOrder: Array.isArray(raw.sourceOrder) ? raw.sourceOrder.map(String).filter(Boolean) : Array.isArray(raw.source_order) ? raw.source_order.map(String).filter(Boolean) : [],
      downloadDir: String(raw.downloadDir || DEFAULT_WEB_SETTINGS.downloadDir).trim() || DEFAULT_WEB_SETTINGS.downloadDir,
      downloadFilenameTemplate: String(raw.downloadFilenameTemplate || DEFAULT_WEB_SETTINGS.downloadFilenameTemplate).trim() || DEFAULT_WEB_SETTINGS.downloadFilenameTemplate,
    };
    delete normalized.autoSwitchInvalidSources;
    return normalized;
  }

  function setChecked(id, value) {
    const el = $(id);
    if (el) el.checked = !!value;
  }

  function setValue(id, value) {
    const el = $(id);
    if (el) el.value = value === undefined || value === null ? "" : String(value);
  }

  function safeJsonParse(value, fallback) {
    try {
      return JSON.parse(value);
    } catch {
      return fallback;
    }
  }

  function escapeHtml(value) {
    return String(value === undefined || value === null ? "" : value).replace(/[&<>"']/g, (char) => ({
      "&": "&amp;",
      "<": "&lt;",
      ">": "&gt;",
      '"': "&quot;",
      "'": "&#39;",
    })[char]);
  }

  function loadLogs() {
    try {
      const logs = safeJsonParse(localStorage.getItem(LOG_STORAGE_KEY) || "[]", []);
      return Array.isArray(logs) ? logs.slice(-MAX_LOG_ENTRIES) : [];
    } catch {
      return [];
    }
  }

  function saveLogs(logs) {
    try {
      localStorage.setItem(LOG_STORAGE_KEY, JSON.stringify(logs.slice(-MAX_LOG_ENTRIES)));
    } catch {
      // Ignore storage failures; logging must never break the plugin.
    }
  }

  function logDetailText(detail) {
    if (detail === undefined || detail === null || detail === "") return "";
    if (detail instanceof Error) return detail.stack || detail.message;
    if (typeof detail === "string") return detail;
    try {
      return JSON.stringify(detail, null, 2);
    } catch {
      return String(detail);
    }
  }

  function visibleSources() {
    return state.sources.filter((source) => source.id !== "local");
  }

  function sourceOrderIds() {
    return visibleSources().map((source) => source.id);
  }

  function sourceOrderIndex(sourceId) {
    const order = sourceOrderIds();
    const index = order.indexOf(String(sourceId || ""));
    return index === -1 ? order.length + 1 : index;
  }

  function sourceDisplayName(sourceId) {
    const id = String(sourceId || "").trim();
    const source = state.sources.find((item) => item.id === id);
    const fallback = {
      netease: "网易云音乐",
      qq: "QQ音乐",
      kugou: "酷狗音乐",
      kuwo: "酷我音乐",
      migu: "咪咕音乐",
      soda: "汽水音乐",
      bilibili: "Bilibili",
      apple: "Apple Music",
      qianqian: "千千音乐",
      joox: "JOOX",
      fivesing: "5sing",
      jamendo: "Jamendo",
      local: "本地音乐",
    };
    return fallback[id] || source?.name || source?.shortName || id || "-";
  }

  function applySourceOrder(order = []) {
    const preferred = Array.isArray(order) ? order.map(String).filter(Boolean) : [];
    if (!preferred.length) return;
    const score = new Map(preferred.map((id, index) => [id, index]));
    const original = new Map(state.sources.map((source, index) => [source.id, index]));
    state.sources.sort((a, b) => {
      const ai = score.has(a.id) ? score.get(a.id) : preferred.length + (original.get(a.id) || 0);
      const bi = score.has(b.id) ? score.get(b.id) : preferred.length + (original.get(b.id) || 0);
      return ai - bi;
    });
  }

  function applyConfiguredSourceOrder() {
    const configured = normalizeWebSettings(state.settings || {}).sourceOrder;
    applySourceOrder(configured.length ? configured : DEFAULT_SOURCE_ORDER);
  }

  function sortSongsBySourceOrder(songs) {
    return [...songs].sort((a, b) => {
      const sourceDiff = sourceOrderIndex(a.source) - sourceOrderIndex(b.source);
      if (sourceDiff !== 0) return sourceDiff;
      return 0;
    });
  }

  function renderLogs() {
    const host = $("logWindow");
    if (!host) return;
    const logs = loadLogs();
    const contextFilter = $("logContextFilter");
    if (contextFilter) {
      const contexts = Array.from(new Set(logs.map((item) => item.context || "Go Music JS").filter(Boolean))).sort();
      const current = state.logFilters.context || contextFilter.value || "";
      contextFilter.innerHTML = '<option value="">全部模块</option>' + contexts.map((context) => `<option value="${escapeHtml(context)}">${escapeHtml(context)}</option>`).join("");
      contextFilter.value = contexts.includes(current) ? current : "";
      state.logFilters.context = contextFilter.value;
    }
    const levelFilter = $("logLevelFilter");
    if (levelFilter) levelFilter.value = state.logFilters.level || "";
    const query = String(state.logFilters.query || "").trim().toLowerCase();
    const filtered = logs.filter((item) => {
      const level = String(item.level || "info").toLowerCase();
      const context = String(item.context || "Go Music JS");
      const text = `${item.time || ""} ${level} ${context} ${item.message || ""} ${item.detail || ""}`.toLowerCase();
      if (state.logFilters.level && level !== state.logFilters.level) return false;
      if (state.logFilters.context && context !== state.logFilters.context) return false;
      if (query && !text.includes(query)) return false;
      return true;
    });
    if (!logs.length) {
      host.innerHTML = '<div class="log-empty">暂无日志</div>';
      return;
    }
    if (!filtered.length) {
      host.innerHTML = '<div class="log-empty">没有匹配的日志</div>';
      return;
    }
    host.innerHTML = filtered.map((item) => {
      const level = String(item.level || "info").toLowerCase();
      const detail = item.detail ? `<div class="log-detail">${escapeHtml(item.detail)}</div>` : "";
      return `
        <div class="log-entry">
          <div class="log-entry-head">
            <span class="log-time">${escapeHtml(item.time || "")}</span>
            <span class="log-level ${escapeHtml(level)}">${escapeHtml(level.toUpperCase())}</span>
            <span class="log-context">${escapeHtml(item.context || "Go Music JS")}</span>
          </div>
          <div class="log-message">${escapeHtml(item.message || "")}</div>
          ${detail}
        </div>
      `;
    }).join("");
    host.scrollTop = host.scrollHeight;
  }

  function addLog(level, context, message, detail = "") {
    const logs = loadLogs();
    logs.push({
      time: new Date().toLocaleString(),
      level: level || "info",
      context: context || "Go Music JS",
      message: String(message || ""),
      detail: logDetailText(detail),
    });
    saveLogs(logs);
    renderLogs();
  }

  function clearLogs() {
    saveLogs([]);
    renderLogs();
    setStatus("日志已清空");
  }

  function syncDownloadDirPreset() {
    const preset = $("settingDownloadDirPreset");
    const input = $("settingDownloadDir");
    if (!preset || !input) return;
    const normalized = String(input.value || "").trim().replace(/\\/g, "/");
    preset.value = DOWNLOAD_DIR_PRESETS.has(normalized) ? normalized : DOWNLOAD_DIR_CUSTOM_VALUE;
  }

  function collectWebSettings() {
    const current = normalizeWebSettings(state.settings || {});
    return normalizeWebSettings({
      ...current,
      embedDownload: !!$("settingEmbedDownload")?.checked,
      downloadDir: $("settingDownloadDir")?.value || current.downloadDir,
      downloadFilenameTemplate: $("settingDownloadFilenameTemplate")?.value || current.downloadFilenameTemplate,
      webPageSize: intSetting($("settingWebPageSize")?.value, current.webPageSize),
    });
  }
  function applySettingsToForm(settings) {
    const web = normalizeWebSettings(settings || {});
    setChecked("settingEmbedDownload", web.embedDownload);
    setChecked("settingFloatingLyrics", !web.disableFloatingLyrics);
    setValue("settingDownloadDir", web.downloadDir);
    setValue("settingDownloadFilenameTemplate", web.downloadFilenameTemplate);
    setValue("settingWebPageSize", web.webPageSize);
    setValue("settingCliPageSize", web.cliPageSize);
    setValue("settingDownloadConcurrency", web.downloadConcurrency);
    syncDownloadDirPreset();
  }

  function openUrl(url) {
    if (!url) return;
    const win = window.open(url, "_blank", "noopener,noreferrer");
    if (!win) window.location.href = url;
  }

  function pluginUrl(path, query = {}) {
    const base = new URL("./", window.location.href);
    const cleanPath = String(path || "").replace(/^\/+/, "");
    const url = new URL(cleanPath, base);
    Object.entries(query || {}).forEach(([key, value]) => {
      if (value === undefined || value === null || value === "") return;
      if (Array.isArray(value)) {
        value.forEach((item) => {
          if (item !== undefined && item !== null && item !== "") url.searchParams.append(key, String(item));
        });
      } else {
        url.searchParams.set(key, String(value));
      }
    });
    return url.toString();
  }

  const INTERNAL_PAGE_PATHS = new Set([
    "/",
    "/login",
    "/recommend",
    "/leaderboards",
    "/leaderboard",
    "/my_collections",
    "/local_music_page",
    "/playlist_categories",
    "/user_playlists",
    "/playlist",
    "/player",
  ]);

  function searchParamsToQuery(searchParams) {
    const query = {};
    searchParams.forEach((value, key) => {
      if (query[key] === undefined) {
        query[key] = value;
      } else if (Array.isArray(query[key])) {
        query[key].push(value);
      } else {
        query[key] = [query[key], value];
      }
    });
    return query;
  }

  function shouldCaptureBackView(path) {
    return path === "/playlist" || path === "/leaderboard";
  }

  function hasRestorableView() {
    return state.songs.length > 0 || state.playlists.length > 0;
  }

  function captureBackView() {
    state.previousView = {
      searchType: state.searchType,
      songs: [...state.songs],
      playlists: [...state.playlists],
      selected: new Set(state.selected),
      page: state.page,
      pageSize: state.pageSize,
      total: state.total,
      totalPages: state.totalPages,
      pageStart: state.pageStart,
      pageEnd: state.pageEnd,
      pageLoader: state.pageLoader,
      playlistView: { ...state.playlistView },
      path: state.currentViewPath || "",
      statusText: $("status")?.textContent || "",
      statusError: !!$("status")?.classList.contains("error"),
    };
    updateBackButton();
  }

  function restoreBackView() {
    const previous = state.previousView;
    if (!previous) return;
    clearInvalidSongValidation();
    state.searchType = previous.searchType || "song";
    state.songs = Array.isArray(previous.songs) ? previous.songs : [];
    state.playlists = Array.isArray(previous.playlists) ? previous.playlists : [];
    state.selected = previous.selected instanceof Set ? new Set(previous.selected) : new Set();
    state.page = Number(previous.page || 1);
    state.pageSize = Number(previous.pageSize || state.pageSize || DEFAULT_WEB_SETTINGS.webPageSize);
    state.total = Number(previous.total || 0);
    state.totalPages = Number(previous.totalPages || 0);
    state.pageStart = Number(previous.pageStart || 0);
    state.pageEnd = Number(previous.pageEnd || 0);
    state.pageLoader = typeof previous.pageLoader === "function" ? previous.pageLoader : null;
    state.playlistView = { sourceTabs: false, emptyText: "暂无歌单", title: "", subtitle: "", icon: "", ...(previous.playlistView || {}) };
    state.previousView = null;
    state.currentViewPath = previous.path || "/playlist_list";
    renderResults();
    setStatus(previous.statusText || "", previous.statusError);
    updateBackButton();
  }

  function updateBackButton() {
    const toolbar = $("viewToolbar");
    if (!toolbar) return;
    const show = !!state.previousView;
    toolbar.hidden = !show;
    toolbar.classList.toggle("active", show);
  }

  function clearBackView() {
    state.previousView = null;
    updateBackButton();
  }

  function openServicePath(path, query = {}) {
    const normalizedPath = String(path || "");
    if (INTERNAL_PAGE_PATHS.has(normalizedPath)) {
      if (normalizedPath === "/login") {
        focusLoginCookie(query.source || "");
        return;
      }
      if (shouldCaptureBackView(normalizedPath)) {
        if (!state.previousView && hasRestorableView()) captureBackView();
      } else {
        clearBackView();
      }
      state.currentViewPath = normalizedPath;
      if (normalizedPath === "/recommend") {
        loadRecommendView(query.sources).catch((error) => setStatus(`加载每日推荐失败：${error.message}`, true));
        return;
      }
      if (normalizedPath === "/leaderboards") {
        loadLeaderboardView(query.sources).catch((error) => setStatus(`加载排行榜失败：${error.message}`, true));
        return;
      }
      if (normalizedPath === "/my_collections") {
        loadCollectionsView().catch((error) => setStatus(`加载本地歌单失败：${error.message}`, true));
        return;
      }
      if (normalizedPath === "/local_music_page") {
        loadLocalMusicView().catch((error) => setStatus(`加载本地音乐失败：${error.message}`, true));
        return;
      }
      if (normalizedPath === "/playlist_categories") {
        loadCategoryView(query.sources).catch((error) => setStatus(`加载歌单分类失败：${error.message}`, true));
        return;
      }
      if (normalizedPath === "/user_playlists") {
        loadUserPlaylistView(query.sources).catch((error) => setStatus(`加载我的歌单失败：${error.message}`, true));
        return;
      }
      if (normalizedPath === "/playlist") {
        loadPlaylistDetailView(query).catch((error) => setStatus(`加载歌单失败：${error.message}`, true));
        return;
      }
      if (normalizedPath === "/leaderboard") {
        loadLeaderboardDetailView(query).catch((error) => setStatus(`加载排行榜失败：${error.message}`, true));
        return;
      }
      if (normalizedPath === "/player" || normalizedPath === "/") {
        return;
      }
      return;
    }
    openUrl(pluginUrl(path, query));
  }

  function openServiceAbsolute(path) {
    if (!path) return;
    if (/^https?:\/\//i.test(path)) {
      openUrl(path);
      return;
    }
    if (String(path).startsWith("/")) {
      const url = new URL(path, window.location.href);
      openServicePath(url.pathname, searchParamsToQuery(url.searchParams));
      return;
    }
    try {
      openUrl(new URL(path, window.location.href).toString());
      return;
    } catch {
      openUrl(pluginUrl(path));
    }
  }

  function normalizeSourceList(value, fallback = []) {
    const raw = Array.isArray(value) ? value : String(value || "").split(",");
    const list = raw.map((item) => String(item || "").trim()).filter(Boolean);
    return list.length ? Array.from(new Set(list)) : fallback.slice();
  }

  function focusLoginCookie(sourceId) {
    const dialog = $("settingsDialog");
    if (dialog && !dialog.open) dialog.showModal();
    loadSettings().catch(() => {});
    loadCookies()
      .then(() => {
        const id = String(sourceId || "").trim();
        if (!id) return;
        const input = document.querySelector(`#cookieFields input[data-source="${CSS.escape(id)}"]`);
        if (input) {
          input.focus();
          input.closest(".cookie-field")?.scrollIntoView({ block: "center", behavior: "smooth" });
        }
      })
      .catch(() => {});
    setStatus(sourceId ? `${sourceId} 的 Cookie 请直接粘贴在设置里。` : "请在设置里粘贴 Cookie。");
  }

  let qrLoginPollTimer = 0;
  let qrLoginPollBusy = false;
  let qrLoginState = { source: "", key: "" };

  function qrCookieSource(source) {
    return QR_LOGIN_COOKIE_SOURCES[source] || source;
  }

  function setQRStatus(message, type = "") {
    const el = $("qrLoginStatus");
    if (!el) return;
    el.textContent = message || "";
    el.className = `qr-login-status${type ? ` ${type}` : ""}`;
    if (type === "error" && message) addLog("error", "扫码登录", message);
  }

  function setQRLoading(show, message = "正在生成二维码...") {
    const loading = $("qrLoginLoading");
    const image = $("qrLoginImage");
    if (loading) {
      loading.textContent = message;
      loading.style.display = show ? "flex" : "none";
    }
    if (image && show) image.style.display = "none";
  }

  function qrUtf8Bytes(text) {
    if (window.TextEncoder) return Array.from(new TextEncoder().encode(text));
    return Array.from(unescape(encodeURIComponent(text)), (ch) => ch.charCodeAt(0));
  }

  function qrAppendBits(bits, value, length) {
    for (let i = length - 1; i >= 0; i--) bits.push(((value >>> i) & 1) !== 0);
  }

  const QR_VERSION_SPECS = [
    null,
    { data: 19, ecc: 7, blocks: 1, align: [] },
    { data: 34, ecc: 10, blocks: 1, align: [6, 18] },
    { data: 55, ecc: 15, blocks: 1, align: [6, 22] },
    { data: 80, ecc: 20, blocks: 1, align: [6, 26] },
    { data: 108, ecc: 26, blocks: 1, align: [6, 30] },
    { data: 136, ecc: 18, blocks: 2, align: [6, 34] },
  ];

  function qrPickVersion(byteLength) {
    for (let version = 1; version < QR_VERSION_SPECS.length; version++) {
      if (byteLength <= Math.floor((QR_VERSION_SPECS[version].data * 8 - 12) / 8)) return version;
    }
    throw new Error("二维码内容过长，请刷新重试");
  }

  function qrGfMul(x, y) {
    let z = 0;
    for (let i = 7; i >= 0; i--) {
      z = ((z << 1) ^ ((z >>> 7) * 0x11d)) & 0xff;
      if (((y >>> i) & 1) !== 0) z ^= x;
    }
    return z;
  }

  function qrRsGenerator(degree) {
    const result = new Array(degree).fill(0);
    result[degree - 1] = 1;
    let root = 1;
    for (let i = 0; i < degree; i++) {
      for (let j = 0; j < degree; j++) {
        result[j] = qrGfMul(result[j], root);
        if (j + 1 < degree) result[j] ^= result[j + 1];
      }
      root = qrGfMul(root, 2);
    }
    return result;
  }

  function qrRsRemainder(data, generator) {
    const result = new Array(generator.length).fill(0);
    data.forEach((value) => {
      const factor = value ^ result.shift();
      result.push(0);
      for (let i = 0; i < result.length; i++) result[i] ^= qrGfMul(generator[i], factor);
    });
    return result;
  }

  function qrCodewords(text) {
    const bytes = qrUtf8Bytes(text);
    const version = qrPickVersion(bytes.length);
    const spec = QR_VERSION_SPECS[version];
    const bits = [];
    qrAppendBits(bits, 0x4, 4);
    qrAppendBits(bits, bytes.length, 8);
    bytes.forEach((value) => qrAppendBits(bits, value, 8));
    const maxBits = spec.data * 8;
    if (bits.length > maxBits) throw new Error("二维码内容过长");
    for (let i = 0, n = Math.min(4, maxBits - bits.length); i < n; i++) bits.push(false);
    while (bits.length % 8 !== 0) bits.push(false);

    const data = [];
    for (let i = 0; i < bits.length; i += 8) {
      let value = 0;
      for (let j = 0; j < 8; j++) value = (value << 1) | (bits[i + j] ? 1 : 0);
      data.push(value);
    }
    for (let pad = 0xec; data.length < spec.data; pad ^= 0xfd) data.push(pad);

    const generator = qrRsGenerator(spec.ecc);
    const blockLen = spec.data / spec.blocks;
    const blocks = [];
    for (let i = 0; i < spec.blocks; i++) {
      const block = data.slice(i * blockLen, (i + 1) * blockLen);
      blocks.push({ data: block, ecc: qrRsRemainder(block, generator) });
    }

    const result = [];
    for (let i = 0; i < blockLen; i++) blocks.forEach((block) => result.push(block.data[i]));
    for (let i = 0; i < spec.ecc; i++) blocks.forEach((block) => result.push(block.ecc[i]));
    return { version, codewords: result };
  }

  function qrSetModule(qr, x, y, dark, fixed = false) {
    if (x < 0 || y < 0 || x >= qr.size || y >= qr.size) return;
    qr.modules[y][x] = !!dark;
    if (fixed) qr.fixed[y][x] = true;
  }

  function qrAddFinder(qr, cx, cy) {
    for (let dy = -4; dy <= 4; dy++) {
      for (let dx = -4; dx <= 4; dx++) {
        const dist = Math.max(Math.abs(dx), Math.abs(dy));
        qrSetModule(qr, cx + dx, cy + dy, dist !== 2 && dist !== 4, true);
      }
    }
  }

  function qrAddAlignment(qr, cx, cy) {
    for (let dy = -2; dy <= 2; dy++) {
      for (let dx = -2; dx <= 2; dx++) {
        const dist = Math.max(Math.abs(dx), Math.abs(dy));
        qrSetModule(qr, cx + dx, cy + dy, dist === 0 || dist === 2, true);
      }
    }
  }

  function qrFormatBits(mask) {
    const data = (1 << 3) | mask;
    let bits = data << 10;
    for (let i = 14; i >= 10; i--) {
      if (((bits >>> i) & 1) !== 0) bits ^= 0x537 << (i - 10);
    }
    return ((data << 10) | (bits & 0x3ff)) ^ 0x5412;
  }

  function qrPlaceFormat(qr, mask) {
    const bits = qrFormatBits(mask);
    const n = qr.size;
    for (let i = 0; i <= 5; i++) qrSetModule(qr, 8, i, ((bits >>> i) & 1) !== 0, true);
    qrSetModule(qr, 8, 7, ((bits >>> 6) & 1) !== 0, true);
    qrSetModule(qr, 8, 8, ((bits >>> 7) & 1) !== 0, true);
    qrSetModule(qr, 7, 8, ((bits >>> 8) & 1) !== 0, true);
    for (let i = 9; i < 15; i++) qrSetModule(qr, 14 - i, 8, ((bits >>> i) & 1) !== 0, true);
    for (let i = 0; i < 8; i++) qrSetModule(qr, n - 1 - i, 8, ((bits >>> i) & 1) !== 0, true);
    for (let i = 8; i < 15; i++) qrSetModule(qr, 8, n - 15 + i, ((bits >>> i) & 1) !== 0, true);
    qrSetModule(qr, 8, n - 8, true, true);
  }

  function qrBuildMatrix(text) {
    const { version, codewords } = qrCodewords(text);
    const size = 17 + version * 4;
    const qr = {
      size,
      modules: Array.from({ length: size }, () => new Array(size).fill(false)),
      fixed: Array.from({ length: size }, () => new Array(size).fill(false)),
    };
    qrAddFinder(qr, 3, 3);
    qrAddFinder(qr, size - 4, 3);
    qrAddFinder(qr, 3, size - 4);
    for (let i = 8; i < size - 8; i++) {
      qrSetModule(qr, i, 6, i % 2 === 0, true);
      qrSetModule(qr, 6, i, i % 2 === 0, true);
    }
    QR_VERSION_SPECS[version].align.forEach((cy) => {
      QR_VERSION_SPECS[version].align.forEach((cx) => {
        if (!qr.fixed[cy][cx]) qrAddAlignment(qr, cx, cy);
      });
    });
    for (let i = 0; i < 9; i++) {
      if (i !== 6) {
        qrSetModule(qr, 8, i, false, true);
        qrSetModule(qr, i, 8, false, true);
      }
    }
    for (let i = 0; i < 8; i++) qrSetModule(qr, size - 1 - i, 8, false, true);
    for (let i = 0; i < 7; i++) qrSetModule(qr, 8, size - 1 - i, false, true);
    qrSetModule(qr, 8, size - 8, true, true);

    const bits = [];
    codewords.forEach((value) => qrAppendBits(bits, value, 8));
    let bitIndex = 0;
    let upward = true;
    for (let right = size - 1; right >= 1; right -= 2) {
      if (right === 6) right--;
      for (let vert = 0; vert < size; vert++) {
        const y = upward ? size - 1 - vert : vert;
        for (let j = 0; j < 2; j++) {
          const x = right - j;
          if (qr.fixed[y][x]) continue;
          let dark = bitIndex < bits.length ? bits[bitIndex] : false;
          bitIndex++;
          if ((x + y) % 2 === 0) dark = !dark;
          qrSetModule(qr, x, y, dark, false);
        }
      }
      upward = !upward;
    }
    qrPlaceFormat(qr, 0);
    return qr;
  }

  function drawQRCodeToCanvas(text, canvas) {
    const qr = qrBuildMatrix(text);
    const logicalSize = 220;
    const dpr = Math.max(1, window.devicePixelRatio || 1);
    canvas.width = logicalSize * dpr;
    canvas.height = logicalSize * dpr;
    canvas.style.width = `${logicalSize}px`;
    canvas.style.height = `${logicalSize}px`;
    const ctx = canvas.getContext("2d");
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.fillStyle = "#ffffff";
    ctx.fillRect(0, 0, logicalSize, logicalSize);
    const border = 4;
    const scale = Math.max(1, Math.floor(logicalSize / (qr.size + border * 2)));
    const offset = Math.floor((logicalSize - (qr.size + border * 2) * scale) / 2) + border * scale;
    ctx.fillStyle = "#0f172a";
    for (let y = 0; y < qr.size; y++) {
      for (let x = 0; x < qr.size; x++) {
        if (qr.modules[y][x]) ctx.fillRect(offset + x * scale, offset + y * scale, scale, scale);
      }
    }
  }

  function clearQRLoginPoll() {
    if (qrLoginPollTimer) {
      window.clearInterval(qrLoginPollTimer);
      qrLoginPollTimer = 0;
    }
    qrLoginPollBusy = false;
  }

  function closeQRLogin() {
    clearQRLoginPoll();
    const dialog = $("qrLoginDialog");
    if (dialog?.open) dialog.close();
  }

  function renderQRSession(session) {
    const image = $("qrLoginImage");
    const canvas = $("qrLoginCanvas");
    const url = String(session?.image_url || session?.imageURL || "").trim();
    const loginUrl = String(session?.url || session?.URL || "").trim();
    if (url && image) {
      image.src = url;
      image.style.display = "block";
      if (canvas) canvas.style.display = "none";
      setQRLoading(false);
      return;
    }
    if (!loginUrl || !canvas) throw new Error("二维码内容为空");
    drawQRCodeToCanvas(loginUrl, canvas);
    canvas.style.display = "block";
    if (image) image.style.display = "none";
    setQRLoading(false);
  }

  function cookieFromQRResult(result) {
    const direct = String(result?.cookie || "").trim();
    if (direct) return direct;
    const cookies = result?.cookies;
    if (!cookies || typeof cookies !== "object") return "";
    return Object.keys(cookies)
      .filter((key) => String(key || "").trim() && String(cookies[key] || "").trim())
      .sort()
      .map((key) => `${key}=${cookies[key]}`)
      .join("; ");
  }

  async function handleQRLoginSuccess(result) {
    clearQRLoginPoll();
    const source = qrCookieSource(qrLoginState.source);
    const cookie = cookieFromQRResult(result);
    if (!cookie || result?.extra?.cookie_saved === "false") {
      setQRStatus("扫码已确认，但未获取到完整登录 Cookie，请改用 Cookies 登录", "error");
      setStatus(`${QR_LOGIN_SOURCES[qrLoginState.source] || source} 登录失败：未获取到完整 Cookie`, true);
      addLog("error", "扫码登录", "扫码成功但未获取到完整登录 Cookie", {
        source,
        status: result?.status || "",
        extra: result?.extra || {},
      });
      return;
    }
    const input = document.querySelector(`#cookieFields input[data-source="${CSS.escape(source)}"]`);
    if (input) input.value = cookie;
    showOperationToast(`${QR_LOGIN_SOURCES[qrLoginState.source] || source} 登录成功，Cookie 已保存`);
    setQRStatus("登录成功，Cookie 已保存", "success");
    setStatus(`${QR_LOGIN_SOURCES[qrLoginState.source] || source} 登录成功`);
    window.setTimeout(() => {
      closeQRLogin();
    }, 900);
  }

  async function pollQRLogin() {
    if (!qrLoginState.source || !qrLoginState.key || qrLoginPollBusy) return;
    qrLoginPollBusy = true;
    try {
      const params = new URLSearchParams({ source: qrLoginState.source, key: qrLoginState.key });
      const result = await api(`./api/qr_login?${params.toString()}`);
      const status = String(result?.status || "");
      const message = String(result?.message || "").trim();
      if (status === "success") {
        await handleQRLoginSuccess(result);
      } else if (status === "scanned") {
        setQRStatus(message || "已扫码，请在手机上确认", "warning");
      } else if (status === "waiting") {
        setQRStatus(message || "等待扫码中");
      } else if (status === "expired") {
        clearQRLoginPoll();
        setQRStatus(message || "二维码已过期，请刷新", "warning");
      } else {
        clearQRLoginPoll();
        setQRStatus(message || "登录失败，请刷新重试", "error");
      }
    } catch (error) {
      clearQRLoginPoll();
      setQRStatus(error.message || "登录状态检查失败", "error");
    } finally {
      qrLoginPollBusy = false;
    }
  }

  async function startQRLogin(source) {
    source = String(source || "").trim();
    if (!QR_LOGIN_SOURCES[source]) {
      setStatus(`${source || "当前平台"}暂不支持扫码登录`, true);
      return;
    }
    clearQRLoginPoll();
    qrLoginState = { source, key: "" };
    const settingsDialog = $("settingsDialog");
    if (settingsDialog?.open) settingsDialog.close();
    const dialog = $("qrLoginDialog");
    $("qrLoginTitle").textContent = `${QR_LOGIN_SOURCES[source]}扫码登录`;
    setQRStatus("请使用对应 App 扫码登录");
    setQRLoading(true);
    try {
      dialog.showModal();
    } catch {
      dialog.show();
    }
    try {
      const session = await api(`./api/qr_login?source=${encodeURIComponent(source)}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ source }),
      });
      qrLoginState.key = String(session?.key || "");
      renderQRSession(session);
      setQRStatus("二维码已生成，请扫码");
      await pollQRLogin();
      qrLoginPollTimer = window.setInterval(pollQRLogin, 2200);
    } catch (error) {
      setQRLoading(false);
      setQRStatus(error.message || "二维码创建失败", "error");
    }
  }

  function showSongResults(songs, statusText = "", options = {}) {
    setSearchType("song");
    state.songs = Array.isArray(songs) ? songs : [];
    state.playlists = [];
    state.selected.clear();
    state.pageLoader = typeof options.pageLoader === "function" ? options.pageLoader : null;
    state.page = Number(options.page || 1);
    state.pageSize = Number(options.pageSize || state.pageSize || DEFAULT_WEB_SETTINGS.webPageSize);
    state.total = Number(options.total ?? state.songs.length);
    state.totalPages = Number(options.totalPages || (state.total > 0 ? Math.max(1, Math.ceil(state.total / Math.max(state.pageSize, 1))) : 0));
    state.pageStart = Number(options.pageStart || (state.total > 0 ? (state.page - 1) * state.pageSize + 1 : 0));
    state.pageEnd = Number(options.pageEnd || (state.total > 0 ? state.pageStart + state.songs.length - 1 : 0));
    renderResults();
    if (statusText) setStatus(statusText);
  }

  function showPlaylistResults(playlists, statusText = "", options = {}) {
    setSearchType("playlist");
    state.playlists = Array.isArray(playlists) ? playlists : [];
    state.songs = [];
    state.selected.clear();
    state.pageLoader = null;
    state.playlistView = {
      sourceTabs: !!options.sourceTabs,
      emptyText: options.emptyText || "暂无歌单",
      title: options.title || statusText || "歌单",
      subtitle: options.subtitle || "",
      icon: options.icon || "",
      kind: options.kind || "",
      gridClass: options.gridClass || "",
      sources: Array.isArray(options.sources) ? options.sources.map(String).filter(Boolean) : [],
    };
    state.page = 1;
    state.pageSize = state.pageSize || DEFAULT_WEB_SETTINGS.webPageSize;
    state.total = state.playlists.length;
    state.totalPages = state.total > 0 ? 1 : 0;
    state.pageStart = state.total > 0 ? 1 : 0;
    state.pageEnd = state.total;
    renderResults();
    if (statusText) setStatus(statusText);
  }

  async function loadRecommendView(sources = []) {
    const params = new URLSearchParams();
    normalizeSourceList(sources, RECOMMEND_PLAYLIST_SOURCES).forEach((source) => params.append("sources", source));
    const data = await api(`./api/recommend${params.toString() ? `?${params.toString()}` : ""}`);
    const playlists = Array.isArray(data?.playlists) ? data.playlists : [];
    addLog("info", "推荐歌单", "推荐歌单已加载", { count: playlists.length, errors: Array.isArray(data?.errors) ? data.errors.length : 0 });
    showPlaylistResults(playlists, "推荐歌单", {
      sourceTabs: true,
      emptyText: "暂无推荐歌单",
      title: "每日推荐歌单",
      subtitle: "按渠道查看各平台为你推荐的歌单。",
      icon: "♨",
      kind: "recommend",
    });
    if (!playlists.length) setStatus("暂无推荐歌单", true);
  }

  async function loadLeaderboardView(sources = []) {
    const params = new URLSearchParams();
    normalizeSourceList(sources, LEADERBOARD_SOURCES).forEach((source) => params.append("sources", source));
    const data = await api(`./api/leaderboards${params.toString() ? `?${params.toString()}` : ""}`);
    const playlists = Array.isArray(data?.playlists) ? data.playlists : [];
    state.leaderboardPanel = { activeSource: "", activeBoardKey: "", loading: false, songs: [], playlist: null, error: "", page: 1, pageSize: 30, total: 0, totalPages: 0, pageStart: 0, pageEnd: 0 };
    addLog("info", "排行榜", "排行榜已加载", { count: playlists.length });
    showPlaylistResults(playlists, "排行榜", {
      sourceTabs: true,
      emptyText: "暂无排行榜",
      title: "排行榜",
      subtitle: "按渠道查看各平台排行榜。",
      icon: "▦",
      kind: "leaderboards",
    });
    const firstGroup = playlistGroupsBySource(playlists).find((group) => group.playlists.length);
    if (firstGroup?.playlists?.[0]) {
      loadLeaderboardPanelDetail(firstGroup.playlists[0], 0).catch((error) => setStatus(`加载排行榜失败：${error.message}`, true));
    }
    if (!playlists.length) setStatus("暂无排行榜", true);
  }

  async function loadCollectionsView() {
    const data = await api("./api/my_collections");
    const playlists = Array.isArray(data) ? data : Array.isArray(data?.playlists) ? data.playlists : [];
    addLog("info", "本地歌单", "本地歌单已加载", { count: playlists.length });
    showPlaylistResults(playlists, "本地歌单", { kind: "local_collections", gridClass: "playlist-grid-compact" });
  }

  async function loadLocalMusicView(page = 1) {
    try {
      const params = new URLSearchParams({
        page: String(Math.max(1, Number(page || 1))),
        page_size: "50",
      });
      const data = await api(`./api/local_music_page?${params.toString()}`);
      const songs = Array.isArray(data?.songs) ? data.songs : [];
      addLog("info", "本地音乐", "本地音乐已加载", { count: songs.length });
      showSongResults(songs, songs.length ? "本地音乐" : "本地音乐暂未接入目录索引", {
        page: data?.page || page || 1,
        pageSize: data?.page_size || 50,
        total: data?.total ?? songs.length,
        totalPages: data?.total_pages,
        pageStart: data?.page_start,
        pageEnd: data?.page_end,
        pageLoader: loadLocalMusicView,
      });
      if (!songs.length) setStatus("本地音乐暂未接入目录索引", true);
    } catch (error) {
      showSongResults([], "本地音乐暂未接入目录索引");
      setStatus("本地音乐暂未接入目录索引", true);
    }
  }

  async function loadCategoryView(sources = []) {
    const params = new URLSearchParams();
    normalizeSourceList(sources, Array.from(state.selectedSources)).forEach((source) => params.append("sources", source));
    const data = await api(`./api/playlist_categories${params.toString() ? `?${params.toString()}` : ""}`);
    const playlists = Array.isArray(data?.playlists) ? data.playlists : [];
    showPlaylistResults(playlists, "歌单分类");
  }

  async function loadUserPlaylistView(sources = []) {
    const params = new URLSearchParams();
    normalizeSourceList(sources, []).forEach((source) => params.append("sources", source));
    const data = await api(`./api/user_playlists${params.toString() ? `?${params.toString()}` : ""}`);
    const playlists = Array.isArray(data?.playlists) ? data.playlists : [];
    addLog("info", "我的歌单", "我的歌单已加载", { count: playlists.length, errors: Array.isArray(data?.errors) ? data.errors.length : 0 });
    showPlaylistResults(playlists, "我的歌单", {
      sourceTabs: true,
      emptyText: "请在设置中登陆",
      title: "我的歌单",
      subtitle: "查看已登录平台中你创建和收藏的歌单。",
      icon: "♥",
      kind: "user_playlists",
      sources: Array.isArray(data?.logged_sources) ? data.logged_sources : Array.isArray(data?.sources) ? data.sources : [],
    });
    if (!playlists.length) {
      if (Array.isArray(data?.errors) && data.errors.length) addLog("warn", "我的歌单", "平台歌单未读取到可用登录", data.errors);
      setStatus("请在设置中登陆", true);
    } else if (Array.isArray(data?.errors) && data.errors.length) {
      addLog("warn", "我的歌单", "部分未登录平台已忽略", data.errors);
      setStatus(`已读取 ${playlists.length} 个平台歌单`);
    }
  }

  async function loadPlaylistDetailView(query = {}, page = 1) {
    const id = String(query.id || "").trim();
    const source = String(query.source || "").trim();
    const type = String(query.type || "playlist").trim();
    if (!id || !source) throw new Error("缺少歌单参数");
    setSearchType("song");
    setStatus("正在加载歌单...");
    const params = new URLSearchParams({
      id,
      source,
      type,
      page: String(Math.max(1, Number(page || query.page || 1))),
      page_size: "30",
    });
    const data = await api(`./api/playlist/detail?${params.toString()}`);
    const songs = Array.isArray(data?.songs) ? data.songs : [];
    const playlist = data?.playlist || {};
    const previousKind = state.previousView?.playlistView?.kind || "";
    showSongResults(songs, playlist.name ? `歌单：${playlist.name}` : "歌单详情", {
      page: data?.page || page || 1,
      pageSize: data?.page_size || 30,
      total: data?.total ?? songs.length,
      totalPages: data?.total_pages,
      pageStart: data?.page_start,
      pageEnd: data?.page_end,
      pageLoader: (nextPage) => loadPlaylistDetailView(query, nextPage),
    });
    if (!songs.length) setStatus(playlist.name ? `歌单 ${playlist.name} 暂无歌曲` : "歌单暂无歌曲", true);
    else if (previousKind === "user_playlists") scheduleInvalidSongValidation(songs, playlist.name ? `\u6b4c\u5355\uff1a${playlist.name}` : "\u6b4c\u5355");
  }

  async function loadLeaderboardDetailView(query = {}) {
    const id = String(query.id || "").trim();
    const source = String(query.source || "").trim();
    if (!id || !source) throw new Error("缺少排行榜参数");
    setSearchType("song");
    setStatus("正在加载排行榜...");
    const params = new URLSearchParams({ id, source });
    const data = await api(`./api/leaderboard/detail?${params.toString()}`);
    const songs = sortSongsBySourceOrder(Array.isArray(data?.songs) ? data.songs : []);
    const playlist = data?.playlist || {};
    showSongResults(songs, playlist.name ? `排行榜：${playlist.name}` : "排行榜");
    if (!songs.length) setStatus(playlist.name ? `排行榜 ${playlist.name} 暂无歌曲` : "排行榜暂无歌曲", true);
  }

  async function loadLeaderboardPanelDetail(board, index = 0, page = 1) {
    if (!board?.id || !board?.source) return;
    const key = `${board.source}:${board.id}`;
    state.leaderboardPanel = {
      ...state.leaderboardPanel,
      activeSource: board.source,
      activeBoardKey: key,
      loading: true,
      error: "",
    };
    renderResults();
    try {
      const params = new URLSearchParams({
        id: String(board.id),
        source: String(board.source),
        page: String(Math.max(1, Number(page || 1))),
        page_size: "30",
      });
      const data = await api(`./api/leaderboard/detail?${params.toString()}`);
      const songs = sortSongsBySourceOrder(Array.isArray(data?.songs) ? data.songs : []);
      state.songs = songs;
      state.selected.clear();
      state.currentIndex = -1;
      state.leaderboardPanel = {
        activeSource: board.source,
        activeBoardKey: key,
        loading: false,
        songs,
        playlist: data?.playlist || board,
        error: "",
        page: Number(data?.page || page || 1),
        pageSize: Number(data?.page_size || 30),
        total: Number(data?.total || songs.length),
        totalPages: Number(data?.total_pages || 1),
        pageStart: Number(data?.page_start || (songs.length ? 1 : 0)),
        pageEnd: Number(data?.page_end || songs.length),
      };
      addLog("info", "排行榜", `${board.name || "排行榜"} 已加载`, { count: songs.length, source: board.source });
      renderResults();
      if (!songs.length) setStatus(`${board.name || "排行榜"} 暂无歌曲`, true);
      else setStatus(`${board.name || "排行榜"} 已加载`);
    } catch (error) {
      state.leaderboardPanel = {
        ...state.leaderboardPanel,
        loading: false,
        songs: [],
        playlist: board,
        error: error.message || "加载失败",
        page: Number(page || 1),
        pageSize: 30,
        total: 0,
        totalPages: 0,
        pageStart: 0,
        pageEnd: 0,
      };
      addLog("error", "排行榜", `${board.name || "排行榜"} 加载失败`, error);
      renderResults();
      throw error;
    }
  }

  function unwrapApi(value) {
    if (value && typeof value === "object" && value.data && typeof value.data === "object" && "code" in value.data) {
      return unwrapApi(value.data);
    }
    if (value && typeof value === "object" && "code" in value) {
      if (value.code !== 0) throw new Error(value.msg || value.error || "请求失败");
      return value.data;
    }
    return value;
  }

  async function api(path, options = {}) {
    const method = String(options.method || "GET").toUpperCase();
    const normalized = path.startsWith("./") ? path.slice(1) : path.startsWith("/") ? path : `/${path}`;
    const plugin = window.SongloftPlugin;

    if (plugin && typeof plugin.apiGet === "function" && typeof plugin.apiPost === "function") {
      try {
        const raw = method === "POST"
          ? await plugin.apiPost(normalized, options.body ? JSON.parse(options.body) : {})
          : await plugin.apiGet(normalized);
        return unwrapApi(raw);
      } catch (error) {
        addLog("error", `API ${method} ${normalized}`, error.message || "请求失败", error);
        throw error;
      }
    }

    const response = await fetch(path, options);
    const text = await response.text().catch(() => "");
    let payload = null;
    try {
      payload = text ? JSON.parse(text) : null;
    } catch {
      payload = null;
    }
    if (!response.ok || !payload || payload.code !== 0) {
      const message = (payload && (payload.msg || payload.error)) || `HTTP ${response.status}`;
      addLog("error", `API ${method} ${normalized}`, message, { status: response.status, response: payload || text });
      throw new Error(message);
    }
    return payload.data;
  }

  function isSodaProxyUrl(url) {
    return String(url || "").includes("/api/soda/play") || String(url || "").startsWith("./api/soda/play");
  }

  function bytesAscii(bytes) {
    let text = "";
    for (let i = 0; i < bytes.length; i++) text += String.fromCharCode(bytes[i]);
    return text;
  }

  function readU32(bytes, offset) {
    return ((bytes[offset] << 24) | (bytes[offset + 1] << 16) | (bytes[offset + 2] << 8) | bytes[offset + 3]) >>> 0;
  }

  function readU16(bytes, offset) {
    return ((bytes[offset] << 8) | bytes[offset + 1]) >>> 0;
  }

  function findBox(bytes, type, start, end) {
    const limit = Math.min(end, bytes.length);
    let pos = start;
    while (pos + 8 <= limit) {
      const size = readU32(bytes, pos);
      if (size < 8 || pos + size > limit) break;
      if (bytesAscii(bytes.slice(pos + 4, pos + 8)) === type) {
        return { offset: pos, size, data: bytes.slice(pos + 8, pos + size) };
      }
      pos += size;
    }
    return null;
  }

  function boxChildStart(type, offset, headerSize) {
    if (["moov", "trak", "mdia", "minf", "stbl", "sinf", "schi"].includes(type)) return offset + headerSize;
    if (type === "stsd") return offset + headerSize + 8;
    if (["enca", "mp4a", "alac", "fLaC"].includes(type)) return offset + headerSize + 28;
    return -1;
  }

  function findBoxDeep(bytes, type, start, end) {
    const limit = Math.min(end, bytes.length);
    let pos = start;
    while (pos + 8 <= limit) {
      let size = readU32(bytes, pos);
      let headerSize = 8;
      if (size === 1) {
        if (pos + 16 > limit) break;
        size = readU32(bytes, pos + 8) * 0x100000000 + readU32(bytes, pos + 12);
        headerSize = 16;
      }
      if (size < headerSize || pos + size > limit) break;
      const current = bytesAscii(bytes.slice(pos + 4, pos + 8));
      if (current === type) return { offset: pos, size, data: bytes.slice(pos + headerSize, pos + size) };
      const childStart = boxChildStart(current, pos, headerSize);
      if (childStart >= 0 && childStart < pos + size) {
        const found = findBoxDeep(bytes, type, childStart, pos + size);
        if (found) return found;
      }
      pos += size;
    }
    return null;
  }

  function bitCount(n) {
    let value = n >>> 0;
    value = value - ((value >>> 1) & 0x55555555);
    value = (value & 0x33333333) + ((value >>> 2) & 0x33333333);
    return ((((value + (value >>> 4)) & 0x0f0f0f0f) * 0x01010101) >>> 24);
  }

  function decodeBase36(code) {
    if (code >= 48 && code <= 57) return code - 48;
    if (code >= 97 && code <= 122) return code - 97 + 10;
    if (code >= 65 && code <= 90) return code - 65 + 10;
    return 0xff;
  }

  function decryptSpadeInner(input) {
    const output = new Uint8Array(input.length);
    const prefix = [0xfa, 0x55];
    for (let i = 0; i < input.length; i++) {
      const buff = i < 2 ? prefix[i] : input[i - 2];
      let value = (input[i] ^ buff) - bitCount(i) - 21;
      while (value < 0) value += 255;
      output[i] = value & 0xff;
    }
    return output;
  }

  function hexBytes(hex) {
    const clean = String(hex || "").trim();
    const bytes = new Uint8Array(Math.floor(clean.length / 2));
    for (let i = 0; i < bytes.length; i++) bytes[i] = parseInt(clean.slice(i * 2, i * 2 + 2), 16);
    return bytes;
  }

  function extractSodaKey(playAuth) {
    const raw = atob(playAuth);
    const data = new Uint8Array(raw.length);
    for (let i = 0; i < raw.length; i++) data[i] = raw.charCodeAt(i);
    if (data.length < 3) throw new Error("汽水 auth 数据过短");
    const paddingLen = (data[0] ^ data[1] ^ data[2]) - 48;
    if (paddingLen < 0 || data.length < paddingLen + 2) throw new Error("汽水 auth padding 无效");
    const tmp = decryptSpadeInner(data.slice(1, data.length - paddingLen));
    const skipBytes = decodeBase36(tmp[0]);
    const endIndex = 1 + (data.length - paddingLen - 2) - skipBytes;
    if (endIndex > tmp.length || endIndex < 1) throw new Error("汽水 auth 索引无效");
    return hexBytes(bytesAscii(tmp.slice(1, endIndex)));
  }

  function parseStsz(data) {
    if (data.length < 12) return [];
    const fixedSize = readU32(data, 4);
    const count = readU32(data, 8);
    const sizes = [];
    for (let i = 0; i < count; i++) sizes.push(fixedSize || (12 + i * 4 + 4 <= data.length ? readU32(data, 12 + i * 4) : 0));
    return sizes;
  }

  function defaultIVSize(bytes, start, end) {
    const tenc = findBoxDeep(bytes, "tenc", start, end);
    if (!tenc || tenc.data.length < 8) return 8;
    return tenc.data[7] === 8 || tenc.data[7] === 16 ? tenc.data[7] : 8;
  }

  function parseSenc(data, ivSize) {
    if (data.length < 8) return [];
    const flags = readU32(data, 0) & 0x00ffffff;
    const count = readU32(data, 4);
    const hasSubsamples = (flags & 0x02) !== 0;
    const samples = [];
    let ptr = 8;
    for (let i = 0; i < count; i++) {
      if (ptr + ivSize > data.length) break;
      const sample = { iv: data.slice(ptr, ptr + ivSize), subsamples: [] };
      ptr += ivSize;
      if (hasSubsamples) {
        if (ptr + 2 > data.length) break;
        const subCount = readU16(data, ptr);
        ptr += 2;
        if (ptr + subCount * 6 > data.length) break;
        for (let j = 0; j < subCount; j++) {
          sample.subsamples.push({ clear: readU16(data, ptr), encrypted: readU32(data, ptr + 2) });
          ptr += 6;
        }
      }
      samples.push(sample);
    }
    return samples;
  }

  async function aesCtrXor(data, keyBytes, iv) {
    const counter = new Uint8Array(16);
    counter.set(iv.slice(0, 16));
    if (crypto?.subtle) {
      const key = await crypto.subtle.importKey("raw", keyBytes, "AES-CTR", false, ["decrypt"]);
      return new Uint8Array(await crypto.subtle.decrypt({ name: "AES-CTR", counter, length: 128 }, key, data));
    }
    const aes = window.aesjs || globalThis.aesjs;
    if (!aes?.ModeOfOperation?.ctr || !aes?.Counter) throw new Error("当前环境缺少 AES-CTR 解密能力");
    const ctr = new aes.Counter(Array.from(counter));
    const mode = new aes.ModeOfOperation.ctr(Array.from(keyBytes), ctr);
    return new Uint8Array(mode.decrypt(Array.from(data)));
  }

  async function decryptSample(keyBytes, chunk, sample) {
    if (!sample.subsamples.length) return aesCtrXor(chunk, keyBytes, sample.iv);
    const total = sample.subsamples.reduce((sum, item) => sum + Math.max(0, item.encrypted), 0);
    const encrypted = new Uint8Array(total);
    let readPos = 0;
    let writePos = 0;
    for (const sub of sample.subsamples) {
      readPos += Math.min(sub.clear, Math.max(0, chunk.length - readPos));
      const size = Math.min(sub.encrypted, Math.max(0, chunk.length - readPos));
      encrypted.set(chunk.slice(readPos, readPos + size), writePos);
      readPos += size;
      writePos += size;
    }
    const decrypted = await aesCtrXor(encrypted.slice(0, writePos), keyBytes, sample.iv);
    const output = new Uint8Array(chunk);
    readPos = 0;
    writePos = 0;
    for (const sub of sample.subsamples) {
      readPos += Math.min(sub.clear, Math.max(0, chunk.length - readPos));
      const size = Math.min(sub.encrypted, Math.max(0, chunk.length - readPos));
      output.set(decrypted.slice(writePos, writePos + size), readPos);
      readPos += size;
      writePos += size;
    }
    return output;
  }

  function originalSampleFormat(stsdData) {
    for (let i = 0; i + 4 <= stsdData.length; i++) {
      if (bytesAscii(stsdData.slice(i, i + 4)) !== "frma") continue;
      if (i < 4 || i + 8 > stsdData.length) break;
      const size = readU32(stsdData, i - 4);
      if (size < 12 || i - 4 + size > stsdData.length) break;
      return stsdData.slice(i + 4, i + 8);
    }
    return new Uint8Array([0x6d, 0x70, 0x34, 0x61]);
  }

  async function decryptSodaAudio(encrypted, playAuth) {
    const keyBytes = extractSodaKey(playAuth);
    const moov = findBox(encrypted, "moov", 0, encrypted.length);
    if (!moov) throw new Error("汽水 moov box 不存在");
    let stbl = findBox(encrypted, "stbl", moov.offset, moov.offset + moov.size);
    if (!stbl) {
      const trak = findBox(encrypted, "trak", moov.offset + 8, moov.offset + moov.size);
      const mdia = trak ? findBox(encrypted, "mdia", trak.offset + 8, trak.offset + trak.size) : null;
      const minf = mdia ? findBox(encrypted, "minf", mdia.offset + 8, mdia.offset + mdia.size) : null;
      stbl = minf ? findBox(encrypted, "stbl", minf.offset + 8, minf.offset + minf.size) : null;
    }
    if (!stbl) throw new Error("汽水 stbl box 不存在");
    const stsz = findBox(encrypted, "stsz", stbl.offset + 8, stbl.offset + stbl.size);
    const senc = findBox(encrypted, "senc", moov.offset + 8, moov.offset + moov.size) || findBox(encrypted, "senc", stbl.offset + 8, stbl.offset + stbl.size);
    const mdat = findBox(encrypted, "mdat", 0, encrypted.length);
    if (!stsz || !senc || !mdat) throw new Error("汽水加密 MP4 box 不完整");
    const sizes = parseStsz(stsz.data);
    const samples = parseSenc(senc.data, defaultIVSize(encrypted, stbl.offset, stbl.offset + stbl.size));
    const output = new Uint8Array(encrypted);
    let pos = mdat.offset + 8;
    for (let i = 0; i < sizes.length; i++) {
      const size = sizes[i];
      if (!size || pos + size > output.length) break;
      const chunk = output.slice(pos, pos + size);
      output.set(i < samples.length ? await decryptSample(keyBytes, chunk, samples[i]) : chunk, pos);
      pos += size;
    }
    const stsd = findBox(output, "stsd", stbl.offset + 8, stbl.offset + stbl.size);
    if (stsd) {
      const stsdData = output.slice(stsd.offset, stsd.offset + stsd.size);
      for (let i = 0; i + 4 <= stsdData.length; i++) {
        if (bytesAscii(stsdData.slice(i, i + 4)) === "enca") {
          output.set(originalSampleFormat(stsdData), stsd.offset + i);
          break;
        }
      }
    }
    return output;
  }

  function detectAudioMime(bytes) {
    if (bytes.length >= 4 && bytesAscii(bytes.slice(0, 4)) === "fLaC") return "audio/flac";
    if (bytes.length >= 3 && bytesAscii(bytes.slice(0, 3)) === "ID3") return "audio/mpeg";
    if (bytes.length >= 2 && bytes[0] === 0xff && (bytes[1] & 0xe0) === 0xe0) return "audio/mpeg";
    if (bytes.length >= 4 && bytesAscii(bytes.slice(0, 4)) === "OggS") return "audio/ogg";
    if (bytes.length >= 12 && bytesAscii(bytes.slice(4, 8)) === "ftyp") return "audio/mp4";
    return "audio/mp4";
  }

  function assertActivePlayRequest(requestId) {
    if (requestId && requestId !== state.playRequestId) {
      throw new Error("播放已切换");
    }
  }

  function stopActiveAudio() {
    if (audio.src || state.currentObjectUrl) {
      audio.pause();
      audio.removeAttribute("src");
      audio.load();
    }
    if (state.currentObjectUrl) {
      URL.revokeObjectURL(state.currentObjectUrl);
      state.currentObjectUrl = "";
    }
    $("currentTime").textContent = "00:00";
    $("durationTime").textContent = "00:00";
    $("seekBar").value = "0";
    $("playPauseBtn").textContent = "▶";
  }

  async function resolvePlayableAudioUrl(url, song, requestId = 0) {
    if (!isSodaProxyUrl(url)) return url;
    assertActivePlayRequest(requestId);
    const parsed = new URL(url, window.location.href);
    const playAuth = parsed.searchParams.get("auth") || "";
    const rawUrl = parsed.searchParams.get("url") || "";
    if (!rawUrl) throw new Error("汽水播放地址缺少原始音频 URL");
    if (!playAuth) throw new Error("汽水播放地址缺少解密参数");

    const response = await fetch(rawUrl, {
      headers: {
        "Accept": "audio/mp4,audio/*,*/*",
      },
    });
    const contentType = response.headers.get("content-type") || "";
    if (!response.ok) {
      const text = await response.text().catch(() => "");
      addLog("error", "汽水播放", `${song?.name || "歌曲"} 原始音频获取失败`, {
        status: response.status,
        contentType,
        body: text.slice(0, 2000),
        url,
        rawUrl,
      });
      throw new Error(text || `汽水原始音频 HTTP ${response.status}`);
    }
    assertActivePlayRequest(requestId);
    const encrypted = new Uint8Array(await response.arrayBuffer());
    assertActivePlayRequest(requestId);
    if (!encrypted.byteLength) throw new Error("汽水原始音频为空");
    if (contentType && /json|html|text/i.test(contentType)) {
      const text = bytesAscii(encrypted.slice(0, 2000));
      addLog("error", "汽水播放", `${song?.name || "歌曲"} 原始音频返回非音频内容`, {
        contentType,
        size: encrypted.byteLength,
        body: text.slice(0, 2000),
        rawUrl,
      });
      throw new Error(`汽水原始音频返回非音频内容：${contentType}`);
    }
    const decrypted = await decryptSodaAudio(encrypted, playAuth);
    assertActivePlayRequest(requestId);
    const blob = new Blob([decrypted], { type: detectAudioMime(decrypted) });
    if (state.currentObjectUrl) {
      URL.revokeObjectURL(state.currentObjectUrl);
      state.currentObjectUrl = "";
    }
    const objectUrl = URL.createObjectURL(blob);
    state.currentObjectUrl = objectUrl;
    addLog("info", "汽水播放", `${song?.name || "歌曲"} 已解密为本地播放 Blob`, {
      sourceSize: encrypted.byteLength,
      size: blob.size,
      contentType: blob.type || "audio/mp4",
    });
    return objectUrl;
  }

  function songKey(song) {
    return `${song.source}:${song.id}`;
  }

  function formatTime(value) {
    const total = Number(value || 0);
    if (!Number.isFinite(total) || total <= 0) return "00:00";
    const minutes = Math.floor(total / 60);
    const seconds = Math.floor(total % 60);
    return `${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}`;
  }

  function formatSize(value) {
    const size = Number(value || 0);
    if (!size) return "-";
    return `${(size / 1024 / 1024).toFixed(1)} MB`;
  }

  function formatBitrate(value) {
    const bitrate = Number(value || 0);
    if (!bitrate) return "-";
    return `${bitrate} kbps`;
  }

  function normalizeMatchText(value) {
    return String(value || "")
      .toLowerCase()
      .replace(/\s+/g, "")
      .replace(/[（(].*?[）)]/g, "")
      .replace(/[^\p{L}\p{N}]/gu, "");
  }

  function sourceSwitchCandidates() {
    const preferred = ["kuwo", "qq", "netease", "kugou", "migu"];
    const available = new Set(state.sources.filter((source) => source.searchSupported !== false).map((source) => source.id));
    return preferred.filter((source) => available.has(source));
  }

  function scoreSwitchCandidate(original, candidate, allowSameSource = false) {
    if (!candidate || (!allowSameSource && candidate.source === original.source)) return -1;
    const originalName = normalizeMatchText(original.name);
    const candidateName = normalizeMatchText(candidate.name);
    const originalArtist = normalizeMatchText(original.artist);
    const candidateArtist = normalizeMatchText(candidate.artist);
    let score = 0;
    if (candidateName === originalName) score += 100;
    else if (candidateName.includes(originalName) || originalName.includes(candidateName)) score += 55;
    if (originalArtist && candidateArtist) {
      if (candidateArtist === originalArtist) score += 50;
      else if (candidateArtist.includes(originalArtist) || originalArtist.includes(candidateArtist)) score += 25;
    }
    const durationDiff = Math.abs(Number(candidate.duration || 0) - Number(original.duration || 0));
    if (original.duration && candidate.duration) {
      if (durationDiff <= 3) score += 30;
      else if (durationDiff <= 10) score += 15;
      else if (durationDiff > 30) score -= 30;
    }
    return score;
  }

  async function resolveSongForPlayback(song) {
    return api("./api/music/url", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ source_data: sourceData(song) }),
    });
  }

  async function switchSourceForSong(song, reason = "") {
    if (!song || state.fallbackBusy) return false;
    const key = songKey(song);
    if (state.fallbackTried.has(key)) return false;
    state.fallbackTried.add(key);
    state.fallbackBusy = true;
    try {
      const sources = sourceSwitchCandidates();
      if (!sources.length) return false;
      const params = new URLSearchParams();
      params.set("q", song.name || "");
      params.set("type", "song");
      params.set("page", "1");
      params.set("page_size", "30");
      sources.forEach((source) => params.append("sources", source));
      const logTitle = reason === "手动换源" ? "手动换源" : "自动换源";
      addLog("warn", logTitle, `${song.name || "歌曲"} 开始换源`, { reason, sources });
      const data = await api(`./api/search?${params.toString()}`);
      const candidates = Array.isArray(data?.songs) ? data.songs.filter((item) => item.source !== song.source) : [];
      const ranked = candidates
        .map((candidate) => ({ candidate, score: scoreSwitchCandidate(song, candidate) }))
        .filter((item) => item.score >= 55)
        .sort((a, b) => b.score - a.score);
      if (!ranked.length) {
        addLog("error", logTitle, `${song.name || "歌曲"} 未找到可替换音源`, { reason });
        return false;
      }
      let selected = null;
      for (const item of ranked.slice(0, 12)) {
        try {
          const payload = await resolveSongForPlayback(item.candidate);
          if (!payload?.url) throw new Error("未获取到播放地址");
          selected = { ...item, payload };
          break;
        } catch (error) {
          addLog("trace", logTitle, `${item.candidate.name || "候选歌曲"} 跳过不可播放候选`, {
            source: item.candidate.source,
            id: item.candidate.id,
            artist: item.candidate.artist,
            score: item.score,
            error: error?.message || String(error),
          });
        }
      }
      if (!selected) {
        addLog("error", logTitle, `${song.name || "歌曲"} 未找到可播放的替换音源`, { reason });
        return false;
      }
      const next = {
        ...selected.candidate,
        is_invalid: false,
        _resolvedPlayback: selected.payload,
        _fallbackFrom: { source: song.source, id: song.id, name: song.name, reason },
      };
      addLog("info", logTitle, `${song.name || "歌曲"} 已换到 ${next.source}`, {
        from: song.source,
        to: next.source,
        id: next.id,
        score: selected.score,
        artist: next.artist,
      });
      const listIndex = state.songs.findIndex((item) => songKey(item) === key);
      const playIndex = listIndex >= 0 ? listIndex : state.currentIndex;
      if (listIndex >= 0) state.songs[listIndex] = next;
      renderResults();
      await playSong(next, playIndex);
      return true;
    } catch (error) {
      addLog("error", reason === "手动换源" ? "手动换源" : "自动换源", `${song.name || "歌曲"} 换源失败`, error);
      return false;
    } finally {
      state.fallbackBusy = false;
    }
  }

  function sourceSwitchCandidateSources() {
    return sourceSwitchCandidates();
  }

  function groupSwitchCandidates(original, songs) {
    const groups = new Map();
    sourceSwitchCandidateSources().forEach((source) => groups.set(source, []));
    (Array.isArray(songs) ? songs : []).forEach((candidate) => {
      if (!candidate || !candidate.id || !candidate.source) return;
      const score = scoreSwitchCandidate(original, candidate, true);
      if (score < 45) return;
      const source = candidate.source;
      if (!groups.has(source)) groups.set(source, []);
      groups.get(source).push({ ...candidate, _switchScore: score });
    });
    return Array.from(groups.entries()).map(([source, list]) => ({
      source,
      list: list.sort((a, b) => Number(b._switchScore || 0) - Number(a._switchScore || 0)).slice(0, 30),
    }));
  }

  function sourceSwitchSongSummary(song) {
    if (!song) return "";
    return `${song.artist || "未知艺人"} / ${song.album || song.name || ""}`;
  }

  function renderSourceSwitchCompare() {
    const box = $("sourceSwitchCompare");
    const confirm = $("sourceSwitchConfirm");
    if (!box || !confirm) return;
    const original = state.sourceSwitchModal.original;
    const selected = state.sourceSwitchModal.selected;
    box.innerHTML = "";
    const left = document.createElement("div");
    left.className = "source-switch-compare-song";
    left.innerHTML = `<div class="source-switch-compare-name"></div><div class="source-switch-compare-sub"></div>`;
    left.querySelector(".source-switch-compare-name").textContent = original ? `${original.name || "未知歌曲"}  ${original.source || ""} ${formatTime(original.duration)}` : "";
    left.querySelector(".source-switch-compare-sub").textContent = sourceSwitchSongSummary(original);
    const arrow = document.createElement("div");
    arrow.className = "source-switch-arrow";
    arrow.textContent = "→";
    const right = document.createElement("div");
    right.className = "source-switch-compare-song";
    right.innerHTML = `<div class="source-switch-compare-name"></div><div class="source-switch-compare-sub"></div>`;
    right.querySelector(".source-switch-compare-name").textContent = selected ? `${selected.name || "未知歌曲"}  ${selected.source || ""} ${formatTime(selected.duration)}` : "请选择候选歌曲";
    right.querySelector(".source-switch-compare-sub").textContent = selected ? sourceSwitchSongSummary(selected) : "点击耳机试听后可确认换源";
    box.append(left, arrow, right);
    confirm.disabled = !selected || (original && songKey(original) === songKey(selected));
  }

  function renderSourceSwitchModal() {
    const modal = state.sourceSwitchModal;
    const layer = $("sourceSwitchLayer");
    const tabs = $("sourceSwitchTabs");
    const list = $("sourceSwitchList");
    if (!layer || !tabs || !list) return;
    layer.hidden = !modal.open;
    if (!modal.open) return;

    tabs.innerHTML = "";
    modal.groups.forEach((group) => {
      const button = document.createElement("button");
      button.type = "button";
      button.className = `source-switch-tab${group.source === modal.activeSource ? " active" : ""}`;
      button.textContent = sourceDisplayName(group.source);
      button.addEventListener("click", () => {
        state.sourceSwitchModal.activeSource = group.source;
        renderSourceSwitchModal();
      });
      tabs.append(button);
    });

    list.innerHTML = "";
    if (modal.loading) {
      list.innerHTML = `<div class="source-switch-status">正在查找相似歌曲...</div>`;
      renderSourceSwitchCompare();
      return;
    }
    if (modal.error) {
      const status = document.createElement("div");
      status.className = "source-switch-status";
      status.textContent = modal.error;
      list.append(status);
      renderSourceSwitchCompare();
      return;
    }
    const activeGroup = modal.groups.find((group) => group.source === modal.activeSource) || modal.groups[0];
    const songs = activeGroup?.list || [];
    if (!songs.length) {
      const status = document.createElement("div");
      status.className = "source-switch-status";
      status.textContent = "该平台没有找到相似歌曲";
      list.append(status);
      renderSourceSwitchCompare();
      return;
    }
    songs.forEach((candidate) => {
      const row = document.createElement("div");
      row.className = `source-switch-item${modal.selected && songKey(modal.selected) === songKey(candidate) ? " selected" : ""}`;
      row.innerHTML = `
        <div class="source-switch-song-text">
          <div class="source-switch-song-name"></div>
          <div class="source-switch-song-sub"></div>
        </div>
        <div class="source-switch-time"></div>
        <button type="button" class="source-switch-audition" title="试听" aria-label="试听">🎧</button>
      `;
      row.querySelector(".source-switch-song-name").textContent = candidate.name || "未知歌曲";
      row.querySelector(".source-switch-song-sub").textContent = sourceSwitchSongSummary(candidate);
      row.querySelector(".source-switch-time").textContent = formatTime(candidate.duration);
      const audition = row.querySelector(".source-switch-audition");
      if (state.currentSong && songKey(state.currentSong) === songKey(candidate) && state.isPlaying) audition.classList.add("active");
      audition.addEventListener("click", async () => {
        state.sourceSwitchModal.selected = candidate;
        renderSourceSwitchCompare();
        try {
          const payload = await resolveSongForPlayback(candidate);
          candidate._resolvedPlayback = payload;
          await playSong(candidate, modal.originalIndex);
          renderSourceSwitchModal();
        } catch (error) {
          addLog("error", "手动换源", `${candidate.name || "候选歌曲"} 试听失败`, error);
          setStatus(`试听失败：${error.message || String(error)}`, true);
        }
      });
      row.addEventListener("click", (event) => {
        if (event.target.closest("button")) return;
        state.sourceSwitchModal.selected = candidate;
        renderSourceSwitchModal();
      });
      list.append(row);
    });
    renderSourceSwitchCompare();
  }

  async function openSourceSwitchModal(song, index = -1) {
    if (!song) return;
    const requestId = ++state.sourceSwitchModal.requestId;
    state.sourceSwitchModal = {
      ...state.sourceSwitchModal,
      open: true,
      original: song,
      originalIndex: index,
      activeSource: "",
      selected: null,
      groups: sourceSwitchCandidateSources().map((source) => ({ source, list: [] })),
      loading: true,
      error: "",
      requestId,
    };
    state.sourceSwitchModal.activeSource = state.sourceSwitchModal.groups[0]?.source || "";
    renderSourceSwitchModal();
    try {
      const sources = sourceSwitchCandidateSources();
      const params = new URLSearchParams();
      const keyword = song.artist ? `${song.name || ""} ${song.artist || ""}` : (song.name || "");
      params.set("q", keyword.trim() || song.name || "");
      params.set("type", "song");
      params.set("page", "1");
      params.set("page_size", "50");
      sources.forEach((source) => params.append("sources", source));
      const data = await api(`./api/search?${params.toString()}`);
      if (state.sourceSwitchModal.requestId !== requestId) return;
      const groups = groupSwitchCandidates(song, data?.songs || []);
      state.sourceSwitchModal.groups = groups;
      state.sourceSwitchModal.activeSource = groups.find((group) => group.list.length)?.source || groups[0]?.source || "";
      state.sourceSwitchModal.loading = false;
      state.sourceSwitchModal.error = "";
      renderSourceSwitchModal();
    } catch (error) {
      if (state.sourceSwitchModal.requestId !== requestId) return;
      state.sourceSwitchModal.loading = false;
      state.sourceSwitchModal.error = `查找相似歌曲失败：${error.message || String(error)}`;
      renderSourceSwitchModal();
    }
  }

  function closeSourceSwitchModal() {
    state.sourceSwitchModal.open = false;
    state.sourceSwitchModal.requestId += 1;
    renderSourceSwitchModal();
  }

  async function confirmSourceSwitch() {
    const modal = state.sourceSwitchModal;
    const original = modal.original;
    const selected = modal.selected;
    if (!original || !selected) return;
    const originalKey = songKey(original);
    const listIndex = state.songs.findIndex((item) => songKey(item) === originalKey);
    const targetIndex = listIndex >= 0 ? listIndex : modal.originalIndex;
    const next = {
      ...selected,
      is_invalid: false,
      _fallbackFrom: { source: original.source, id: original.id, name: original.name, reason: "手动换源" },
    };
    if (listIndex >= 0) state.songs[listIndex] = next;
    if (state.currentSong && songKey(state.currentSong) === songKey(selected)) {
      state.currentSong = next;
      state.currentIndex = targetIndex;
    } else if (state.currentSong && songKey(state.currentSong) === originalKey) {
      await playSong(next, targetIndex);
    }
    closeSourceSwitchModal();
    renderResults();
    showOperationToast(`已换源到 ${sourceDisplayName(next.source)}：${next.name || ""}`, "success");
    addLog("info", "手动换源", `${original.name || "歌曲"} 已换源`, { from: original.source, to: next.source, id: next.id });
  }

  function searchPlaceholder(type) {
    if (type === "playlist") return "搜索歌单、创建者，或直接粘贴歌单链接";
    if (type === "album") return "搜索专辑、歌手，或直接粘贴专辑链接";
    return "搜索歌曲、歌手，或直接粘贴分享链接";
  }

  function resultUnit(type) {
    if (type === "playlist") return "个歌单";
    if (type === "album") return "张专辑";
    return "首歌曲";
  }

  function supportsSource(source, type) {
    const key = SOURCE_SUPPORTS[type] || "recommendSupported";
    return source[key] !== false;
  }

  function activeSourcesForType(type) {
    return visibleSources().filter((source) => state.selectedSources.has(source.id) && supportsSource(source, type)).map((source) => source.id);
  }

  function setStatus(message, error = false) {
    const el = $("status");
    if (!el) return;
    el.textContent = message || "";
    el.classList.toggle("error", !!error);
    if (error && message) addLog("error", "状态提示", message);
  }

  function showOperationToast(message, type = "success", duration = 2800) {
    const el = $("operationToast");
    if (!el || !message) return;
    const host = $("qrLoginDialog")?.open ? $("qrLoginDialog") : $("settingsDialog")?.open ? $("settingsDialog") : document.body;
    if (host && el.parentElement !== host) host.appendChild(el);
    window.clearTimeout(operationToastTimer);
    el.textContent = message;
    el.className = `operation-toast ${type || "success"} show`;
    operationToastTimer = window.setTimeout(() => {
      el.classList.remove("show");
    }, duration);
  }

  function setPlayer(song, stateText = "解析中") {
    state.currentSong = song || null;
    $("playerTitle").textContent = song ? `${song.name || "未知歌曲"} - ${song.artist || "未知歌手"}` : "未播放";
    if (!song) setPlayerLyric("选择一首歌试听");
    $("playerState").textContent = stateText;
    $("playerCover").style.backgroundImage = song?.cover ? `url("${song.cover}")` : "";
    updateSongPlaybackIndicators();
  }

  function updateSongPlaybackIndicators() {
    const currentKey = state.currentSong ? songKey(state.currentSong) : "";
    document.querySelectorAll(".song-card, .leaderboard-song-row").forEach((card) => {
      const key = `${card.dataset.source || ""}:${card.dataset.id || ""}`;
      const isCurrent = Boolean(currentKey && key === currentKey);
      const isPlaying = isCurrent && state.isPlaying;
      card.classList.toggle("current", isCurrent);
      card.classList.toggle("playing", isPlaying);
      const playButton = card.querySelector(".btn-circle.play");
      if (playButton) {
        playButton.textContent = isPlaying ? "Ⅱ" : "▶";
        playButton.title = isPlaying ? "正在播放" : "播放";
        playButton.setAttribute("aria-label", isPlaying ? "正在播放" : "播放");
      }
    });
  }

  function updateSummary() {
    $("resultLabel").textContent = "找到";
    $("resultCount").textContent = String(state.total || 0);
    $("resultUnit").textContent = resultUnit(state.searchType);
    $("resultMeta").textContent = state.total > 0
      ? `当前第 ${state.page} / ${state.totalPages} 页，显示 ${state.pageStart} - ${state.pageEnd} / ${state.total}`
      : "当前第 1 / 1 页，显示 0 - 0 / 0";

    const pagination = $("pagination");
    pagination.innerHTML = "";
    pagination.classList.toggle("active", state.totalPages > 1);
    if (state.totalPages <= 1) return;

    const prev = document.createElement("button");
    prev.type = "button";
    prev.className = "ctrl-btn primary";
    prev.disabled = state.page <= 1;
    prev.textContent = "上一页";
    prev.addEventListener("click", () => loadResultPage(state.page - 1));

    const text = document.createElement("span");
    text.className = "pagination-text";
    text.textContent = `第 ${state.page} / ${state.totalPages} 页`;

    const hint = document.createElement("span");
    hint.className = "pagination-shortcut-hint";
    hint.textContent = "PgUp / PgDn";

    const next = document.createElement("button");
    next.type = "button";
    next.className = "ctrl-btn primary";
    next.disabled = state.page >= state.totalPages;
    next.textContent = "下一页";
    next.addEventListener("click", () => loadResultPage(state.page + 1));

    pagination.append(prev, text, hint, next);
  }

  function loadResultPage(page) {
    const target = Math.max(1, Number(page || 1));
    if (typeof state.pageLoader === "function") {
      state.pageLoader(target);
      return;
    }
    search(target);
  }

  function moveSource(sourceId, direction) {
    const current = visibleSources();
    const index = current.findIndex((source) => source.id === sourceId);
    const nextIndex = index + direction;
    if (index < 0 || nextIndex < 0 || nextIndex >= current.length) return;
    const order = current.map((source) => source.id);
    const [id] = order.splice(index, 1);
    order.splice(nextIndex, 0, id);
    applySourceOrder(order);
    state.settings = { ...(state.settings || {}), sourceOrder: sourceOrderIds(), source_order: sourceOrderIds() };
    renderSources();
    if (state.searchType === "song" && state.songs.length) {
      state.songs = sortSongsBySourceOrder(state.songs);
      renderResults();
    }
    saveSettings({ silent: true }).catch(() => {});
  }

  function moveSourceTo(sourceId, targetId) {
    if (!sourceId || !targetId || sourceId === targetId) return;
    const order = visibleSources().map((source) => source.id);
    const from = order.indexOf(sourceId);
    const to = order.indexOf(targetId);
    if (from < 0 || to < 0) return;
    const [id] = order.splice(from, 1);
    order.splice(to, 0, id);
    applySourceOrder(order);
    state.settings = { ...(state.settings || {}), sourceOrder: sourceOrderIds(), source_order: sourceOrderIds() };
    renderSources();
    if (state.searchType === "song" && state.songs.length) {
      state.songs = sortSongsBySourceOrder(state.songs);
      renderResults();
    }
    saveSettings({ silent: true }).catch(() => {});
  }

  function renderSources() {
    const grid = $("sourceGrid");
    grid.innerHTML = "";
    const type = state.searchType;
    const sources = visibleSources();
    sources.forEach((source, index) => {
      const label = document.createElement("label");
      label.className = "source-option";
      label.draggable = state.sourceSortMode;
      label.dataset.source = source.id;
      if (state.sourceSortMode) label.classList.add("is-sorting");

      const input = document.createElement("input");
      input.type = "checkbox";
      input.className = "source-checkbox";
      input.value = source.id;
      input.checked = state.selectedSources.has(source.id) && supportsSource(source, type);
      input.disabled = !supportsSource(source, type);

      const card = document.createElement("div");
      card.className = "source-card";
      const sortHandle = state.sourceSortMode ? '<div class="source-sort" aria-hidden="true"><span class="source-drag-handle">↕</span></div>' : "";
      card.innerHTML = `
        ${sortHandle}
        <div class="source-name">${source.shortName || source.id}</div>
        <div class="source-desc">${source.name}</div>
      `;

      input.addEventListener("change", () => {
        if (input.checked) state.selectedSources.add(source.id);
        else state.selectedSources.delete(source.id);
        saveSettings({ silent: true }).catch(() => {});
      });
      label.addEventListener("click", (event) => {
        if (!state.sourceSortMode) return;
        event.preventDefault();
      });

      label.addEventListener("dragstart", (event) => {
        if (!state.sourceSortMode) return;
        state.draggingSourceId = source.id;
        label.classList.add("is-dragging");
        event.dataTransfer?.setData("text/plain", source.id);
      });
      label.addEventListener("dragend", () => {
        state.draggingSourceId = "";
        label.classList.remove("is-dragging");
      });
      label.addEventListener("dragover", (event) => {
        if (!state.sourceSortMode || !state.draggingSourceId) return;
        event.preventDefault();
      });
      label.addEventListener("drop", (event) => {
        if (!state.sourceSortMode) return;
        event.preventDefault();
        const dragged = event.dataTransfer?.getData("text/plain") || state.draggingSourceId;
        moveSourceTo(dragged, source.id);
      });

      label.append(input, card);
      grid.append(label);
    });
  }

  function setSearchType(type) {
    state.searchType = type || "song";
    $("searchKeyword").placeholder = searchPlaceholder(state.searchType);
    searchTypeInputs.forEach((input) => {
      input.checked = input.value === state.searchType;
    });
    renderSources();
    $("resultUnit").textContent = resultUnit(state.searchType);
  }

  function iconImportList() {
    return '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 7h10"/><path d="M4 12h8"/><path d="M4 17h7"/><path d="M17 10v8"/><path d="M13 14h8"/></svg>';
  }

  function iconSwitchSource() {
    return '<svg class="fa-icon" viewBox="0 0 512 512" aria-hidden="true"><path d="M105.1 202.6c7.7-21.8 20.2-42.3 37.8-59.8 62.5-62.5 163.8-62.5 226.3 0L386.3 160H336c-17.7 0-32 14.3-32 32s14.3 32 32 32H464c17.7 0 32-14.3 32-32V64c0-17.7-14.3-32-32-32s-32 14.3-32 32v51.2L414.4 97.6c-87.5-87.5-229.3-87.5-316.8 0C73.2 122 55.6 150.7 44.8 181.4c-5.9 16.7 2.9 34.9 19.5 40.8s34.9-2.9 40.8-19.6zM39 289.3c-5 1.5-9.8 4.2-13.7 8.2s-6.7 8.8-8.1 14c-.3 1.2-.6 2.5-.8 3.8-.3 1.7-.4 3.4-.4 5.1V448c0 17.7 14.3 32 32 32s32-14.3 32-32v-51.1l17.6 17.5c87.5 87.4 229.3 87.4 316.7 0 24.4-24.4 42.1-53.1 52.9-83.8 5.9-16.7-2.9-34.9-19.5-40.8s-34.9 2.9-40.8 19.5c-7.7 21.8-20.2 42.3-37.8 59.8-62.5 62.5-163.8 62.5-226.3 0l-.1-.1L125.6 352H176c17.7 0 32-14.3 32-32s-14.3-32-32-32H48.4c-1.6 0-3.2 .1-4.8 .3s-3.1 .5-4.6 1z"/></svg>';
  }

  function iconDownloadLine() {
    return '<svg class="fa-icon" viewBox="0 0 512 512" aria-hidden="true"><path d="M288 32c0-17.7-14.3-32-32-32s-32 14.3-32 32v242.7l-73.4-73.4c-12.5-12.5-32.8-12.5-45.3 0s-12.5 32.8 0 45.3l128 128c12.5 12.5 32.8 12.5 45.3 0l128-128c12.5-12.5 12.5-32.8 0-45.3s-32.8-12.5-45.3 0L288 274.7V32zM64 352c-35.3 0-64 28.7-64 64v32c0 35.3 28.7 64 64 64h384c35.3 0 64-28.7 64-64v-32c0-35.3-28.7-64-64-64H346.5l-45.3 45.3c-25 25-65.5 25-90.5 0L165.5 352H64zm368 56a24 24 0 1 1 0 48 24 24 0 1 1 0-48z"/></svg>';
  }

  function iconPlaylist() {
    return '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 6h16"/><path d="M4 12h16"/><path d="M4 18h16"/></svg>';
  }

  function iconPlayMode(mode) {
    if (mode === "repeat-one") {
      return '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M17 2l4 4-4 4"/><path d="M3 11V9a3 3 0 0 1 3-3h15"/><path d="M7 22l-4-4 4-4"/><path d="M21 13v2a3 3 0 0 1-3 3H3"/><path d="M12 10h1v5"/></svg>';
    }
    if (mode === "order") {
      return '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 6h11"/><path d="M4 12h11"/><path d="M4 18h7"/><path d="M18 8v10"/><path d="m15 15 3 3 3-3"/></svg>';
    }
    if (mode === "shuffle") {
      return '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M16 3h5v5"/><path d="M4 20 21 3"/><path d="M21 16v5h-5"/><path d="M15 15l6 6"/><path d="M4 4l5 5"/></svg>';
    }
    return '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M17 2l4 4-4 4"/><path d="M3 11V9a3 3 0 0 1 3-3h15"/><path d="M7 22l-4-4 4-4"/><path d="M21 13v2a3 3 0 0 1-3 3H3"/></svg>';
  }

  function playModeMeta(mode = state.playMode) {
    return PLAY_MODES.find((item) => item.id === mode) || PLAY_MODES[2];
  }

  function updatePlayModeButton() {
    const button = $("loopBtn");
    if (!button) return;
    const meta = playModeMeta();
    button.innerHTML = iconPlayMode(meta.id);
    button.title = meta.title;
    button.setAttribute("aria-label", meta.title);
  }

  function setPlayerLyric(text) {
    const line = $("playerArtist");
    if (line) line.textContent = text || "";
  }

  function cleanLyricText(text) {
    const formatMs = (ms) => {
      const totalSeconds = Math.max(0, Number(ms) || 0) / 1000;
      const minute = Math.floor(totalSeconds / 60);
      const second = totalSeconds - minute * 60;
      return `[${String(minute).padStart(2, "0")}:${second.toFixed(2).padStart(5, "0")}]`;
    };
    return String(text || "")
      .replace(/<\d+,\d+,\d+>/g, "")
      .replace(/&lt;/g, "<")
      .replace(/&gt;/g, ">")
      .replace(/&amp;/g, "&")
      .replace(/&quot;/g, '"')
      .replace(/&#39;/g, "'")
      .split(/\r?\n/)
      .map((line) => line.replace(/^\[(\d+),\d+\]/, (_match, ms) => formatMs(ms)))
      .join("\n");
  }

  function parseLyricLines(text) {
    const lines = [];
    cleanLyricText(text).split(/\r?\n/).forEach((raw) => {
      const content = cleanLyricText(raw.replace(/\[[^\]]+\]/g, "")).trim();
      const matches = Array.from(raw.matchAll(/\[(\d{1,2}):(\d{1,2})(?:[.:](\d{1,3}))?\]/g));
      if (!content) return;
      if (!matches.length) {
        if (!lines.length) lines.push({ time: 0, text: content });
        return;
      }
      matches.forEach((match) => {
        const minute = Number(match[1] || 0);
        const second = Number(match[2] || 0);
        const fraction = Number((match[3] || "0").padEnd(3, "0").slice(0, 3));
        lines.push({ time: minute * 60 + second + fraction / 1000, text: content });
      });
    });
    return lines.sort((a, b) => a.time - b.time);
  }

  function extractEmbeddedLyric(song) {
    const extra = song?.extra && typeof song.extra === "object" ? song.extra : {};
    const candidates = [
      song?.lyric,
      song?.lyrics,
      song?.lrc,
      song?.raw_lrc,
      song?.rawLrc,
      song?.synced_lyrics,
      song?.unsynced_lyrics,
      extra.lyric,
      extra.lyrics,
      extra.lrc,
      extra.raw_lrc,
      extra.rawLrc,
      extra.rawLyric,
      extra.lineLyric,
      extra.synced_lyrics,
      extra.unsynced_lyrics,
      extra.SYNCEDLYRICS,
      extra.UNSYNCEDLYRICS,
      extra.LYRICS,
    ];
    return candidates.map((value) => String(value || "").trim()).find(Boolean) || "";
  }

  function localHostLyricUrl(song) {
    const hostSongId = String(song?.extra?.hostSongId || song?.id || "").trim();
    if (!hostSongId) return "";
    const candidates = [
      song?.link,
      song?.url,
      song?.cover,
      song?.extra?.url,
      song?.extra?.cover,
    ].map((value) => String(value || "").trim()).filter(Boolean);
    for (const candidate of candidates) {
      try {
        const url = new URL(candidate, window.location.origin);
        if (!/\/api\/v1\/songs\/\d+\/(?:play|cover|lyric)/.test(url.pathname)) continue;
        url.pathname = `/api/v1/songs/${encodeURIComponent(hostSongId)}/lyric`;
        return url.toString();
      } catch {
        // Try the next candidate.
      }
    }
    return `/api/v1/songs/${encodeURIComponent(hostSongId)}/lyric`;
  }

  async function fetchLocalHostLyric(song) {
    const url = localHostLyricUrl(song);
    if (!url) return "";
    const response = await fetch(url, { headers: { Accept: "application/json,text/plain,*/*" } });
    if (!response.ok) throw new Error(`本地歌词 HTTP ${response.status}`);
    const text = await response.text();
    try {
      const data = JSON.parse(text);
      return data?.lyric || data?.data?.lyric || data?.lrc || data?.tlyric || data?.rlyric || data?.lxlyric || "";
    } catch {
      return text;
    }
  }

  function applyRawLyric(raw) {
    state.lyrics = parseLyricLines(raw);
    state.currentLyricIndex = -1;
    if (state.lyrics.length) {
      updatePlayerLyricByTime(audio.currentTime || 0, true);
      return true;
    }
    setPlayerLyric("暂无歌词");
    return false;
  }

  function extractLyricText(value) {
    if (!value) return "";
    if (typeof value === "string") return value;
    if (typeof value !== "object") return "";
    const direct = value.lyric || value.lrc || value.lxlyric || value.tlyric || value.rlyric || "";
    if (direct) return String(direct);
    if (value.data && value.data !== value) return extractLyricText(value.data);
    if (value.body && value.body !== value) return extractLyricText(value.body);
    return "";
  }

  async function loadPlayerLyrics(song, requestId) {
    const lyricRequestId = ++state.lyricRequestId;
    state.lyrics = [];
    state.currentLyricIndex = -1;
    setPlayerLyric("歌词加载中...");
    const embedded = extractEmbeddedLyric(song);
    if (embedded) {
      applyRawLyric(embedded);
      return;
    }
    if (String(song?.source || "").toLowerCase() === "local") {
      try {
        const localLyric = await fetchLocalHostLyric(song);
        if (requestId !== state.playRequestId || lyricRequestId !== state.lyricRequestId) return;
        applyRawLyric(localLyric);
      } catch (error) {
        addLog("warn", "歌词", `${song?.name || "本地歌曲"} 本地歌词读取失败`, error);
        setPlayerLyric("暂无歌词");
      }
      return;
    }
    try {
      const params = new URLSearchParams(lyricQuery(song));
      const data = await api(`./api/direct/lyric?${params.toString()}`);
      if (requestId !== state.playRequestId || lyricRequestId !== state.lyricRequestId) return;
      const raw = extractLyricText(data);
      addLog(raw ? "trace" : "warn", "歌词", `${song?.name || "当前歌曲"} 歌词接口返回`, {
        source: song?.source,
        id: song?.id,
        length: raw.length,
      });
      applyRawLyric(raw);
    } catch (error) {
      if (requestId !== state.playRequestId || lyricRequestId !== state.lyricRequestId) return;
      addLog("warn", "歌词", `${song?.name || "当前歌曲"} 歌词加载失败`, error);
      setPlayerLyric("暂无歌词");
    }
  }

  function updatePlayerLyricByTime(time, force = false) {
    if (!state.lyrics.length) return;
    let index = -1;
    for (let i = 0; i < state.lyrics.length; i += 1) {
      if (state.lyrics[i].time <= Number(time || 0) + 0.25) index = i;
      else break;
    }
    if (index < 0) index = 0;
    if (!force && index === state.currentLyricIndex) return;
    state.currentLyricIndex = index;
    setPlayerLyric(state.lyrics[index]?.text || "");
  }

  function coverPlaceholderHtml(source, extraClass = "") {
    const localClass = String(source || "").toLowerCase() === "local" ? " local-cover-placeholder" : "";
    return `<div class="cover-placeholder${localClass}${extraClass ? ` ${extraClass}` : ""}">♪</div>`;
  }

  function attachCoverFallback(container, source, extraClass = "") {
    const image = container?.querySelector("img");
    if (!image) return;
    image.addEventListener("error", () => {
      container.innerHTML = coverPlaceholderHtml(source, extraClass);
    }, { once: true });
  }

  function renderSongCard(song, index) {
    const key = songKey(song);
    const isCurrent = state.currentSong && songKey(state.currentSong) === key;
    const isPlaying = Boolean(isCurrent && state.isPlaying);
    const li = document.createElement("li");
    li.className = "song-card";
    if (isCurrent) li.classList.add("current");
    if (isPlaying) li.classList.add("playing");
    li.dataset.id = song.id;
    li.dataset.source = song.source;
    li.dataset.name = song.name || "";
    li.dataset.artist = song.artist || "";
    li.dataset.album = song.album || "";
    li.dataset.duration = String(song.duration || 0);
    li.dataset.cover = song.cover || "";
    li.dataset.extra = JSON.stringify(song.extra || {});
    li.dataset.sortSize = String(song.size || "");
    li.dataset.sortBitrate = String(song.bitrate || "");

    const coverHtml = song.cover
      ? `<img src="${song.cover}" alt="${song.name || ""}" loading="lazy">`
      : coverPlaceholderHtml(song.source);

    li.innerHTML = `
      <div class="checkbox-wrapper">
        <input type="checkbox" class="song-checkbox" ${state.selected.has(key) ? "checked" : ""}>
      </div>
      <div class="cover-wrapper">${coverHtml}</div>
      <div class="song-info">
        <h3></h3>
        <div class="artist-line"></div>
        <div class="tags">
          <span class="tag tag-src"></span>
          <span class="tag duration"></span>
          <span class="tag invalid">无效</span>
          <span class="tag size"></span>
          <span class="tag bitrate"></span>
        </div>
      </div>
      <div class="actions">
        <button type="button" class="btn-circle play" title="${isPlaying ? "正在播放" : "播放"}" aria-label="${isPlaying ? "正在播放" : "播放"}">${isPlaying ? "Ⅱ" : "▶"}</button>
        <button type="button" class="btn-circle switch-source" title="换源" aria-label="换源">${iconSwitchSource()}</button>
        <button type="button" class="btn-circle import" title="导入到歌曲库" aria-label="导入到歌曲库">${iconImportList()}</button>
        <button type="button" class="btn-circle download" title="保存到本地" aria-label="保存到本地">${iconDownloadLine()}</button>
      </div>
    `;

    li.querySelector("h3").textContent = song.name || "未知歌曲";
    attachCoverFallback(li.querySelector(".cover-wrapper"), song.source);
    const artistLine = li.querySelector(".artist-line");
    artistLine.textContent = `${song.artist || "未知歌手"} · ${song.album || "未知专辑"}`;
    li.querySelector(".tag-src").textContent = song.source || "-";
    li.querySelector(".duration").textContent = formatTime(song.duration);
    li.querySelector(".invalid").classList.toggle("show", isSongInvalid(song));
    li.querySelector(".size").textContent = formatSize(song.size);
    li.querySelector(".bitrate").textContent = formatBitrate(song.bitrate);

    const checkbox = li.querySelector(".song-checkbox");
    checkbox.addEventListener("change", () => {
      if (checkbox.checked) state.selected.add(key);
      else state.selected.delete(key);
      updateBackButton();
      updateBatchState();
    });

    li.querySelector(".play").addEventListener("click", () => {
      if (state.currentSong && songKey(state.currentSong) === key && state.isPlaying) {
        audio.pause();
      } else {
        playSong(song, index);
      }
    });
    li.querySelector(".switch-source").addEventListener("click", async () => {
      openSourceSwitchModal(song, index);
      return;
      const switched = await switchSourceForSong(song, "手动换源");
      if (!switched) setStatus(`${song.name || "当前歌曲"} 未找到可替换音源`, true);
    });
    li.querySelector(".import").addEventListener("click", () => importSongs([song]));
    li.querySelector(".download").addEventListener("click", () => startSongDownload(song));

    return li;
  }

  function renderPlaylistCard(item) {
    const article = document.createElement("article");
    article.className = "playlist-card";
    const playlistCover = item.cover
      ? `<img src="${item.cover}" alt="${item.name || ""}" loading="lazy">`
      : coverPlaceholderHtml(item.source, "playlist-placeholder");
    article.innerHTML = `
      <div class="playlist-cover">
        ${playlistCover}
        <span class="tag tag-src">${item.source || "-"}</span>
      </div>
      <div class="playlist-meta">
        <div class="playlist-title"></div>
        <div class="playlist-author"></div>
        <div class="playlist-card-actions">
          <div class="playlist-count">共 ${Number(item.track_count || 0)} 首</div>
          <button type="button" class="ctrl-btn primary">打开</button>
        </div>
      </div>
    `;

    const title = article.querySelector(".playlist-title");
    attachCoverFallback(article.querySelector(".playlist-cover"), item.source, "playlist-placeholder");
    title.textContent = item.name || "未命名";
    if (item.link) {
      const link = document.createElement("a");
      link.href = item.link;
      link.target = "_blank";
      link.rel = "noreferrer";
      link.textContent = "↗";
      link.title = "打开原始页面";
      title.append(" ", link);
    }

    article.querySelector(".playlist-author").textContent = item.creator ? `作者：${item.creator}` : (item.description || "");
    article.addEventListener("click", () => openServiceAbsolute(item.detail_url || item.link || ""));
    article.querySelector("button").addEventListener("click", (event) => {
      event.stopPropagation();
      openServiceAbsolute(item.detail_url || item.link || "");
    });
    return article;
  }

  function playlistGroupsBySource(items) {
    const groups = new Map();
    (Array.isArray(state.playlistView?.sources) ? state.playlistView.sources : []).forEach((source) => {
      const id = String(source || "").trim();
      if (id && !groups.has(id)) groups.set(id, []);
    });
    (Array.isArray(items) ? items : []).forEach((item) => {
      const source = String(item?.source || "unknown");
      if (!groups.has(source)) groups.set(source, []);
      groups.get(source).push(item);
    });
    return Array.from(groups.entries())
      .sort(([a], [b]) => {
        const diff = sourceOrderIndex(a) - sourceOrderIndex(b);
        return diff !== 0 ? diff : a.localeCompare(b);
      })
      .map(([source, playlists]) => ({ source, playlists }));
  }

  function renderLeaderboardSongRow(song, index, rankOffset = 0) {
    const row = document.createElement("div");
    row.className = "leaderboard-song-row";
    const key = songKey(song);
    const isCurrent = state.currentSong && songKey(state.currentSong) === key;
    const isPlaying = Boolean(isCurrent && state.isPlaying);
    if (isCurrent) row.classList.add("current");
    if (isPlaying) row.classList.add("playing");
    row.dataset.id = song.id;
    row.dataset.source = song.source;

    const coverHtml = song.cover
      ? `<img src="${song.cover}" alt="${song.name || ""}" loading="lazy">`
      : coverPlaceholderHtml(song.source, "leaderboard-song-placeholder");
    row.innerHTML = `
      <div class="leaderboard-song-rank">${rankOffset + index + 1}</div>
      <div class="leaderboard-song-main">
        <div class="leaderboard-song-cover">${coverHtml}</div>
        <div class="leaderboard-song-text">
          <div class="leaderboard-song-title"></div>
          <div class="leaderboard-song-subtitle"></div>
          <div class="leaderboard-song-tags">
            <span class="tag tag-src"></span>
            <span class="tag duration"></span>
            <span class="tag invalid">无效</span>
          </div>
        </div>
      </div>
      <div class="leaderboard-song-artist"></div>
      <div class="leaderboard-song-album"></div>
      <div class="leaderboard-song-actions">
        <button type="button" class="btn-circle play" title="${isPlaying ? "正在播放" : "播放"}" aria-label="${isPlaying ? "正在播放" : "播放"}">${isPlaying ? "Ⅱ" : "▶"}</button>
        <button type="button" class="btn-circle switch-source" title="换源" aria-label="换源">${iconSwitchSource()}</button>
        <button type="button" class="btn-circle import" title="导入到歌曲库" aria-label="导入到歌曲库">${iconImportList()}</button>
        <button type="button" class="btn-circle download" title="保存到本地" aria-label="保存到本地">${iconDownloadLine()}</button>
      </div>
    `;

    row.querySelector(".leaderboard-song-title").textContent = song.name || "未知歌曲";
    row.querySelector(".leaderboard-song-subtitle").textContent = `${song.artist || "未知歌手"} · ${song.album || "未知专辑"}`;
    row.querySelector(".leaderboard-song-artist").textContent = song.artist || "未知歌手";
    row.querySelector(".leaderboard-song-album").textContent = song.album || "未知专辑";
    row.querySelector(".tag-src").textContent = song.source || "-";
    row.querySelector(".duration").textContent = formatTime(song.duration);
    row.querySelector(".invalid").classList.toggle("show", isSongInvalid(song));
    attachCoverFallback(row.querySelector(".leaderboard-song-cover"), song.source, "leaderboard-song-placeholder");

    row.querySelector(".play").addEventListener("click", () => {
      if (state.currentSong && songKey(state.currentSong) === key && state.isPlaying) {
        audio.pause();
      } else {
        playSong(song, index);
      }
    });
    row.querySelector(".switch-source").addEventListener("click", async () => {
      openSourceSwitchModal(song, index);
      return;
      const switched = await switchSourceForSong(song, "手动换源");
      if (!switched) setStatus(`${song.name || "当前歌曲"} 未找到可替换音源`, true);
    });
    row.querySelector(".import").addEventListener("click", () => importSongs([song]));
    row.querySelector(".download").addEventListener("click", () => startSongDownload(song));

    return row;
  }

  function renderLeaderboardSongPanel() {
    const panel = document.createElement("section");
    panel.className = "leaderboard-song-panel";
    const statePanel = state.leaderboardPanel || {};
    const playlist = statePanel.playlist || {};
    const title = playlist.name || "请选择排行榜";
    const source = playlist.source || statePanel.activeSource || "";
    const songs = Array.isArray(statePanel.songs) ? statePanel.songs : [];
    const page = Math.max(1, Number(statePanel.page || 1));
    const totalPages = Math.max(0, Number(statePanel.totalPages || 0));
    const total = Number(statePanel.total || songs.length);
    const pageStart = Number(statePanel.pageStart || (songs.length ? 1 : 0));
    const pageEnd = Number(statePanel.pageEnd || songs.length);
    panel.innerHTML = `
      <header class="leaderboard-song-panel-head">
        <div>
          <h3></h3>
          <p></p>
        </div>
      </header>
    `;
    panel.querySelector("h3").textContent = title;
    panel.querySelector("p").textContent = source
      ? `${sourceDisplayName(source)} · ${total ? `${pageStart}-${pageEnd} / ${total}` : "0"} 首`
      : "";

    if (statePanel.loading) {
      const loading = document.createElement("div");
      loading.className = "leaderboard-panel-state";
      loading.textContent = "正在加载排行榜歌曲...";
      panel.append(loading);
      return panel;
    }
    if (statePanel.error) {
      const error = document.createElement("div");
      error.className = "leaderboard-panel-state error";
      error.textContent = statePanel.error;
      panel.append(error);
      return panel;
    }
    if (!songs.length) {
      const empty = document.createElement("div");
      empty.className = "leaderboard-panel-state";
      empty.textContent = "请选择左侧排行榜";
      panel.append(empty);
      return panel;
    }

    const table = document.createElement("div");
    table.className = "leaderboard-song-table";
    table.innerHTML = `
      <div class="leaderboard-song-row leaderboard-song-header" aria-hidden="true">
        <div class="leaderboard-song-rank">#</div>
        <div class="leaderboard-song-main">歌曲</div>
        <div class="leaderboard-song-artist">歌手</div>
        <div class="leaderboard-song-album">专辑</div>
        <div class="leaderboard-song-actions">操作</div>
      </div>
    `;
    songs.forEach((song, index) => table.append(renderLeaderboardSongRow(song, index, Math.max(0, pageStart - 1))));
    panel.append(table);
    if (totalPages > 1) {
      const pager = document.createElement("div");
      pager.className = "leaderboard-pager";
      pager.innerHTML = `
        <button type="button" class="ctrl-btn leaderboard-prev" ${page <= 1 ? "disabled" : ""}>上一页</button>
        <span class="leaderboard-page-text">第 ${page} / ${totalPages} 页</span>
        <button type="button" class="ctrl-btn leaderboard-next" ${page >= totalPages ? "disabled" : ""}>下一页</button>
      `;
      const board = statePanel.playlist || {};
      pager.querySelector(".leaderboard-prev")?.addEventListener("click", () => {
        loadLeaderboardPanelDetail(board, 0, Math.max(1, page - 1)).catch((error) => setStatus(`加载排行榜失败：${error.message}`, true));
      });
      pager.querySelector(".leaderboard-next")?.addEventListener("click", () => {
        loadLeaderboardPanelDetail(board, 0, Math.min(totalPages, page + 1)).catch((error) => setStatus(`加载排行榜失败：${error.message}`, true));
      });
      panel.append(pager);
    }
    return panel;
  }

  function renderLeaderboardSourceTabs(items) {
    const wrapper = document.createElement("section");
    wrapper.className = "playlist-source-tabs leaderboard-source-tabs";
    const groups = playlistGroupsBySource(items);
    const header = document.createElement("header");
    header.className = "playlist-source-tabs-head";
    const title = state.playlistView?.title || "排行榜";
    const subtitle = state.playlistView?.subtitle || "";
    const icon = state.playlistView?.icon || "";
    header.innerHTML = `
      <div>
        <h2>${icon ? `<span class="playlist-tabs-icon" aria-hidden="true">${icon}</span>` : ""}${title}</h2>
        ${subtitle ? `<p>${subtitle}</p>` : ""}
      </div>
    `;
    wrapper.append(header);

    if (!groups.length) {
      const empty = document.createElement("div");
      empty.className = "playlist-source-empty";
      empty.textContent = state.playlistView.emptyText || "暂无排行榜";
      wrapper.append(empty);
      return wrapper;
    }

    const tabList = document.createElement("div");
    tabList.className = "category-source-tabs";
    tabList.setAttribute("role", "tablist");
    const panels = document.createElement("div");
    panels.className = "category-source-panels leaderboard-source-panels";
    const activeSource = state.leaderboardPanel?.activeSource || groups.find((group) => group.playlists.length)?.source || groups[0]?.source;

    groups.forEach((group, index) => {
      const isActive = group.source === activeSource || (!activeSource && index === 0);
      const tabId = `leaderboard-source-tab-${group.source}-${index}`;
      const panelId = `leaderboard-source-panel-${group.source}-${index}`;
      const button = document.createElement("button");
      button.type = "button";
      button.className = `category-source-tab${isActive ? " is-active" : ""}`;
      button.id = tabId;
      button.setAttribute("role", "tab");
      button.setAttribute("aria-selected", String(isActive));
      button.setAttribute("aria-controls", panelId);
      button.innerHTML = `
        <span class="category-source-tab-name">${sourceDisplayName(group.source)}</span>
        <span class="category-source-tab-count">${group.playlists.length}</span>
      `;

      const panel = document.createElement("div");
      panel.className = `category-source-panel${isActive ? " is-active" : ""}`;
      panel.id = panelId;
      panel.setAttribute("role", "tabpanel");
      panel.setAttribute("aria-labelledby", tabId);

      const split = document.createElement("div");
      split.className = "leaderboard-split";
      const boardList = document.createElement("div");
      boardList.className = "leaderboard-board-list";

      if (group.playlists.length) {
        group.playlists.forEach((board, boardIndex) => {
          const boardKey = `${board.source}:${board.id}`;
          const boardButton = document.createElement("button");
          boardButton.type = "button";
          boardButton.className = `leaderboard-board-item${state.leaderboardPanel?.activeBoardKey === boardKey ? " is-active" : ""}`;
          boardButton.innerHTML = `
            <span class="leaderboard-board-index">${boardIndex + 1}</span>
            <span class="leaderboard-board-name"></span>
            <span class="leaderboard-board-count">${Number(board.track_count || 0) ? `${Number(board.track_count)} 首` : ""}</span>
          `;
          boardButton.querySelector(".leaderboard-board-name").textContent = board.name || "未命名榜单";
          boardButton.addEventListener("click", () => {
            loadLeaderboardPanelDetail(board, boardIndex).catch((error) => setStatus(`加载排行榜失败：${error.message}`, true));
          });
          boardList.append(boardButton);
        });
      } else {
        const empty = document.createElement("div");
        empty.className = "leaderboard-panel-state";
        empty.textContent = "暂无排行榜";
        boardList.append(empty);
      }

      if (isActive) {
        split.append(boardList, renderLeaderboardSongPanel());
      } else {
        const placeholder = document.createElement("section");
        placeholder.className = "leaderboard-song-panel";
        placeholder.innerHTML = '<div class="leaderboard-panel-state">请选择左侧排行榜</div>';
        split.append(boardList, placeholder);
      }
      panel.append(split);

      button.addEventListener("click", () => {
        tabList.querySelectorAll(".category-source-tab").forEach((item) => {
          const active = item === button;
          item.classList.toggle("is-active", active);
          item.setAttribute("aria-selected", String(active));
        });
        panels.querySelectorAll(".category-source-panel").forEach((item) => {
          item.classList.toggle("is-active", item.id === panelId);
        });
        if (group.playlists[0]) {
          loadLeaderboardPanelDetail(group.playlists[0], 0).catch((error) => setStatus(`加载排行榜失败：${error.message}`, true));
        }
      });

      tabList.append(button);
      panels.append(panel);
    });

    wrapper.append(tabList, panels);
    return wrapper;
  }

  function renderPlaylistSourceTabs(items) {
    const wrapper = document.createElement("section");
    wrapper.className = "playlist-source-tabs";
    const groups = playlistGroupsBySource(items);
    const header = document.createElement("header");
    header.className = "playlist-source-tabs-head";
    const title = state.playlistView?.title || "歌单";
    const subtitle = state.playlistView?.subtitle || "";
    const icon = state.playlistView?.icon || "";
    header.innerHTML = `
      <div>
        <h2>${icon ? `<span class="playlist-tabs-icon" aria-hidden="true">${icon}</span>` : ""}${title}</h2>
        ${subtitle ? `<p>${subtitle}</p>` : ""}
      </div>
    `;
    wrapper.append(header);

    if (!groups.length) {
      const empty = document.createElement("div");
      empty.className = "playlist-source-empty";
      empty.textContent = state.playlistView.emptyText || "暂无歌单";
      wrapper.append(empty);
      return wrapper;
    }

    const tabList = document.createElement("div");
    tabList.className = "category-source-tabs";
    tabList.setAttribute("role", "tablist");
    const panels = document.createElement("div");
    panels.className = "category-source-panels";

    groups.forEach((group, index) => {
      const tabId = `playlist-source-tab-${group.source}-${index}`;
      const panelId = `playlist-source-panel-${group.source}-${index}`;
      const button = document.createElement("button");
      button.type = "button";
      button.className = `category-source-tab${index === 0 ? " is-active" : ""}`;
      button.id = tabId;
      button.dataset.target = panelId;
      button.setAttribute("role", "tab");
      button.setAttribute("aria-selected", String(index === 0));
      button.setAttribute("aria-controls", panelId);
      button.innerHTML = `
        <span class="category-source-tab-name">${sourceDisplayName(group.source)}</span>
        <span class="category-source-tab-count">${group.playlists.length}</span>
      `;

      const panel = document.createElement("div");
      panel.className = `category-source-panel${index === 0 ? " is-active" : ""}`;
      panel.id = panelId;
      panel.setAttribute("role", "tabpanel");
      panel.setAttribute("aria-labelledby", tabId);
      const grid = document.createElement("div");
      grid.className = "playlist-grid-container playlist-tabs-grid";
      group.playlists.forEach((item) => grid.append(renderPlaylistCard(item)));
      panel.append(grid);

      button.addEventListener("click", () => {
        tabList.querySelectorAll(".category-source-tab").forEach((item) => {
          const active = item === button;
          item.classList.toggle("is-active", active);
          item.setAttribute("aria-selected", String(active));
        });
        panels.querySelectorAll(".category-source-panel").forEach((item) => {
          item.classList.toggle("is-active", item.id === panelId);
        });
      });

      tabList.append(button);
      panels.append(panel);
    });

    wrapper.append(tabList, panels);
    return wrapper;
  }

  function renderResults() {
    const host = $("results");
    host.innerHTML = "";
    updateBackButton();

    const items = state.searchType === "song" ? state.songs : state.playlists;
    document.body.classList.toggle("playlist-tabs-view", state.searchType === "playlist" && !!state.playlistView?.sourceTabs);
    if (!items.length && !(state.playlistView?.sourceTabs && Array.isArray(state.playlistView?.sources) && state.playlistView.sources.length)) {
      const emptyText = state.searchType === "playlist" ? (state.playlistView?.emptyText || "没有搜索结果") : "没有搜索结果";
      const emptyClass = state.playlistView?.kind === "user_playlists" && emptyText === "请在设置中登陆" ? " status-login-required" : "";
      host.innerHTML = `<div class="status${emptyClass}"></div>`;
      host.querySelector(".status").textContent = emptyText;
      updateBatchState();
      updateSummary();
      return;
    }

    if (state.searchType === "song") {
      const list = document.createElement("ul");
      list.className = "result-list";
      items.forEach((song, index) => {
        list.append(renderSongCard(song, index));
      });
      host.append(list);
    } else {
      if (state.playlistView?.sourceTabs) {
        host.append(state.playlistView?.kind === "leaderboards" ? renderLeaderboardSourceTabs(items) : renderPlaylistSourceTabs(items));
      } else {
        const grid = document.createElement("div");
        grid.className = ["playlist-grid-container", state.playlistView?.gridClass || ""].filter(Boolean).join(" ");
        items.forEach((item) => grid.append(renderPlaylistCard(item)));
        host.append(grid);
      }
    }

    updateBatchState();
    updateSummary();
  }

  function updateBatchState() {
    const count = state.selected.size;
    $("selectedCount").textContent = String(count);
    const batchToolbar = $("batchToolbar");
    batchToolbar.classList.toggle("active", state.batchMode);
    document.body.classList.toggle("batch-mode", state.batchMode);

    $("batchBtn").textContent = state.batchMode ? "退出批量" : "批量操作";
    $("selectAllSongs").checked = count > 0 && count === state.songs.length;

    document.querySelectorAll(".song-card").forEach((card) => {
      const checkbox = card.querySelector(".song-checkbox");
      if (checkbox) {
        card.classList.toggle("selected", checkbox.checked);
      }
    });
  }

  function getSelectedSongs() {
    return state.songs.filter((song) => state.selected.has(songKey(song)));
  }

  function toggleBatchMode(force) {
    state.batchMode = typeof force === "boolean" ? force : !state.batchMode;
    if (!state.batchMode) {
      state.selected.clear();
      document.querySelectorAll(".song-checkbox").forEach((checkbox) => {
        checkbox.checked = false;
      });
    }
    updateBatchState();
  }

  function songQuery(song, stream = false) {
    return {
      source: song.source,
      id: song.id,
      name: song.name || "",
      artist: song.artist || "",
      album: song.album || "",
      cover: song.cover || "",
      duration: song.duration || 0,
      extra: song.extra ? JSON.stringify(song.extra) : "",
      stream: stream ? 1 : undefined,
    };
  }

  function downloadSongQuery(song) {
    const query = songQuery(song, false);
    const settings = normalizeWebSettings(state.settings || {});
    if (settings.embedDownload) query.embed = 1;
    return query;
  }

  function lyricQuery(song) {
    return {
      id: song.id,
      source: song.source,
      name: song.name || "",
      artist: song.artist || "",
      album: song.album || "",
      duration: song.duration || 0,
      extra: song.extra ? JSON.stringify(song.extra) : "",
    };
  }

  function sourceDataExtra(song) {
    const extra = song?.extra && typeof song.extra === "object" && !Array.isArray(song.extra) ? { ...song.extra } : {};
    const lyric = extractEmbeddedLyric(song);
    const cover = String(song?.cover || song?.cover_url || song?.coverUrl || song?.pic || song?.img || extra.cover || "").trim();
    if (cover && !extra.cover) extra.cover = cover;
    if (lyric) extra.lyric = lyric;
    return extra;
  }

  function sourceData(song) {
    const extra = sourceDataExtra(song);
    const cover = String(song.cover || extra.cover || "").trim();
    return {
      provider: "go-music-js",
      source: song.source,
      id: song.id,
      name: song.name || "",
      artist: song.artist || "",
      album: song.album || "",
      album_id: song.album_id || "",
      cover,
      duration: song.duration || 0,
      size: song.size || 0,
      bitrate: song.bitrate || 0,
      ext: song.ext || "",
      link: song.link || "",
      extra,
    };
  }

  function isSongInvalid(song) {
    return !!(song?.is_invalid || song?.invalid || song?._invalid);
  }

  function isTransientPlayableError(error) {
    const message = String(error?.message || error || "").toLowerCase();
    return [
      "bad gateway",
      "gateway",
      "timeout",
      "timed out",
      "too many requests",
      "rate limit",
      "network",
      "fetch failed",
      "plugin_unavailable",
      "插件暂不可用",
      "稍后重试",
      "http 429",
      "http 500",
      "http 502",
      "http 503",
      "http 504",
      "502",
      "503",
      "504",
    ].some((item) => message.includes(item));
  }

  async function checkSongPlayable(song, options = {}) {
    if (!song || !song.id || !song.source || song.source === "local") return true;
    const attempts = Math.max(1, Number(options.attempts || 1));
    let lastError = null;
    for (let attempt = 0; attempt < attempts; attempt += 1) {
      try {
        await api("./api/music/url", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ source_data: sourceData(song) }),
        });
        return { ok: true, transient: false };
      } catch (error) {
        lastError = error;
        if (!isTransientPlayableError(error) || attempt >= attempts - 1) break;
      }
    }
    return { ok: false, transient: isTransientPlayableError(lastError), error: lastError };
  }

  async function validateInvalidSongs(songs, label = "歌单") {
    const list = Array.isArray(songs) ? songs.filter((song) => song && song.id && song.source && song.source !== "local") : [];
    if (!list.length) return;
    const runId = ++state.invalidCheckRunId;
    const concurrency = 2;
    let cursor = 0;
    let invalidCount = 0;
    addLog("trace", "音源检测", `${label} 开始检测无效歌曲`, { total: list.length });

    async function worker() {
      while (cursor < list.length && runId === state.invalidCheckRunId) {
        const song = list[cursor++];
        try {
          const result = await checkSongPlayable(song, { attempts: 1 });
          if (result.ok) {
            song.is_invalid = false;
            continue;
          }
          if (result.transient) {
            addLog("warn", "音源检测", `${song.name || "歌曲"} 检测临时失败，已跳过无效标记`, {
              source: song.source,
              id: song.id,
              error: result.error?.message || String(result.error || ""),
            });
            continue;
          }
          song.is_invalid = true;
          invalidCount += 1;
          addLog("warn", "音源检测", `${song.name || "歌曲"} 标记为无效`, {
            source: song.source,
            id: song.id,
            error: result.error?.message || String(result.error || ""),
          });
        } catch (error) {
          if (isTransientPlayableError(error)) {
            addLog("warn", "音源检测", `${song.name || "歌曲"} 检测临时失败，已跳过无效标记`, {
              source: song.source,
              id: song.id,
              error: error?.message || String(error),
            });
            continue;
          }
          song.is_invalid = true;
          invalidCount += 1;
          addLog("warn", "音源检测", `${song.name || "歌曲"} 标记为无效`, {
            source: song.source,
            id: song.id,
            error: error?.message || String(error),
          });
        }
      }
    }

    await Promise.all(Array.from({ length: Math.min(concurrency, list.length) }, () => worker()));
    if (runId !== state.invalidCheckRunId) return;
    renderResults();
    if (invalidCount) {
      setStatus(`${label}检测完成：${invalidCount} 首无效`);
    } else {
      setStatus(`${label}检测完成：未发现无效歌曲`);
      addLog("info", "音源检测", `${label}检测完成，未发现无效歌曲`, { total: list.length });
    }
  }

  function clearInvalidSongValidation() {
    state.invalidCheckRunId += 1;
    if (state.invalidCheckTimer) {
      window.clearTimeout(state.invalidCheckTimer);
      state.invalidCheckTimer = 0;
    }
  }

  function scheduleInvalidSongValidation(songs, label = "歌单") {
    clearInvalidSongValidation();
    const list = Array.isArray(songs) ? songs.filter((song) => song && song.id && song.source && song.source !== "local") : [];
    if (!list.length) return;
    state.invalidCheckTimer = window.setTimeout(() => {
      state.invalidCheckTimer = 0;
      validateInvalidSongs(list, label).catch((error) => addLog("error", "音源检测", `${label} 无效歌曲检测失败`, error));
    }, 1800);
  }

  async function playSong(song, index = -1) {
    if (!song) return;
    const requestId = ++state.playRequestId;
    clearInvalidSongValidation();
    stopActiveAudio();
    state.currentIndex = index;
    state.isPlaying = false;
    setPlayer(song, "解析中");
    setPlayerLyric("歌词加载中...");
    loadPlayerLyrics(song, requestId);
    setStatus(`正在解析：${song.name}`);

    try {
      const payload = song._resolvedPlayback || await resolveSongForPlayback(song);
      if (song._resolvedPlayback) delete song._resolvedPlayback;
      assertActivePlayRequest(requestId);
      audio.src = await resolvePlayableAudioUrl(payload.url, song, requestId);
      assertActivePlayRequest(requestId);
      audio.volume = Number($("volumeBar").value || 0.72);
      await audio.play();
      assertActivePlayRequest(requestId);
      state.isPlaying = true;
      setPlayer(song, "播放中");
      if (state.lyrics.length) updatePlayerLyricByTime(audio.currentTime || 0, true);
      $("playPauseBtn").textContent = "Ⅱ";
      setStatus(`正在播放：${song.name}`);
    } catch (error) {
      if (requestId !== state.playRequestId) return;
      state.isPlaying = false;
      song.is_invalid = true;
      setPlayer(song, "播放失败");
      setPlayerLyric("播放失败");
      $("playPauseBtn").textContent = "▶";
      renderResults();
      addLog("error", "播放", `${song.name || "未知歌曲"} 播放失败`, {
        source: song.source,
        id: song.id,
        artist: song.artist,
        album: song.album,
        error: error.message || String(error),
      });
      setStatus(`播放失败：${error.message}`, true);
    }
  }

  async function togglePlay() {
    if (!audio.src && state.songs.length > 0) {
      return playSong(state.songs[0], 0);
    }
    if (audio.paused) {
      await audio.play();
      state.isPlaying = true;
      $("playPauseBtn").textContent = "Ⅱ";
      $("playerState").textContent = "播放中";
      updateSongPlaybackIndicators();
    } else {
      audio.pause();
      $("playPauseBtn").textContent = "▶";
      $("playerState").textContent = "已暂停";
    }
  }

  function playNext() {
    if (!state.songs.length) return;
    const next = state.currentIndex + 1 >= state.songs.length ? 0 : state.currentIndex + 1;
    playSong(state.songs[next], next);
  }

  function playRandomNext() {
    if (!state.songs.length) return;
    if (state.songs.length === 1) {
      playSong(state.songs[0], 0);
      return;
    }
    let next = state.currentIndex;
    while (next === state.currentIndex) {
      next = Math.floor(Math.random() * state.songs.length);
    }
    playSong(state.songs[next], next);
  }

  function handleEndedByPlayMode() {
    state.isPlaying = false;
    updateSongPlaybackIndicators();
    if (!state.songs.length) return;

    if (state.playMode === "repeat-one") {
      audio.currentTime = 0;
      audio.play().catch((error) => setStatus(`播放失败：${error.message}`, true));
      return;
    }

    if (state.playMode === "shuffle") {
      playRandomNext();
      return;
    }

    const isLast = state.currentIndex < 0 || state.currentIndex >= state.songs.length - 1;
    if (state.playMode === "order" && isLast) {
      $("playPauseBtn").textContent = "▶";
      $("playerState").textContent = "已结束";
      return;
    }

    playNext();
  }

  function playPrev() {
    if (!state.songs.length) return;
    const prev = state.currentIndex - 1 < 0 ? state.songs.length - 1 : state.currentIndex - 1;
    playSong(state.songs[prev], prev);
  }

  async function importSongs(songs) {
    const validSongs = Array.isArray(songs) ? songs.filter((song) => song && song.id && song.source && song.name) : [];
    if (!validSongs.length) {
      setStatus("请先选择要导入的歌曲", true);
      showOperationToast("请先选择要导入的歌曲", "error");
      return;
    }

    setStatus(`正在导入 ${validSongs.length} 首歌曲...`);
    showOperationToast(`正在导入 ${validSongs.length} 首歌曲...`, "info", 1800);
    try {
      const result = await api("./api/songs/import", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ songs: validSongs }),
      });
      setStatus(`导入完成：成功 ${result.success || 0} 首`);
      showOperationToast(`导入完成：成功 ${result.success || 0} 首`, "success");
    } catch (error) {
      addLog("error", "导入", `导入 ${validSongs.length} 首歌曲失败`, error);
      setStatus(`导入失败：${error.message}`, true);
      showOperationToast(`导入失败：${error.message}`, "error", 4200);
    }
  }

  function startSongDownload(song) {
    setStatus("\u4e0b\u8f7d\u529f\u80fd\u6682\u672a\u5f00\u53d1", true);
    showOperationToast("\u4e0b\u8f7d\u529f\u80fd\u6682\u672a\u5f00\u53d1", "warn", 2800);
  }

  function playAll() {
    if (state.searchType === "song" && state.songs.length > 0) {
      playSong(state.songs[0], 0);
      return;
    }
    const firstPlaylist = state.playlists[0];
    if (firstPlaylist) {
      openServiceAbsolute(firstPlaylist.detail_url || firstPlaylist.link || "");
    }
  }

  async function batchImportSelected() {
    await importSongs(getSelectedSongs());
  }

  async function search(page = 1) {
    const keyword = $("searchKeyword").value.trim();
    if (!keyword) {
      setStatus("请输入搜索关键字", true);
      return;
    }

    const params = new URLSearchParams();
    params.set("q", keyword);
    params.set("type", state.searchType);
    params.set("page", String(page));
    params.set("page_size", String(state.pageSize || 30));
    params.set("exact_artist", "");
    const sources = activeSourcesForType(state.searchType);
    const fallbackSources = visibleSources().filter((source) => supportsSource(source, state.searchType)).map((source) => source.id);
    (sources.length ? sources : fallbackSources).forEach((source) => params.append("sources", source));

    $("searchBtn").disabled = true;
    setStatus("正在搜索...");
    addLog("trace", "搜索", `开始搜索：${keyword}`, { type: state.searchType, sources: sources.length ? sources : fallbackSources, page });

    try {
      const data = await api(`./api/search?${params.toString()}`);
      clearBackView();
      state.pageLoader = null;
      state.searchType = data.type || state.searchType;
      state.songs = sortSongsBySourceOrder(Array.isArray(data.songs) ? data.songs : []);
      state.playlists = Array.isArray(data.playlists) ? data.playlists : [];
      state.page = Number(data.page || page || 1);
      state.pageSize = Number(data.page_size || 30);
      state.total = Number(data.total || state.songs.length || state.playlists.length || 0);
      state.totalPages = Number(data.total_pages || 1);
      state.pageStart = Number(data.page_start || (state.total > 0 ? 1 : 0));
      state.pageEnd = Number(data.page_end || (state.searchType === "song" ? state.songs.length : state.playlists.length));
      state.selected.clear();
      renderResults();
      addLog("info", "搜索", `搜索完成：${keyword}`, { type: state.searchType, total: state.total, songs: state.songs.length, playlists: state.playlists.length });
      setStatus(`找到 ${state.total} ${resultUnit(state.searchType)}`);
    } catch (error) {
      addLog("error", "搜索", `搜索失败：${keyword}`, {
        type: state.searchType,
        sources: sources.length ? sources : fallbackSources,
        error: error.message || String(error),
      });
      setStatus(`搜索失败：${error.message}`, true);
      $("results").innerHTML = "";
      $("pagination").classList.remove("active");
    } finally {
      $("searchBtn").disabled = false;
    }
  }

  async function loadSources() {
    const sources = await api("./api/sources");
    state.sources = Array.isArray(sources) ? sources : [];
    applyConfiguredSourceOrder();
    const existing = new Set(state.selectedSources);
    if (!existing.size) {
      (state.settings.selected_sources || []).forEach((id) => existing.add(String(id)));
    }
    if (!existing.size) {
      visibleSources().filter((source) => source.searchSupported !== false).forEach((source) => existing.add(source.id));
    }
    existing.delete("local");
    state.selectedSources = existing;
    renderSources();
  }

  async function loadSettings() {
    const settings = await api("./api/settings");
    state.settings = settings || {};
    state.pageSize = intSetting(state.settings.webPageSize, state.pageSize || DEFAULT_WEB_SETTINGS.webPageSize);
    state.selectedSources = new Set(Array.isArray(state.settings.selected_sources) ? state.settings.selected_sources.map(String) : state.selectedSources);
    state.selectedSources.delete("local");
    applyConfiguredSourceOrder();
    applySettingsToForm(state.settings);
    renderSources();
  }

  function renderCookieFields(cookies = {}) {
    const host = $("cookieFields");
    host.innerHTML = "";
    const platformRank = new Map(SETTINGS_PLATFORM_ORDER.map((id, index) => [id, index]));
    const platformSources = state.sources
      .filter((source) => source.id !== "local")
      .slice()
      .sort((a, b) => {
        const ai = platformRank.has(a.id) ? platformRank.get(a.id) : SETTINGS_PLATFORM_ORDER.length;
        const bi = platformRank.has(b.id) ? platformRank.get(b.id) : SETTINGS_PLATFORM_ORDER.length;
        return ai - bi;
      });
    platformSources.forEach((source) => {
      const wrapper = document.createElement("div");
      wrapper.className = "cookie-field";
      const loginButtons = [];
      if (source.id === "qq") {
        loginButtons.push({ source: "qq", label: "QQ扫码" }, { source: "qq_wx", label: "微信扫码" });
      } else if (QR_LOGIN_SOURCES[source.id]) {
        loginButtons.push({ source: source.id, label: "扫码" });
      }
      wrapper.innerHTML = `
        <label>${source.id}</label>
        <div class="cookie-input-row">
          <input data-source="${source.id}" type="text" placeholder="在此粘贴 Cookie...">
          ${loginButtons.map((item) => `<button type="button" class="cookie-qr-btn" data-source="${item.source}">${item.label}</button>`).join("")}
        </div>
      `;
      wrapper.querySelector("input").value = cookies[source.id] || "";
      wrapper.querySelectorAll(".cookie-qr-btn").forEach((qrBtn) => {
        qrBtn.addEventListener("click", () => {
          const loginSource = qrBtn.dataset.source || source.id;
          startQRLogin(loginSource);
        });
      });
      host.append(wrapper);
    });
  }

  async function loadCookies() {
    const cookies = await api("./api/cookies");
    renderCookieFields(cookies || {});
  }

  async function saveCookies(options = {}) {
    const cookies = {};
    document.querySelectorAll("#cookieFields input[data-source]").forEach((input) => {
      cookies[input.dataset.source] = input.value.trim();
    });
    await api("./api/cookies", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ cookies }),
    });
    if (!options.silent) showOperationToast("Cookie 已保存");
    setStatus("Cookie 已保存");
  }

  async function saveSettings(options = {}) {
    const webSettings = collectWebSettings();
    const payload = {
      ...webSettings,
      selected_sources: Array.from(state.selectedSources).filter((id) => id !== "local"),
      sourceOrder: sourceOrderIds(),
      source_order: sourceOrderIds(),
    };
    state.settings = await api("./api/settings", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    state.pageSize = intSetting(state.settings.webPageSize, state.pageSize || DEFAULT_WEB_SETTINGS.webPageSize);
    applySettingsToForm(state.settings);
    await saveCookies({ silent: true });
    if (!options.silent) {
      showOperationToast(state.settings.settings_error ? "设置已保存，部分配置同步失败" : "设置已保存", state.settings.settings_error ? "warn" : "success");
      setStatus(state.settings.settings_error ? `设置已保存，部分配置同步失败：${state.settings.settings_error}` : "设置已保存", !!state.settings.settings_error);
    }
    renderSources();
    return state.settings;
  }

  async function healthCheck() {
    await saveSettings({ silent: true });
  }

  function openSettings() {
    const dialog = $("settingsDialog");
    dialog.showModal();
    renderLogs();
    loadSettings().catch((error) => setStatus(`设置读取失败：${error.message}`, true));
    loadCookies().catch((error) => setStatus(`Cookie 读取失败：${error.message}`, true));
  }

  function setupTopActions() {
    $("recommendBtn").addEventListener("click", () => {
      openServicePath("/recommend", { sources: RECOMMEND_PLAYLIST_SOURCES });
    });
    $("leaderboardBtn").addEventListener("click", () => {
      openServicePath("/leaderboards", { sources: LEADERBOARD_SOURCES });
    });
    $("localListBtn").addEventListener("click", () => openServicePath("/my_collections"));
    $("localMusicBtn").addEventListener("click", () => openServicePath("/local_music_page"));
    $("myPlaylistsBtn").addEventListener("click", () => {
      openServicePath("/user_playlists");
    });
    $("sourceToggleBtn").addEventListener("click", () => {
      state.sourceCollapsed = !state.sourceCollapsed;
      $("sourceSelector").classList.toggle("is-collapsed", state.sourceCollapsed);
      $("sourceToggleBtn").setAttribute("aria-expanded", String(!state.sourceCollapsed));
    });
    $("sourceSortBtn").addEventListener("click", () => {
      state.sourceSortMode = !state.sourceSortMode;
      $("sourceSortBtn").classList.toggle("active", state.sourceSortMode);
      $("sourceSortBtn").textContent = state.sourceSortMode ? "完成" : "排序";
      renderSources();
    });
    $("selectAllSources").addEventListener("click", () => {
      visibleSources().forEach((source) => state.selectedSources.add(source.id));
      renderSources();
      saveSettings({ silent: true }).catch(() => {});
    });
    $("clearSources").addEventListener("click", () => {
      state.selectedSources.clear();
      renderSources();
      saveSettings({ silent: true }).catch(() => {});
    });
  }

  function setupSearchType() {
    searchTypeInputs.forEach((input) => {
      input.addEventListener("change", () => {
        setSearchType(input.value);
      });
    });
  }

  function setupPlayerControls() {
    updatePlayModeButton();
    $("playPauseBtn").addEventListener("click", togglePlay);
    $("prevBtn").addEventListener("click", playPrev);
    $("nextBtn").addEventListener("click", playNext);
    $("volumeBar").addEventListener("input", () => {
      audio.volume = Number($("volumeBar").value || 0.72);
    });
    $("seekBar").addEventListener("input", () => {
      if (audio.duration) {
        audio.currentTime = (Number($("seekBar").value) / 1000) * audio.duration;
      }
    });
    $("speedBtn").addEventListener("click", () => {
      const speeds = [1, 1.25, 1.5, 2];
      const current = speeds.indexOf(audio.playbackRate);
      audio.playbackRate = speeds[(current + 1) % speeds.length];
      $("speedBtn").textContent = `${audio.playbackRate.toFixed(2).replace(/\.00$/, ".0")}x`;
    });
    $("loopBtn").addEventListener("click", () => {
      const current = PLAY_MODES.findIndex((item) => item.id === state.playMode);
      state.playMode = PLAY_MODES[(current + 1) % PLAY_MODES.length].id;
      audio.loop = false;
      updatePlayModeButton();
      setStatus(`播放模式：${playModeMeta().title}`);
    });
  }

  function setupAudio() {
    audio.addEventListener("timeupdate", () => {
      $("currentTime").textContent = formatTime(audio.currentTime);
      $("durationTime").textContent = formatTime(audio.duration);
      $("seekBar").value = audio.duration ? String(Math.round((audio.currentTime / audio.duration) * 1000)) : "0";
      updatePlayerLyricByTime(audio.currentTime);
    });
    audio.addEventListener("ended", () => {
      handleEndedByPlayMode();
    });
    audio.addEventListener("pause", () => {
      if (audio.src) {
        state.isPlaying = false;
        $("playPauseBtn").textContent = "▶";
        $("playerState").textContent = "已暂停";
        updateSongPlaybackIndicators();
      }
    });
    audio.addEventListener("play", () => {
      state.isPlaying = true;
      $("playPauseBtn").textContent = "Ⅱ";
      $("playerState").textContent = "播放中";
      updateSongPlaybackIndicators();
    });
    audio.addEventListener("error", () => {
      const mediaError = audio.error;
      const codeMap = {
        1: "MEDIA_ERR_ABORTED",
        2: "MEDIA_ERR_NETWORK",
        3: "MEDIA_ERR_DECODE",
        4: "MEDIA_ERR_SRC_NOT_SUPPORTED",
      };
      const code = mediaError?.code || 0;
      addLog("error", "音频加载", `${state.currentSong?.name || "当前歌曲"} 加载失败`, {
        code,
        name: codeMap[code] || "UNKNOWN",
        message: mediaError?.message || "",
        source: state.currentSong?.source,
        id: state.currentSong?.id,
        url: String(audio.currentSrc || audio.src || "").slice(0, 800),
      });
      if (state.currentSong) {
        state.isPlaying = false;
        $("playerState").textContent = "播放失败";
        updateSongPlaybackIndicators();
        setStatus(`播放失败：${codeMap[code] || "音频加载失败"}`, true);
      }
    });
  }

  function setupSourceSwitchModal() {
    $("sourceSwitchClose")?.addEventListener("click", closeSourceSwitchModal);
    $("sourceSwitchConfirm")?.addEventListener("click", () => {
      confirmSourceSwitch().catch((error) => {
        addLog("error", "手动换源", "确认换源失败", error);
        setStatus(`确认换源失败：${error.message || String(error)}`, true);
      });
    });
    $("sourceSwitchLayer")?.addEventListener("click", (event) => {
      if (event.target?.classList?.contains("source-switch-backdrop")) closeSourceSwitchModal();
    });
  }

  function setupResultsControls() {
    $("playAllBtn").addEventListener("click", playAll);
    $("batchBtn").addEventListener("click", () => toggleBatchMode());
    $("batchImportBtn").addEventListener("click", batchImportSelected);
    $("selectAllSongs").addEventListener("change", (event) => {
      const checked = event.target.checked;
      document.querySelectorAll(".song-checkbox").forEach((checkbox) => {
        checkbox.checked = checked;
        const card = checkbox.closest(".song-card");
        const song = card ? state.songs.find((item) => songKey(item) === `${card.dataset.source}:${card.dataset.id}`) : null;
        if (song) {
          if (checked) state.selected.add(songKey(song));
          else state.selected.delete(songKey(song));
        }
      });
      updateBatchState();
    });
    $("searchForm").addEventListener("submit", (event) => {
      event.preventDefault();
      search(1);
    });
    $("searchKeyword").addEventListener("keydown", (event) => {
      if (event.key === "Enter") {
        event.preventDefault();
        search(1);
      }
    });
  }

  function setupSettings() {
    $("settingsBtn").addEventListener("click", openSettings);
    $("settingDownloadDirPreset").addEventListener("change", () => {
      const preset = $("settingDownloadDirPreset");
      const input = $("settingDownloadDir");
      if (!preset || !input) return;
      if (preset.value === DOWNLOAD_DIR_CUSTOM_VALUE) {
        input.focus();
        return;
      }
      input.value = preset.value;
    });
    $("settingDownloadDir").addEventListener("input", syncDownloadDirPreset);
    $("saveSettingsBtn").addEventListener("click", () => {
      saveSettings().catch((error) => setStatus(`设置保存失败：${error.message}`, true));
    });
    $("clearLogsBtn")?.addEventListener("click", clearLogs);
    $("logSearchInput")?.addEventListener("input", (event) => {
      state.logFilters.query = event.target.value || "";
      renderLogs();
    });
    $("logContextFilter")?.addEventListener("change", (event) => {
      state.logFilters.context = event.target.value || "";
      renderLogs();
    });
    $("logLevelFilter")?.addEventListener("change", (event) => {
      state.logFilters.level = event.target.value || "";
      renderLogs();
    });
    $("qrLoginCloseBtn")?.addEventListener("click", closeQRLogin);
    $("qrLoginDialog")?.addEventListener("close", clearQRLoginPoll);
    $("qrLoginRefreshBtn")?.addEventListener("click", () => {
      if (qrLoginState.source) startQRLogin(qrLoginState.source);
    });
    $("qrLoginActionCloseBtn")?.addEventListener("click", closeQRLogin);
    $("viewBackBtn")?.addEventListener("click", restoreBackView);
  }

  function bindGlobalKeyboard() {
    window.addEventListener("keydown", (event) => {
      if (event.key === "Escape" && state.sourceSwitchModal.open) {
        closeSourceSwitchModal();
        return;
      }
      if (event.key === "Escape" && state.batchMode) {
        toggleBatchMode(false);
      }
    });
  }

  async function init() {
    setupTopActions();
    setupSearchType();
    setupResultsControls();
    setupSettings();
    setupPlayerControls();
    setupSourceSwitchModal();
    setupAudio();
    bindGlobalKeyboard();
    renderLogs();

    try {
      await loadSources();
      await loadSettings();
      renderCookieFields({});
      setSearchType(state.searchType);
      $("searchKeyword").placeholder = searchPlaceholder(state.searchType);
      updateSummary();
      const currentPath = `/${window.location.pathname.split("/").filter(Boolean).pop() || ""}`;
      if (INTERNAL_PAGE_PATHS.has(currentPath) && currentPath !== "/" && currentPath !== "/player") {
        openServicePath(currentPath, searchParamsToQuery(new URLSearchParams(window.location.search)));
      } else {
        setStatus("请输入关键词开始搜索");
      }
    } catch (error) {
      setStatus(error.message, true);
    }

    $("volumeBar").dispatchEvent(new Event("input"));
  }

  init().catch((error) => setStatus(error.message, true));
})();







