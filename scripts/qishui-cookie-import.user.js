// ==UserScript==
// @name         Go Music JS - 汽水音乐 Cookie 导入助手
// @namespace    https://github.com/fanliu-yi/go-music-js
// @version      0.1.0
// @description  在浏览器中登录汽水音乐后，将 Cookie 导入 Go Music JS 插件设置。
// @author       fanliu-yi
// @match        https://www.qishui.com/*
// @match        https://qishui.com/*
// @match        http://*/api/v1/jsplugin/go-music-js/*
// @match        https://*/api/v1/jsplugin/go-music-js/*
// @grant        GM_getValue
// @grant        GM_setValue
// @grant        GM_registerMenuCommand
// @grant        GM_setClipboard
// @grant        GM_notification
// @grant        GM_cookie
// @run-at       document-idle
// ==/UserScript==

(function () {
  'use strict';

  const STORAGE_COOKIE = 'go_music_js_qishui_cookie';
  const STORAGE_TIME = 'go_music_js_qishui_cookie_time';
  const STORAGE_IMPORTED_TIME = 'go_music_js_qishui_imported_time';
  const STORAGE_PLUGIN_URL = 'go_music_js_plugin_url';
  const DEFAULT_PLUGIN_URL = 'http://192.168.31.176:58091/api/v1/jsplugin/go-music-js/#/login?source=soda';
  const QISHUI_HOST_RE = /(^|\.)qishui\.com$/i;

  function notify(text, title = 'Go Music JS') {
    try {
      if (typeof GM_notification === 'function') GM_notification({ title, text, timeout: 3000 });
    } catch (_) {}
  }

  function nowText() {
    const d = new Date();
    const pad = (n) => String(n).padStart(2, '0');
    return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`;
  }

  function safeGet(key, fallback = '') {
    try {
      const value = GM_getValue(key, fallback);
      return value == null ? fallback : value;
    } catch (_) {
      return fallback;
    }
  }

  function safeSet(key, value) {
    try {
      GM_setValue(key, value);
    } catch (_) {}
  }

  function setClipboard(text) {
    try {
      if (typeof GM_setClipboard === 'function') {
        GM_setClipboard(text, 'text');
        return true;
      }
    } catch (_) {}
    try {
      navigator.clipboard.writeText(text);
      return true;
    } catch (_) {
      return false;
    }
  }

  function cookieListByGM() {
    return new Promise((resolve) => {
      try {
        if (typeof GM_cookie === 'undefined' || !GM_cookie || typeof GM_cookie.list !== 'function') {
          resolve([]);
          return;
        }
        GM_cookie.list({}, (cookies, error) => {
          if (error || !Array.isArray(cookies)) {
            resolve([]);
            return;
          }
          resolve(cookies);
        });
      } catch (_) {
        resolve([]);
      }
    });
  }

  function parseDocumentCookie() {
    return String(document.cookie || '')
      .split(';')
      .map((part) => part.trim())
      .filter(Boolean)
      .map((part) => {
        const index = part.indexOf('=');
        return index > 0 ? { name: part.slice(0, index), value: part.slice(index + 1), domain: location.hostname } : null;
      })
      .filter(Boolean);
  }

  async function readQishuiCookies() {
    const gmCookies = await cookieListByGM();
    const cookies = gmCookies.length ? gmCookies : parseDocumentCookie();
    const map = new Map();
    for (const cookie of cookies) {
      const name = String(cookie && cookie.name || '').trim();
      const value = String(cookie && cookie.value || '').trim();
      const domain = String(cookie && cookie.domain || location.hostname).replace(/^\./, '');
      if (!name || !value) continue;
      if (!QISHUI_HOST_RE.test(domain) && !QISHUI_HOST_RE.test(location.hostname)) continue;
      map.set(name, value);
    }
    return Array.from(map.entries())
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([name, value]) => `${name}=${value}`)
      .join('; ');
  }

  function panelStyle() {
    return `
      position: fixed;
      right: 18px;
      bottom: 18px;
      z-index: 2147483647;
      width: 310px;
      padding: 14px;
      box-sizing: border-box;
      border: 1px solid rgba(30, 64, 175, .18);
      border-radius: 14px;
      background: rgba(255, 255, 255, .96);
      color: #111827;
      box-shadow: 0 18px 46px rgba(15, 23, 42, .18);
      font: 13px/1.5 -apple-system, BlinkMacSystemFont, "Segoe UI", "Microsoft YaHei", sans-serif;
    `;
  }

  function buttonStyle(primary) {
    return `
      border: 1px solid ${primary ? '#2563eb' : '#d1d5db'};
      border-radius: 999px;
      background: ${primary ? '#2563eb' : '#fff'};
      color: ${primary ? '#fff' : '#111827'};
      padding: 7px 12px;
      cursor: pointer;
      font: inherit;
    `;
  }

  function createPanel(title, message) {
    const existing = document.getElementById('gmjs-qishui-helper');
    if (existing) existing.remove();
    const panel = document.createElement('div');
    panel.id = 'gmjs-qishui-helper';
    panel.style.cssText = panelStyle();
    panel.innerHTML = `
      <div style="display:flex;align-items:center;justify-content:space-between;gap:10px;margin-bottom:8px;">
        <strong style="font-size:14px;">${title}</strong>
        <button type="button" data-close style="border:0;background:transparent;font-size:18px;line-height:1;cursor:pointer;color:#6b7280;">×</button>
      </div>
      <div data-message style="color:#4b5563;margin-bottom:12px;">${message}</div>
      <div data-actions style="display:flex;flex-wrap:wrap;gap:8px;"></div>
    `;
    panel.querySelector('[data-close]').addEventListener('click', () => panel.remove());
    document.body.appendChild(panel);
    return panel;
  }

  function addButton(panel, text, primary, handler) {
    const button = document.createElement('button');
    button.type = 'button';
    button.textContent = text;
    button.style.cssText = buttonStyle(primary);
    button.addEventListener('click', handler);
    panel.querySelector('[data-actions]').appendChild(button);
    return button;
  }

  function setPanelMessage(panel, message) {
    const el = panel && panel.querySelector('[data-message]');
    if (el) el.textContent = message;
  }

  function pluginURL() {
    return String(safeGet(STORAGE_PLUGIN_URL, DEFAULT_PLUGIN_URL) || DEFAULT_PLUGIN_URL).trim();
  }

  function setPluginURL() {
    const current = pluginURL();
    const next = prompt('请输入 Go Music JS 插件地址：', current);
    if (!next) return;
    safeSet(STORAGE_PLUGIN_URL, next.trim());
    notify('插件地址已保存');
  }

  async function exportQishuiCookie(panel) {
    const cookie = await readQishuiCookies();
    if (!cookie) {
      setPanelMessage(panel, '没有读取到汽水音乐 Cookie。请先在当前浏览器登录汽水音乐，然后刷新页面再试。');
      notify('没有读取到汽水音乐 Cookie');
      return '';
    }
    const time = String(Date.now());
    safeSet(STORAGE_COOKIE, cookie);
    safeSet(STORAGE_TIME, time);
    setPanelMessage(panel, `已读取 ${cookie.split(';').length} 个 Cookie，时间：${nowText()}。`);
    notify('汽水 Cookie 已读取');
    return cookie;
  }

  async function exportAndOpenPlugin(panel) {
    const cookie = await exportQishuiCookie(panel);
    if (!cookie) return;
    window.open(pluginURL(), '_blank', 'noopener,noreferrer');
  }

  function isQishuiPage() {
    return QISHUI_HOST_RE.test(location.hostname);
  }

  function isGoMusicPluginPage() {
    return /\/api\/v1\/jsplugin\/go-music-js\//.test(location.pathname);
  }

  function qishuiUI() {
    const panel = createPanel('Go Music JS 汽水导入', '登录汽水音乐后，点击下方按钮读取 Cookie 并导入插件。');
    addButton(panel, '读取并打开插件', true, () => exportAndOpenPlugin(panel));
    addButton(panel, '只读取 Cookie', false, () => exportQishuiCookie(panel));
    addButton(panel, '复制 Cookie', false, async () => {
      const cookie = await exportQishuiCookie(panel);
      if (cookie && setClipboard(cookie)) notify('Cookie 已复制');
    });
    addButton(panel, '设置插件地址', false, setPluginURL);
  }

  function waitForElement(selector, timeoutMs = 15000) {
    return new Promise((resolve) => {
      const found = document.querySelector(selector);
      if (found) {
        resolve(found);
        return;
      }
      const start = Date.now();
      const timer = setInterval(() => {
        const el = document.querySelector(selector);
        if (el) {
          clearInterval(timer);
          resolve(el);
          return;
        }
        if (Date.now() - start > timeoutMs) {
          clearInterval(timer);
          resolve(null);
        }
      }, 300);
    });
  }

  function dispatchInput(el) {
    el.dispatchEvent(new Event('input', { bubbles: true }));
    el.dispatchEvent(new Event('change', { bubbles: true }));
  }

  async function importToGoMusicPlugin(force = false) {
    const cookie = String(safeGet(STORAGE_COOKIE, '') || '').trim();
    const cookieTime = String(safeGet(STORAGE_TIME, '') || '').trim();
    const importedTime = String(safeGet(STORAGE_IMPORTED_TIME, '') || '').trim();
    if (!cookie || (!force && cookieTime && importedTime === cookieTime)) return;

    const panel = createPanel('Go Music JS 汽水导入', '检测到汽水 Cookie，正在等待插件设置页...');
    const settingsBtn = document.getElementById('settingsBtn');
    if (settingsBtn) settingsBtn.click();

    const input = await waitForElement('#cookieFields input[data-source="soda"]');
    if (!input) {
      setPanelMessage(panel, '没有找到汽水 Cookie 输入框。请打开 Go Music JS 设置页后点击“手动导入”。');
      addButton(panel, '手动导入', true, () => importToGoMusicPlugin(true));
      return;
    }

    input.value = cookie;
    dispatchInput(input);
    input.scrollIntoView({ block: 'center', behavior: 'smooth' });

    const saveButton = document.getElementById('saveSettingsBtn');
    if (saveButton) {
      saveButton.click();
      safeSet(STORAGE_IMPORTED_TIME, cookieTime || String(Date.now()));
      setPanelMessage(panel, '汽水 Cookie 已填入并触发保存。请稍后到“我的歌单”检查汽水歌单。');
      notify('汽水 Cookie 已导入 Go Music JS');
    } else {
      setPanelMessage(panel, '汽水 Cookie 已填入，但没有找到保存按钮，请手动点击保存。');
      notify('汽水 Cookie 已填入，请手动保存');
    }
  }

  function pluginUI() {
    const cookie = String(safeGet(STORAGE_COOKIE, '') || '').trim();
    if (!cookie) return;
    importToGoMusicPlugin(false);
  }

  try {
    if (typeof GM_registerMenuCommand === 'function') {
      GM_registerMenuCommand('设置 Go Music JS 插件地址', setPluginURL);
      GM_registerMenuCommand('复制已读取的汽水 Cookie', () => {
        const cookie = String(safeGet(STORAGE_COOKIE, '') || '').trim();
        if (cookie && setClipboard(cookie)) notify('Cookie 已复制');
        else notify('还没有已读取的 Cookie');
      });
      GM_registerMenuCommand('强制导入到当前 Go Music JS 页面', () => importToGoMusicPlugin(true));
    }
  } catch (_) {}

  if (isQishuiPage()) qishuiUI();
  if (isGoMusicPluginPage()) pluginUI();
})();
