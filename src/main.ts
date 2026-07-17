/// <reference types="@songloft/plugin-sdk" />
import { createRouter, parseQuery } from '@songloft/plugin-sdk';
import type { HTTPRequest, HTTPResponse } from '@songloft/plugin-sdk';
import {
  Registry,
  KgSearcher,
  KwSearcher,
  TxSearcher,
  WySearcher,
  MgSearcher,
  KgSongListProvider,
  KwSongListProvider,
  TxSongListProvider,
  WySongListProvider,
  MgSongListProvider,
  KgLeaderboardProvider,
  KwLeaderboardProvider,
  TxLeaderboardProvider,
  WyLeaderboardProvider,
  MgLeaderboardProvider,
  KgLyricFetcher,
  KwLyricFetcher,
  TxLyricFetcher,
  WyLyricFetcher,
  MgLyricFetcher,
} from '@songloft/musicsdk/dist/index.js';

const router = createRouter();

const PLUGIN_VERSION = '0.1.4';
const ENTRY_PATH = 'go-music-js';

declare const __go_buffer_from: (value: string, encoding: string) => string;
declare const __go_buffer_to_string: (value: string, encoding: string) => string;

const HUIBQ_API_URL = 'https://lxmusicapi.onrender.com';
const HUIBQ_API_KEY = 'share-v3';
const QISHUI_API_HTTPS = 'https://api.qishui.com/luna/pc';
const QISHUI_API_HTTP = 'http://api.qishui.com/luna/pc';
const QISHUI_PROXY_API = 'https://proxy.qishui.vsaa.cn/qishui/proxy';

const registry = new Registry();
let registryReady = false;
const leaderboardCoverCache = new Map<string, string>();
const searchResultCache = new Map<string, { expiresAt: number; value: { songs: GoMusicSong[]; total: number } }>();
const lyricCache = new Map<string, { expiresAt: number; value: Record<string, string> }>();
const importCoverCache = new Map<string, { expiresAt: number; value: string }>();
const SEARCH_CACHE_TTL_MS = 5 * 60 * 1000;
const LYRIC_CACHE_TTL_MS = 30 * 60 * 1000;
const COVER_CACHE_TTL_MS = 30 * 60 * 1000;
const CACHE_MAX_ENTRIES = 300;

const SOURCE_META = [
  { id: 'netease', name: '\u7f51\u6613\u4e91\u97f3\u4e50', shortName: '\u7f51\u6613\u4e91', stable: true, cookie: true, searchSupported: true, playlistSupported: true, albumSupported: true, categorySupported: true, userPlaylistSupported: true, recommendSupported: true, qrLoginSupported: true },
  { id: 'qq', name: 'QQ\u97f3\u4e50', shortName: 'QQ', stable: true, cookie: true, searchSupported: true, playlistSupported: true, albumSupported: true, categorySupported: true, userPlaylistSupported: true, recommendSupported: true, qrLoginSupported: true },
  { id: 'kugou', name: '\u9177\u72d7\u97f3\u4e50', shortName: '\u9177\u72d7', stable: true, cookie: true, searchSupported: true, playlistSupported: true, albumSupported: true, categorySupported: true, userPlaylistSupported: true, recommendSupported: true, qrLoginSupported: true },
  { id: 'kuwo', name: '\u9177\u6211\u97f3\u4e50', shortName: '\u9177\u6211', stable: true, cookie: false, searchSupported: true, playlistSupported: true, albumSupported: true, categorySupported: true, userPlaylistSupported: false, recommendSupported: true, qrLoginSupported: false },
  { id: 'migu', name: '\u54aa\u5495\u97f3\u4e50', shortName: '\u54aa\u5495', stable: true, cookie: false, searchSupported: true, playlistSupported: true, albumSupported: true, categorySupported: true, userPlaylistSupported: false, recommendSupported: false, qrLoginSupported: false },
  { id: 'fivesing', name: '5sing', shortName: '5sing', stable: false, cookie: false, searchSupported: true, playlistSupported: true, albumSupported: false, categorySupported: false, userPlaylistSupported: false, recommendSupported: false, qrLoginSupported: false },
  { id: 'jamendo', name: 'Jamendo (CC)', shortName: 'Jamendo', stable: false, cookie: false, searchSupported: true, playlistSupported: true, albumSupported: true, categorySupported: false, userPlaylistSupported: false, recommendSupported: false, qrLoginSupported: false },
  { id: 'joox', name: 'JOOX', shortName: 'JOOX', stable: false, cookie: false, searchSupported: true, playlistSupported: true, albumSupported: true, categorySupported: true, userPlaylistSupported: false, recommendSupported: false, qrLoginSupported: false },
  { id: 'qianqian', name: '\u5343\u5343\u97f3\u4e50', shortName: '\u5343\u5343', stable: true, cookie: false, searchSupported: true, playlistSupported: true, albumSupported: true, categorySupported: true, userPlaylistSupported: false, recommendSupported: false, qrLoginSupported: false },
  { id: 'soda', name: '\u6c7d\u6c34\u97f3\u4e50', shortName: '\u6c7d\u6c34', stable: true, cookie: true, searchSupported: true, playlistSupported: true, albumSupported: true, categorySupported: false, userPlaylistSupported: true, recommendSupported: false, qrLoginSupported: false },
  { id: 'bilibili', name: 'Bilibili', shortName: 'B\u7ad9', stable: false, cookie: true, searchSupported: true, playlistSupported: true, albumSupported: false, categorySupported: false, userPlaylistSupported: false, recommendSupported: false, qrLoginSupported: true },
  { id: 'apple', name: 'Apple Music', shortName: 'Apple', stable: true, cookie: false, searchSupported: true, playlistSupported: true, albumSupported: true, categorySupported: true, userPlaylistSupported: false, recommendSupported: false, qrLoginSupported: false },
  { id: 'local', name: '\u672c\u5730\u97f3\u4e50', shortName: '\u672c\u5730', stable: true, cookie: false, searchSupported: false, playlistSupported: true, albumSupported: false, categorySupported: false, userPlaylistSupported: false, recommendSupported: false, qrLoginSupported: false },
];
const SOURCE_ID_ALIASES: Record<string, string> = {
  soda: 'soda',
  netease: 'wy',
  qq: 'tx',
  kugou: 'kg',
  kuwo: 'kw',
  migu: 'mg',
};

const SOURCE_ID_PUBLIC: Record<string, string> = {
  soda: 'soda',
  wy: 'netease',
  tx: 'qq',
  kg: 'kugou',
  kw: 'kuwo',
  mg: 'migu',
};

function normalizeSourceId(source: string): string {
  const key = String(source || '').trim().toLowerCase();
  return SOURCE_ID_ALIASES[key] || key;
}

function publicSourceId(source: string): string {
  const key = String(source || '').trim().toLowerCase();
  return SOURCE_ID_PUBLIC[key] || key;
}

const STORAGE_KEYS = {
  webSettings: 'go_music_js_web_settings',
  cookies: 'go_music_js_cookies',
};

const QR_LOGIN_COOKIE_SOURCE: Record<string, string> = {
  netease: 'netease',
  qq: 'qq',
  qq_wx: 'qq',
  kugou: 'kugou',
};

type QRLoginSession = {
  source: string;
  cookies: Record<string, string>;
  createdAt: number;
};

const qrLoginSessions = new Map<string, QRLoginSession>();

const DEFAULT_WEB_SETTINGS = {
  embedDownload: true,
  downloadToLocal: true,
  downloadDir: 'data/downloads',
  downloadFilenameTemplate: '{name} - {artist}',
  disableFloatingLyrics: false,
  webPageSize: 30,
  cliPageSize: 20,
  downloadConcurrency: 3,
  autoCheckUpdate: false,
  updateRepoUrl: '',
  githubProxyEnabled: false,
  githubProxyUrl: 'https://edgeone.gh-proxy.com',
  vgChangeCover: false,
  vgChangeAudio: false,
  vgChangeLyric: false,
  vgExportVideo: false,
  api_base: '',
  service_base: '',
  quality: 'auto',
  selected_sources: ['kuwo', 'netease', 'qq', 'kugou', 'migu', 'soda', 'bilibili', 'joox', 'apple', 'qianqian', 'fivesing', 'jamendo'],
  auto_fallback: true,
};

type GoMusicSong = {
  id: string;
  name: string;
  artist: string;
  album: string;
  album_id?: string;
  duration?: number;
  size?: number;
  bitrate?: number;
  source: string;
  url?: string;
  ext?: string;
  cover?: string;
  link?: string;
  extra?: Record<string, string>;
  is_invalid?: boolean;
  is_vip?: boolean;
};

type GoMusicPlaylist = {
  id: string;
  source: string;
  name: string;
  creator: string;
  cover: string;
  description: string;
  track_count: number;
  link: string;
  detail_url: string;
  content_type: 'playlist' | 'album';
};

type SourceData = {
  provider?: string;
  source: string;
  id: string;
  name: string;
  artist: string;
  album: string;
  album_id?: string;
  cover?: string;
  duration?: number;
  size?: number;
  bitrate?: number;
  ext?: string;
  link?: string;
  extra?: Record<string, string> | string | undefined;
};

type ImportSongsRequest = {
  songs: GoMusicSong[];
  playlist_id?: number;
  new_playlist_name?: string;
};

type QishuiRawSong = {
  id?: string | number;
  vid?: string | number;
  name?: string;
  artists?: string;
  albumName?: string;
  duration?: number | string;
  pic?: string;
  cover?: string;
  _raw?: Record<string, unknown>;
};

function parseBody(req: HTTPRequest): any {
  if (!req.body) return {};
  try {
    const text = typeof req.body === 'string'
      ? req.body
      : new TextDecoder().decode(req.body as Uint8Array);
    return text ? JSON.parse(text) : {};
  } catch {
    return {};
  }
}

function jsonResponse(data: unknown, statusCode = 200): HTTPResponse {
  const body = JSON.stringify(data).replace(/[\u007f-\uffff]/g, (char) => {
    return `\\u${char.charCodeAt(0).toString(16).padStart(4, '0')}`;
  });
  return {
    statusCode,
    headers: { 'Content-Type': 'application/json; charset=utf-8' },
    body,
  };
}

function textResponse(body: string, contentType: string): HTTPResponse {
  return { statusCode: 200, headers: { 'Content-Type': contentType }, body };
}

function errorResponse(statusCode: number, message: string): HTTPResponse {
  return jsonResponse({ code: statusCode, msg: message, data: null }, statusCode);
}

function apiErrorPayload(statusCode: number, message: string): HTTPResponse {
  return jsonResponse({ code: statusCode, msg: message, data: null }, 200);
}

function successResponse(data: unknown): HTTPResponse {
  return jsonResponse({ code: 0, msg: 'success', data }, 200);
}

function asString(value: unknown): string {
  if (value === undefined || value === null) return '';
  return String(value);
}

function asNumber(value: unknown): number {
  const n = Number(value || 0);
  return Number.isFinite(n) ? n : 0;
}

function cloneSong(song: GoMusicSong): GoMusicSong {
  return { ...song, extra: song.extra ? { ...song.extra } : undefined };
}

function cloneSearchResult(value: { songs: GoMusicSong[]; total: number }): { songs: GoMusicSong[]; total: number } {
  return { total: value.total, songs: value.songs.map(cloneSong) };
}

function getTimedCache<T>(cache: Map<string, { expiresAt: number; value: T }>, key: string): T | undefined {
  const entry = cache.get(key);
  if (!entry) return undefined;
  if (Date.now() > entry.expiresAt) {
    cache.delete(key);
    return undefined;
  }
  return entry.value;
}

function setTimedCache<T>(cache: Map<string, { expiresAt: number; value: T }>, key: string, value: T, ttlMs: number): void {
  if (cache.size >= CACHE_MAX_ENTRIES) {
    const firstKey = cache.keys().next().value;
    if (firstKey) cache.delete(firstKey);
  }
  cache.set(key, { value, expiresAt: Date.now() + ttlMs });
}

function parseExtra(raw: unknown): Record<string, string> | undefined {
  if (!raw) return undefined;
  if (typeof raw === 'object' && !Array.isArray(raw)) {
    const result: Record<string, string> = {};
    for (const [key, value] of Object.entries(raw as Record<string, unknown>)) {
      if (value !== undefined && value !== null && value !== '') result[key] = String(value);
    }
    return Object.keys(result).length ? result : undefined;
  }
  try {
    const parsed = JSON.parse(String(raw));
    return parseExtra(parsed);
  } catch {
    return undefined;
  }
}

function splitQueryParts(query: string): Array<[string, string]> {
  const raw = String(query || '').replace(/^\?/, '');
  if (!raw) return [];
  const parts: Array<[string, string]> = [];
  for (const segment of raw.split('&')) {
    if (!segment) continue;
    const eq = segment.indexOf('=');
    const rawKey = eq >= 0 ? segment.slice(0, eq) : segment;
    const rawValue = eq >= 0 ? segment.slice(eq + 1) : '';
    const key = decodeURIComponent(rawKey.replace(/\+/g, ' '));
    const value = decodeURIComponent(rawValue.replace(/\+/g, ' '));
    parts.push([key, value]);
  }
  return parts;
}

function queryValue(query: string, key: string): string {
  for (const [itemKey, value] of splitQueryParts(query)) {
    if (itemKey === key) return value;
  }
  return '';
}

function getQueryValues(query: string, key: string): string[] {
  const rawValues: string[] = [];
  for (const [itemKey, value] of splitQueryParts(query)) {
    if (itemKey !== key) continue;
    for (const part of String(value).split(',')) {
      const trimmed = part.trim();
      if (trimmed) rawValues.push(trimmed);
    }
  }
  if (rawValues.length > 0) return rawValues;

  const parsed = parseQuery(String(query || ''));
  const value = parsed[key];
  if (Array.isArray(value)) return value.map(String).filter(Boolean);
  if (typeof value === 'string' && value.trim()) return value.split(',').map((item) => item.trim()).filter(Boolean);
  return [];
}

async function getSetting<T>(key: string, fallback: T): Promise<T> {
  try {
    const value = await songloft.storage.get(key);
    if (value === undefined || value === null || value === '') return fallback;
    return value as T;
  } catch {
    return fallback;
  }
}

async function saveSetting<T>(key: string, value: T): Promise<void> {
  await songloft.storage.set(key, value);
}

async function getWebSettings(): Promise<Record<string, any>> {
  const stored = await getSetting<Record<string, any>>(STORAGE_KEYS.webSettings, {});
  return { ...DEFAULT_WEB_SETTINGS, ...stored };
}

async function saveWebSettings(settings: Record<string, any>): Promise<Record<string, any>> {
  const merged = { ...DEFAULT_WEB_SETTINGS, ...settings };
  await saveSetting(STORAGE_KEYS.webSettings, merged);
  return merged;
}

async function getSelectedSources(): Promise<string[]> {
  const settings = await getWebSettings();
  const raw = Array.isArray(settings.selected_sources) ? settings.selected_sources : DEFAULT_WEB_SETTINGS.selected_sources;
  return Array.from(new Set(raw.map(String).filter(Boolean)));
}

async function getCookies(): Promise<Record<string, string>> {
  return await getSetting<Record<string, string>>(STORAGE_KEYS.cookies, {});
}

async function saveCookies(cookies: Record<string, string>): Promise<Record<string, string>> {
  const clean: Record<string, string> = {};
  for (const [key, value] of Object.entries(cookies || {})) {
    const trimmed = String(value || '').trim();
    if (trimmed) clean[key] = trimmed;
  }
  await saveSetting(STORAGE_KEYS.cookies, clean);
  return clean;
}

function cookieForSource(cookies: Record<string, string>, source: string): string {
  const normalized = normalizeSourceId(source);
  const publicId = publicSourceId(normalized);
  return String(cookies[publicId] || cookies[normalized] || cookies[source] || '').trim();
}

function ensureRegistry(): void {
  if (registryReady) return;
  registry.register(new KgSearcher());
  registry.register(new KwSearcher());
  registry.register(new TxSearcher());
  registry.register(new WySearcher());
  registry.register(new MgSearcher());

  registry.registerSongListProvider(new KgSongListProvider());
  registry.registerSongListProvider(new KwSongListProvider());
  registry.registerSongListProvider(new TxSongListProvider());
  registry.registerSongListProvider(new WySongListProvider());
  registry.registerSongListProvider(new MgSongListProvider());

  registry.registerLeaderboardProvider(new KgLeaderboardProvider());
  registry.registerLeaderboardProvider(new KwLeaderboardProvider());
  registry.registerLeaderboardProvider(new TxLeaderboardProvider());
  registry.registerLeaderboardProvider(new WyLeaderboardProvider());
  registry.registerLeaderboardProvider(new MgLeaderboardProvider());

  registry.registerLyricFetcher(new KgLyricFetcher());
  registry.registerLyricFetcher(new KwLyricFetcher());
  registry.registerLyricFetcher(new TxLyricFetcher());
  registry.registerLyricFetcher(new WyLyricFetcher());
  registry.registerLyricFetcher(new MgLyricFetcher());

  registryReady = true;
}

async function fetchWithTimeout(url: string, init: RequestInit = {}, timeoutMs = 15000): Promise<Response> {
  const AbortCtor = (globalThis as any).AbortController;
  if (typeof AbortCtor === 'function') {
    const controller = new AbortCtor();
    const timer = setTimeout(() => controller.abort(), timeoutMs);
    try {
      return await fetch(url, { ...init, signal: controller.signal });
    } finally {
      clearTimeout(timer);
    }
  }

  let timer: ReturnType<typeof setTimeout> | undefined;
  try {
    return await Promise.race([
      fetch(url, init),
      new Promise<Response>((_, reject) => {
        timer = setTimeout(() => reject(new Error(`request timeout after ${timeoutMs}ms`)), timeoutMs);
      }),
    ]);
  } finally {
    if (timer) clearTimeout(timer);
  }
}

async function httpJson(url: string, init: RequestInit = {}, timeoutMs = 15000): Promise<any> {
  const response = await fetchWithTimeout(url, init, timeoutMs);
  const text = await response.text();
  if (!text) return { status: response.status, body: null };
  try {
    return { status: response.status, body: JSON.parse(text) };
  } catch {
    return { status: response.status, body: text };
  }
}

async function responseJsonBody(response: Response): Promise<any> {
  const text = await response.text();
  if (!text) return {};
  try {
    return JSON.parse(text);
  } catch {
    return {};
  }
}

async function responseBytes(response: Response): Promise<Uint8Array> {
  const anyResponse = response as any;
  if (typeof anyResponse.arrayBuffer === 'function') {
    return new Uint8Array(await anyResponse.arrayBuffer());
  }
  if (typeof anyResponse.bytes === 'function') {
    return new Uint8Array(await anyResponse.bytes());
  }
  const text = await response.text();
  const bytes = new Uint8Array(text.length);
  for (let i = 0; i < text.length; i++) bytes[i] = text.charCodeAt(i) & 0xff;
  return bytes;
}

async function httpGetWithFallback(url: string, params: Record<string, unknown> = {}, timeoutMs = 15000): Promise<any> {
  const query = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) {
    if (value === undefined || value === null || value === '') continue;
    query.set(key, String(value));
  }
  const sep = url.includes('?') ? '&' : '?';
  const urls = [url + (query.toString() ? sep + query.toString() : '')];
  if (url.startsWith('https://')) {
    urls.push(url.replace(/^https:\/\//, 'http://') + (query.toString() ? sep + query.toString() : ''));
  }
  let lastError: Error | null = null;
  for (const candidate of urls) {
    try {
      const result = await httpJson(candidate, { method: 'GET' }, timeoutMs);
      if (result.status >= 400) throw new Error(`HTTP ${result.status}`);
      return result.body;
    } catch (error: any) {
      lastError = error instanceof Error ? error : new Error(String(error));
    }
  }
  throw lastError || new Error('request failed');
}

function qishuiNormalizeQuality(quality: string): string {
  const q = String(quality || '128k').toLowerCase();
  if (q === '24bit' || q === 'flac24bit') return '24bit';
  if (q === 'flac') return 'flac';
  if (q === '320k') return '320k';
  if (q === '192k') return '192k';
  return '128k';
}

function qishuiSongId(songInfo: Record<string, unknown>): string {
  const extra = parseExtra(songInfo.extra) || {};
  return asString(
    extra.track_id ||
    extra.trackId ||
    extra.id ||
    songInfo.id ||
    songInfo.songmid ||
    songInfo.musicId ||
    songInfo.hash ||
    songInfo.copyrightId ||
    songInfo.vid ||
    ''
  );
}

function getFirstData(response: any): any {
  const data = response?.data;
  if (Array.isArray(data)) return data[0] || null;
  if (data && typeof data === 'object' && data[0]) return data[0];
  return null;
}

function normalizeQishuiSong(raw: QishuiRawSong): GoMusicSong {
  const id = asString(raw?.id || raw?.vid || '');
  return {
    id,
    name: raw?.name ? String(raw.name) : '閺堫亞鐓″灞炬锤',
    artist: raw?.artists ? String(raw.artists) : '閺堫亞鐓￠懝杞版眽',
    album: raw?.albumName ? String(raw.albumName) : '',
    duration: asNumber(raw?.duration),
    cover: raw?.pic ? String(raw.pic) : raw?.cover ? String(raw.cover) : '',
    source: 'soda',
    extra: id ? { id } : {},
  };
}

async function qishuiSearch(keyword: string, page = 1, pageSize = 30): Promise<{ list: GoMusicSong[]; total: number; page: number; pageSize: number }> {
  if (!keyword) return { list: [], total: 0, page, pageSize };
  const res = await httpGetWithFallback(QISHUI_API_HTTPS, {
    act: 'search',
    keywords: keyword,
    page,
    pagesize: pageSize,
    type: 'music',
  }, 15000);
  const list = Array.isArray(res?.data?.lists) ? res.data.lists : [];
  const total = res?.data?.total ? Number(res.data.total) : list.length;
  return {
    list: list.map((item: QishuiRawSong) => normalizeQishuiSong(item)),
    total,
    page,
    pageSize,
  };
}

async function qishuiGetUrl(songInfo: Record<string, unknown>, quality: string): Promise<string> {
  const songId = qishuiSongId(songInfo);
  if (!songId) throw new Error('缺少歌曲 ID');
  const res = await httpGetWithFallback(QISHUI_API_HTTPS, {
    act: 'song',
    id: songId,
    quality: qishuiNormalizeQuality(quality),
  }, 20000);
  const data = getFirstData(res);
  if (!data?.url) throw new Error('汽水播放地址为空');
  if (data.ekey) {
    const proxyRes = await httpJson(QISHUI_PROXY_API, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        url: data.url,
        key: data.ekey,
        filename: data.filename || 'KMusic',
        ext: data.fileExtension ? String(data.fileExtension) : 'aac',
      }),
    }, 60000);
    if (Number(proxyRes?.body?.code) === 200 && proxyRes?.body?.url) return String(proxyRes.body.url);
    throw new Error('source_data is required');
  }
  return String(data.url);
}

async function qishuiGetLyric(songInfo: Record<string, unknown>): Promise<string> {
  const songId = qishuiSongId(songInfo);
  if (!songId) return '';
  const res = await httpGetWithFallback(QISHUI_API_HTTPS, {
    act: 'song',
    id: songId,
  }, 15000);
  const data = getFirstData(res);
  return data?.lyric ? String(data.lyric) : '';
}

function buildQueryUrl(path: string, query: Record<string, unknown> = {}): string {
  const params = new URLSearchParams();
  for (const [key, value] of Object.entries(query)) {
    if (value === undefined || value === null || value === '') continue;
    if (Array.isArray(value)) {
      for (const item of value) {
        if (item !== undefined && item !== null && item !== '') params.append(key, String(item));
      }
      continue;
    }
    params.set(key, String(value));
  }
  const qs = params.toString();
  return qs ? `${path}?${qs}` : path;
}

function bitrateFromQuality(value: unknown): number {
  const text = String(value || '').toLowerCase();
  const match = text.match(/(\d{2,4})\s*k/);
  if (match) return asNumber(match[1]);
  if (text.includes('lossless') || text.includes('flac') || text.includes('sq')) return 1000;
  if (text.includes('hq') || text.includes('high')) return 320;
  return 0;
}

function normalizeSongBitrate(item: Record<string, unknown>): number {
  const direct = asNumber(item.bitrate || item.bitRate || item.br || item.kbps || item.rate || 0);
  if (direct > 0) return direct > 1000 ? Math.round(direct / 1000) : direct;
  return bitrateFromQuality(item.quality || item.Quality || item.format || item.Format) || 320;
}

function normalizeSongSize(item: Record<string, unknown>, duration: number, bitrate: number): number {
  const direct = asNumber(item.size || item.fileSize || item.filesize || item.FileSize || item.file_size || 0);
  if (direct > 0) return direct;
  return duration > 0 && bitrate > 0 ? Math.round(duration * bitrate * 1000 / 8) : 0;
}

const SONG_ID_KEYS = ['musicId', 'MusicID', 'songmid', 'Songmid', 'hash', 'Hash', 'copyrightId', 'CopyrightId', 'id', 'ID'];
const SONG_NAME_KEYS = ['name', 'Name', 'title', 'Title', 'songName', 'songname', 'song_name'];
const SONG_ARTIST_KEYS = ['singer', 'Singer', 'artist', 'Artist', 'author', 'Author', 'artists', 'artistName', 'singername'];
const SONG_ALBUM_KEYS = ['album', 'Album', 'albumName', 'album_name', 'albumname'];
const SONG_ALBUM_ID_KEYS = ['albumId', 'AlbumID', 'album_id', 'albumMid', 'AlbumMid'];
const PLAYLIST_ID_KEYS = ['id', 'ID', 'dissid', 'dissID', 'specialid', 'playlist_id', 'playlistId', 'listid', 'listId', 'rid'];
const PLAYLIST_NAME_KEYS = ['name', 'Name', 'title', 'Title', 'diss_name', 'dissname', 'specialname', 'public_title', 'listname'];
const CREATOR_KEYS = ['creator', 'author', 'Author', 'nickname', 'username', 'public_name', 'owner', 'userName', 'uname'];
const COVER_KEYS = [
  'img', 'Img', 'pic', 'Pic', 'cover', 'Cover', 'cover_url', 'coverUrl', 'coverImgUrl',
  'artwork', 'logo', 'diss_cover', 'imgurl', 'albumPic', 'album_pic', 'albumCover',
  'album_cover', 'picUrl', 'pic120', 'pic300', 'web_albumpic', 'web_albumpic_short',
  'prob_albumpic', 'hts_MVPIC',
];
const LYRIC_KEYS = [
  'lyric', 'lyrics', 'lrc', 'raw_lrc', 'rawLrc', 'rawLyric', 'lineLyric',
  'synced_lyrics', 'unsynced_lyrics', 'SYNCEDLYRICS', 'UNSYNCEDLYRICS', 'LYRICS',
];

function pickText(item: Record<string, unknown> | undefined | null, keys: string[]): string {
  if (!item) return '';
  for (const key of keys) {
    const value = item[key];
    const text = asString(Array.isArray(value) ? value.join(' / ') : value).trim();
    if (text) return text;
  }
  return '';
}

function normalizeCoverUrl(source: string, raw: unknown): string {
  const text = asString(raw).trim();
  if (!text) return '';
  if (text.startsWith('//')) return `https:${text}`;
  if (/^https?:\/\//i.test(text) || text.startsWith('data:')) return text;
  if (publicSourceId(source) === 'kuwo') {
    if (text.startsWith('/')) return `https://img4.kuwo.cn/star/albumcover/500${text}`;
    if (text.startsWith('albumcover/')) return `https://img4.kuwo.cn/star/${text}`;
  }
  return text;
}

function pickCover(item: Record<string, unknown> | undefined | null, source = ''): string {
  return normalizeCoverUrl(source, pickText(item, COVER_KEYS));
}

function pickSongId(item: Record<string, unknown>): string {
  return pickText(item, SONG_ID_KEYS);
}

function pickSongName(item: Record<string, unknown>): string {
  return pickText(item, SONG_NAME_KEYS);
}

function pickArtist(item: Record<string, unknown>): string {
  return pickText(item, SONG_ARTIST_KEYS);
}

function pickAlbum(item: Record<string, unknown>): string {
  return pickText(item, SONG_ALBUM_KEYS);
}

function pickAlbumId(item: Record<string, unknown>): string {
  return pickText(item, SONG_ALBUM_ID_KEYS);
}

function pickPlaylistId(item: Record<string, unknown>): string {
  return pickText(item, PLAYLIST_ID_KEYS);
}

function pickPlaylistName(item: Record<string, unknown>): string {
  return pickText(item, PLAYLIST_NAME_KEYS);
}

function pickCreator(item: Record<string, unknown>): string {
  return pickText(item, CREATOR_KEYS);
}

function extractEmbeddedLyricFromAny(...values: unknown[]): string {
  for (const value of values) {
    if (!value) continue;
    const extra = parseExtra((value as any)?.extra) || {};
    const direct = typeof value === 'object' && !Array.isArray(value)
      ? pickText(value as Record<string, unknown>, LYRIC_KEYS)
      : asString(value);
    const embedded = firstText(direct, pickText(extra, LYRIC_KEYS));
    if (embedded) return embedded;
  }
  return '';
}

function normalizeSearchSong(item: Record<string, unknown>, source: string): GoMusicSong {
  const id = pickSongId(item);
  const extra: Record<string, string> = {};
  for (const key of ['songmid', 'Songmid', 'hash', 'Hash', 'strMediaMid', 'StrMediaMid', 'albumMid', 'AlbumMid', 'albumId', 'AlbumID', 'copyrightId', 'CopyrightId']) {
    if (item[key] !== undefined && item[key] !== null && item[key] !== '') {
      const normalizedKey = key.charAt(0).toLowerCase() + key.slice(1);
      extra[normalizedKey] = String(item[key]);
    }
  }
  const duration = asNumber(item.duration || item.Duration || 0);
  const bitrate = normalizeSongBitrate(item);
  return {
    id: id || extra.songmid || extra.hash || extra.musicId || `${source}-song`,
    name: pickSongName(item),
    artist: pickArtist(item),
    album: pickAlbum(item),
    album_id: firstText(pickAlbumId(item), extra.albumId),
    duration,
    size: normalizeSongSize(item, duration, bitrate),
    bitrate,
    source,
    cover: pickCover(item, source),
    extra: Object.keys(extra).length ? extra : undefined,
  };
}

function normalizeLeaderboardSong(item: Record<string, unknown>, source: string): GoMusicSong {
  const duration = asNumber(item.duration || item.Duration || 0);
  const bitrate = normalizeSongBitrate(item);
  return {
    id: pickSongId(item) || `${source}-board`,
    name: pickSongName(item),
    artist: pickArtist(item),
    album: pickAlbum(item),
    album_id: pickAlbumId(item),
    duration,
    size: normalizeSongSize(item, duration, bitrate),
    bitrate,
    source,
    cover: pickCover(item, source),
    extra: {
      ...(asString(item.songmid || item.Songmid || '') ? { songmid: asString(item.songmid || item.Songmid || '') } : {}),
      ...(asString(item.strMediaMid || item.StrMediaMid || '') ? { strMediaMid: asString(item.strMediaMid || item.StrMediaMid || '') } : {}),
      ...(asString(item.albumMid || item.AlbumMid || '') ? { albumMid: asString(item.albumMid || item.AlbumMid || '') } : {}),
    },
  };
}

function normalizeLeaderboardBoard(item: Record<string, unknown>, source: string): GoMusicPlaylist | null {
  const id = asString(item.id || item.boardId || item.rankId || item.topId || item.source);
  const name = asString(item.name || item.label || item.title || item.desc || id);
  if (!id || !name) return null;
  return {
    id,
    source,
    name,
    creator: source,
    cover: pickCover(item, source),
    description: asString(item.desc || item.description || ''),
    track_count: asNumber(item.total || item.count || 0),
    link: '',
    detail_url: buildQueryUrl('/leaderboard', { id, source, type: 'leaderboard' }),
    content_type: 'leaderboard',
  };
}

async function hydrateLeaderboardCover(playlist: GoMusicPlaylist): Promise<GoMusicPlaylist> {
  if (playlist.cover) return playlist;
  const cacheKey = `${playlist.source}:${playlist.id}`;
  const cached = leaderboardCoverCache.get(cacheKey);
  if (cached) return { ...playlist, cover: cached };
  try {
    const sdkSource = normalizeSourceId(playlist.source);
    const provider = registry.getLeaderboardProvider(sdkSource);
    if (!provider) return playlist;
    const result = await provider.getList(sdkSource, playlist.id, 1);
    const rawSongs = Array.isArray(result?.list) ? result.list : [];
    const songs = rawSongs.map((item: any) => normalizeLeaderboardSong(item as Record<string, unknown>, playlist.source));
    let cover = firstText(songs.find((song: GoMusicSong) => !!song.cover)?.cover);
    const firstSong = songs[0];
    if (!cover && firstSong?.name) {
      const keyword = firstSong.artist ? `${firstSong.name} ${firstSong.artist}` : firstSong.name;
      const searched = await searchOneSource(playlist.source, keyword, 1, 5).catch(() => ({ songs: [] as GoMusicSong[], total: 0 }));
      const candidate = searched.songs
        .map((song) => ({ song, score: scoreLyricCandidate(firstSong as unknown as Record<string, unknown>, song) }))
        .filter((item) => item.song.cover && item.score >= 90)
        .sort((a, b) => b.score - a.score)[0]?.song;
      cover = firstText(candidate?.cover, searched.songs.find((song) => !!song.cover)?.cover);
    }
    if (!cover) return playlist;
    leaderboardCoverCache.set(cacheKey, cover);
    return { ...playlist, cover };
  } catch {
    return playlist;
  }
}

async function hydrateLeaderboardCovers(playlists: GoMusicPlaylist[]): Promise<GoMusicPlaylist[]> {
  const result = playlists.slice();
  const sourceSlots = new Map<string, number>();
  const hydratable = new Set<string>();
  for (const playlist of result) {
    if (playlist.cover) continue;
    const count = sourceSlots.get(playlist.source) || 0;
    if (count >= 12) continue;
    sourceSlots.set(playlist.source, count + 1);
    hydratable.add(`${playlist.source}:${playlist.id}`);
  }
  const concurrency = 4;
  let cursor = 0;
  async function worker() {
    while (cursor < result.length) {
      const index = cursor++;
      const key = `${result[index].source}:${result[index].id}`;
      if (!hydratable.has(key)) continue;
      result[index] = await hydrateLeaderboardCover(result[index]);
    }
  }
  await Promise.all(Array.from({ length: Math.min(concurrency, result.length) }, () => worker()));
  return result;
}

async function fetchKuwoSongCoverById(songId: string): Promise<string> {
  const id = asString(songId);
  if (!id) return '';
  try {
    const url = `http://artistpicserver.kuwo.cn/pic.web?corp=kuwo&type=rid_pic&pictype=500&size=500&rid=${encodeURIComponent(id)}`;
    const response = await fetchWithTimeout(url, { method: 'GET' }, 8000);
    if (!response.ok) return '';
    const body = (await response.text()).trim();
    if (/^https?:\/\//i.test(body)) return body;
  } catch {
    // fall through to metadata endpoint
  }

  try {
    const url = `http://m.kuwo.cn/newh5/singles/songinfoandlrc?musicId=${encodeURIComponent(id)}&httpsStatus=1`;
    const result = await httpJson(url, { method: 'GET' }, 8000);
    return firstText(result?.body?.data?.songinfo?.pic);
  } catch {
    return '';
  }
}

async function hydrateKuwoLeaderboardSongCovers(songs: GoMusicSong[]): Promise<GoMusicSong[]> {
  const result = songs.slice();
  const targets = result
    .map((song, index) => ({ song, index }))
    .filter(({ song }) => publicSourceId(song.source) === 'kuwo' && !song.cover && !!song.name);
  if (!targets.length) return result;

  const worker = async (items: Array<{ song: GoMusicSong; index: number }>) => {
    for (const { song, index } of items) {
      const cacheKey = `song:${song.source}:${song.id}`;
      const cached = leaderboardCoverCache.get(cacheKey);
      if (cached) {
        result[index] = { ...song, cover: cached };
        continue;
      }

      try {
        const directCover = await fetchKuwoSongCoverById(song.id);
        if (directCover) {
          leaderboardCoverCache.set(cacheKey, directCover);
          result[index] = { ...song, cover: directCover };
          continue;
        }

        const keyword = song.artist ? `${song.name} ${song.artist}` : song.name;
        const searched = await searchOneSource('kuwo', keyword, 1, 10);
        const sameId = searched.songs.find((candidate) => String(candidate.id) === String(song.id) && candidate.cover);
        const ranked = searched.songs
          .map((candidate) => ({ candidate, score: scoreLyricCandidate(song as unknown as Record<string, unknown>, candidate) }))
          .filter((item) => item.candidate.cover && item.score >= 80)
          .sort((a, b) => b.score - a.score)[0]?.candidate;
        const cover = firstText(sameId?.cover, ranked?.cover, searched.songs.find((candidate) => !!candidate.cover)?.cover);
        if (!cover) continue;
        leaderboardCoverCache.set(cacheKey, cover);
        result[index] = { ...song, cover };
      } catch {
        // 酷我排行榜接口不返回封面；补图失败时保留原始数据，避免影响播放。
      }
    }
  };

  const workers: Array<Array<{ song: GoMusicSong; index: number }>> = [[], [], [], []];
  targets.forEach((item, index) => workers[index % workers.length].push(item));
  await Promise.all(workers.filter((items) => items.length).map(worker));
  return result;
}

function normalizeSongListItem(item: Record<string, unknown>, source: string, contentType: 'playlist' | 'album'): GoMusicPlaylist | null {
  const id = pickPlaylistId(item);
  const name = pickPlaylistName(item);
  if (!id || !name) return null;
  return {
    id,
    source,
    name,
    creator: pickCreator(item),
    cover: pickCover(item, source),
    description: firstText(item.desc, item.Desc, item.description, item.introduction),
    track_count: asNumber(item.total || item.count || item.track_count || item.trackCount || item.song_count || item.songCount || item.song_cnt || item.songnum || 0),
    link: asString(item.link || item.Link || ''),
    detail_url: buildQueryUrl('/playlist', { id, source, type: contentType }),
    content_type: contentType,
  };
}

function normalizeUserPlaylist(item: Record<string, unknown>, source: string): GoMusicPlaylist | null {
  const id = pickPlaylistId(item);
  const name = pickPlaylistName(item);
  if (!id || !name) return null;
  return {
    id,
    source,
    name,
    creator: pickCreator(item),
    cover: pickCover(item, source),
    description: asString(item.description || item.desc || item.diss_desc || item.introduction || ''),
    track_count: asNumber(item.track_count || item.trackCount || item.song_cnt || item.song_count || item.songnum || item.songcount || item.count_tracks || 0),
    link: asString(item.link || item.url || ''),
    detail_url: buildQueryUrl('/playlist', { id, source, type: 'playlist' }),
    content_type: 'playlist',
  };
}

function parseCookieString(cookie: string): Record<string, string> {
  const result: Record<string, string> = {};
  for (const part of String(cookie || '').split(';')) {
    const trimmed = part.trim();
    if (!trimmed) continue;
    const eq = trimmed.indexOf('=');
    if (eq <= 0) continue;
    result[trimmed.slice(0, eq).trim()] = trimmed.slice(eq + 1).trim();
  }
  return result;
}

function firstText(...values: unknown[]): string {
  for (const value of values) {
    const text = asString(value).trim();
    if (text) return text;
  }
  return '';
}

function normalizeQQUin(cookie: string): string {
  const parsed = parseCookieString(cookie);
  let uin = firstText(parsed.uin, parsed.p_uin, parsed.ptui_loginuin, parsed.luin, parsed.pt2gguin, parsed.superuin, parsed.musicid, parsed.userid, parsed.wxuin);
  uin = uin.replace(/^o0*/, '').replace(/^0+/, '');
  return uin;
}

function buildQQCover(url: string): string {
  const text = String(url || '').trim();
  if (!text) return '';
  if (text.startsWith('//')) return `https:${text}`;
  return text;
}

function userPlaylistError(source: string, error: unknown): Record<string, string> {
  return { source, error: error instanceof Error ? error.message : String(error) };
}

async function fetchNeteaseUserPlaylists(cookie: string, page: number, limit: number): Promise<GoMusicPlaylist[]> {
  if (!cookie.trim()) throw new Error('需要先填写 Cookie');
  const account = await httpJson('https://music.163.com/api/nuser/account/get', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
      Referer: 'https://music.163.com/',
      Cookie: cookie,
    },
    body: 'csrf_token=',
  }, 15000);
  const profile = account?.body?.profile || account?.body?.account || {};
  const userId = firstText(profile.userId, profile.id);
  const nickname = firstText(profile.nickname, profile.userName, userId);
  if (!userId) throw new Error('需要先填写 Cookie');
  const offset = Math.max(0, (page - 1) * limit);
  const res = await httpJson(`https://music.163.com/api/user/playlist/?uid=${encodeURIComponent(userId)}&limit=${limit}&offset=${offset}&includeVideo=true`, {
    method: 'GET',
    headers: {
      Referer: 'https://music.163.com/',
      Cookie: cookie,
    },
  }, 15000);
  const list = Array.isArray(res?.body?.playlist) ? res.body.playlist : [];
  return list.map((item: any) => normalizeUserPlaylist({
    id: item.id,
    name: item.name,
    coverImgUrl: item.coverImgUrl,
    trackCount: item.trackCount,
    description: item.description,
    creator: item.creator?.nickname || nickname,
    link: `https://music.163.com/#/playlist?id=${item.id}`,
  }, 'netease')).filter(Boolean) as GoMusicPlaylist[];
}

async function fetchQQUserPlaylists(cookie: string, page: number, limit: number): Promise<GoMusicPlaylist[]> {
  if (!cookie.trim()) throw new Error('需要先填写 Cookie');
  const uin = normalizeQQUin(cookie);
  if (!uin) throw new Error('QQ音乐 Cookie 缺少 uin');
  let playlists: GoMusicPlaylist[] = [];
  const seen = new Set<string>();
  const add = (playlist: GoMusicPlaylist | null) => {
    if (!playlist || seen.has(playlist.id)) return;
    seen.add(playlist.id);
    playlists.push(playlist);
  };

  const params = new URLSearchParams({
    hostuin: uin,
    sin: String(Math.max(0, (page - 1) * limit)),
    size: String(limit),
    format: 'json',
    inCharset: 'utf8',
    outCharset: 'utf-8',
  });
  const created = await httpJson(`https://c.y.qq.com/rsc/fcgi-bin/fcg_user_created_diss?${params.toString()}`, {
    headers: {
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
      Referer: 'https://y.qq.com/',
      Cookie: cookie,
    },
  }, 15000);
  if (created?.body?.code !== 0) throw new Error(firstText(created?.body?.message, `QQ音乐歌单读取失败: ${created?.body?.code}`));
  const dissList = Array.isArray(created?.body?.data?.disslist) ? created.body.data.disslist : [];
  const list = Array.isArray(created?.body?.data?.list) ? created.body.data.list : [];
  for (const item of dissList) {
    const id = firstText(item.dissid, item.tid, item.dirid ? `profile:dir:${item.dirid}` : '');
    add(normalizeUserPlaylist({
      id,
      name: firstText(item.diss_name, item.title),
      cover: buildQQCover(firstText(item.diss_cover, item.cover)),
      song_count: item.song_count || item.song_num || item.song_cnt,
      creator: uin,
      desc: firstText(item.diss_desc, item.desc),
      link: id.startsWith('profile:dir:') ? 'https://y.qq.com/n/ryqq/profile' : `https://y.qq.com/n/ryqq/playlist/${id}`,
    }, 'qq'));
  }
  for (const item of list) {
    const id = firstText(item.dissid);
    add(normalizeUserPlaylist({
      id,
      name: item.dissname,
      cover: buildQQCover(item.imgurl),
      song_count: item.song_count || item.song_num,
      creator: uin,
      desc: item.introduction,
      link: `https://y.qq.com/n/ryqq/playlist/${id}`,
    }, 'qq'));
  }

  try {
    const favParams = new URLSearchParams({
      loginUin: uin,
      hostUin: uin,
      cid: '205360956',
      userid: uin,
      reqtype: '3',
      sin: String(Math.max(0, (page - 1) * limit)),
      ein: String(Math.max(0, page * limit - 1)),
      format: 'json',
      inCharset: 'utf8',
      outCharset: 'utf-8',
    });
    const fav = await httpJson(`https://c.y.qq.com/fav/fcgi-bin/fcg_get_profile_order_asset.fcg?${favParams.toString()}`, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
        Referer: 'https://y.qq.com/',
        Cookie: cookie,
      },
    }, 15000);
    const cdList = Array.isArray(fav?.body?.data?.cdlist) ? fav.body.data.cdlist : [];
    for (const item of cdList) {
      const id = firstText(item.dissid);
      add(normalizeUserPlaylist({
        id,
        name: item.dissname,
        cover: buildQQCover(item.logo),
        song_count: item.songnum,
        creator: firstText(item.nickname, item.uin, uin),
        link: `https://y.qq.com/n/ryqq/playlist/${id}`,
      }, 'qq'));
    }
  } catch {
    // Ignore optional QQ favorite playlist failures.
  }
  return playlists;
}

async function fetchKugouUserPlaylists(cookie: string, page: number, limit: number): Promise<GoMusicPlaylist[]> {
  if (!cookie.trim()) throw new Error('需要先填写 Cookie');
  const parsed = parseCookieString(cookie);
  const userId = firstText(parsed.userid, parsed.KugooID);
  if (!userId || userId === '0') throw new Error('酷狗音乐 Cookie 缺少 userid');
  if (firstText(parsed.token) && firstText(parsed.KUGOU_API_MID)) {
    return fetchKugouUserPlaylistsGateway(cookie, parsed, userId, page, limit);
  }
  const params = new URLSearchParams({ json: 'true', page: String(page), pagesize: String(limit) });
  const res = await httpJson(`http://m.kugou.com/plist/index/${encodeURIComponent(userId)}?${params.toString()}`, {
    headers: {
      'User-Agent': 'Mozilla/5.0 (iPhone; CPU iPhone OS 13_2_3 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/13.0.3 Mobile/15E148 Safari/604.1',
      Referer: 'http://m.kugou.com',
      Cookie: cookie,
    },
  }, 15000);
  const root = res?.body || {};
  const groups = [
    ...(Array.isArray(root?.data?.info) ? root.data.info : []),
  ].filter((item: any) => {
    const ownerId = firstText(item.list_create_userid, item.userid, item.user_id, item.uid);
    return ownerId && ownerId === userId;
  });
  return normalizeKugouUserPlaylistItems(groups, userId);
}

async function fetchKugouUserPlaylistsGateway(cookie: string, parsed: Record<string, string>, userId: string, page: number, limit: number): Promise<GoMusicPlaylist[]> {
  const clienttime = String(Math.floor(Date.now() / 1000));
  const requestBody = JSON.stringify({
    userid: userId,
    token: parsed.token,
    total_ver: 979,
    type: 2,
    page,
    pagesize: limit,
  });
  const params: Record<string, string> = {
    dfid: firstText(parsed.dfid) || '-',
    mid: firstText(parsed.KUGOU_API_MID) || '-',
    uuid: '-',
    appid: KUGOU_LITE_APP_ID,
    clientver: KUGOU_LITE_VER,
    clienttime,
    token: parsed.token,
    userid: userId,
    plat: '1',
  };
  const ip = randomChinaIP();
  const response = await fetchWithTimeout(kugouAndroidSignedURL('https://gateway.kugou.com/v7/get_all_list', params, requestBody), {
    method: 'POST',
    headers: {
      'User-Agent': 'Android15-1070-11083-46-0-DiscoveryDRADProtocol-wifi',
      'Content-Type': 'application/json',
      'x-router': 'cloudlist.service.kugou.com',
      dfid: params.dfid,
      clienttime,
      mid: params.mid,
      'kg-rc': '1',
      'kg-thash': '5d816a0',
      'kg-rec': '1',
      'kg-rf': 'B9EDA08A64250DEFFBCADDEE00F8F25F',
      Cookie: cookie,
      'X-Forwarded-For': ip,
      'X-Real-IP': ip,
    },
    body: requestBody,
  }, 15000);
  const data = await responseJsonBody(response);
  if (!response.ok) throw new Error(`kugou user playlists HTTP ${response.status}`);
  const groups = [
    ...(Array.isArray(data?.data?.info) ? data.data.info : []),
    ...(Array.isArray(data?.data?.list) ? data.data.list : []),
  ];
  return normalizeKugouUserPlaylistItems(groups, userId);
}

function normalizeKugouUserPlaylistItems(items: any[], userId: string): GoMusicPlaylist[] {
  return items.filter((item: any) => {
    const trackCount = asNumber(item.songcount || item.count || item.song_count || item.track_count || 0);
    return trackCount > 0;
  }).map((item: any) => {
    const id = firstText(item.specialid, item.global_specialid, item.listid ? `cloudlist:${item.listid}` : '');
    return normalizeUserPlaylist({
      id,
      name: firstText(item.specialname, item.name),
      cover: firstText(item.imgurl, item.pic).replace('{size}', '240'),
      songcount: item.songcount || item.count,
      creator: firstText(item.nickname, item.username, item.list_create_username, userId),
      desc: item.intro,
      link: id.startsWith('cloudlist:') ? '' : `https://www.kugou.com/yy/special/single/${id}.html`,
    }, 'kugou');
  }).filter(Boolean) as GoMusicPlaylist[];
}

function sodaPCParams(extra: Record<string, string> = {}): string {
  const now = Date.now();
  const params = new URLSearchParams({
    aid: '386088',
    app_name: 'luna_pc',
    region: 'cn',
    geo_region: 'cn',
    os_region: 'cn',
    sim_region: '',
    device_id: String(now),
    cdid: '',
    iid: String(now + 1),
    version_name: '3.3.0',
    version_code: '30030000',
    channel: 'official',
    build_mode: 'master',
    network_carrier: '',
    ac: 'wifi',
    tz_name: 'Asia/Shanghai',
    resolution: '',
    device_platform: 'windows',
    device_type: 'Windows',
    os_version: 'Windows 11',
    fp: String(now),
    ...extra,
  });
  return params.toString();
}

function sodaImageURL(image: any, suffix = '~c5_300x300.jpg'): string {
  const urls = Array.isArray(image?.urls) ? image.urls : [];
  let cover = firstText(urls[0]);
  const uri = firstText(image?.uri);
  if (cover && uri && !cover.includes(uri)) cover += uri;
  if (cover && suffix && !cover.includes('~')) cover += suffix;
  return cover;
}

async function fetchSodaUserPlaylists(cookie: string, page: number, limit: number): Promise<GoMusicPlaylist[]> {
  if (!cookie.trim()) throw new Error('需要先填写 Cookie');
  const headers = {
    'User-Agent': 'LunaPC/3.3.0(359450208)',
    'x-luna-background-type': 'foreground',
    'x-luna-is-background-req': '0',
    'x-luna-is-local-user': '1',
    Cookie: cookie,
  };
  const me = await httpJson(`https://api.qishui.com/luna/pc/me?${sodaPCParams()}`, { headers }, 15000);
  if (Number(me?.body?.status_code || 0) !== 0) throw new Error(firstText(me?.body?.status_info?.status_msg, '汽水登录失败'));
  const myInfo = me?.body?.my_info || {};
  const userId = firstText(myInfo.id);
  const nickname = firstText(myInfo.nickname, myInfo.public_name, userId);
  if (!userId) throw new Error('需要先填写 Cookie');

  const targetCount = Math.min(Math.max(page * limit, 50), 100);
  const res = await httpJson(`https://api.qishui.com/luna/pc/user/playlist?${sodaPCParams({ user_id: userId, cursor: '', count: String(targetCount) })}`, { headers }, 15000);
  if (Number(res?.body?.status_code || 0) !== 0) throw new Error(firstText(res?.body?.status_info?.status_msg, '汽水歌单读取失败'));
  const list = Array.isArray(res?.body?.playlists) ? res.body.playlists : [];
  const start = Math.max(0, (page - 1) * limit);
  return list.slice(start, start + limit).map((item: any) => {
    const id = firstText(item.id);
    const owner = item.owner || {};
    return normalizeUserPlaylist({
      id,
      name: firstText(item.title, item.public_title, id),
      cover: sodaImageURL(item.url_cover),
      count_tracks: item.count_tracks || item.resource_cnt?.track_cnt,
      creator: firstText(owner.public_name, owner.nickname, nickname, userId),
      desc: item.desc,
      link: `https://www.qishui.com/playlist/${id}`,
    }, 'soda');
  }).filter(Boolean) as GoMusicPlaylist[];
}

function normalizeQishuiTrackSong(track: any, fallbackCover = ''): GoMusicSong | null {
  if (!track || typeof track !== 'object') return null;
  const id = firstText(track.id, track.ID, track.vid, track.VID);
  const name = firstText(track.name, track.title);
  if (!id || !name) return null;
  const artists = Array.isArray(track.artists)
    ? track.artists.map((artist: any) => firstText(artist?.name, artist?.Name)).filter(Boolean).join(' / ')
    : firstText(track.artists, track.artist);
  const album = track.album || {};
  const cover = sodaImageURL(album.url_cover || album.URLCover || track.url_cover || track.cover) || fallbackCover;
  const bitRates = [
    ...(Array.isArray(track.bit_rates) ? track.bit_rates : []),
    ...(Array.isArray(track.preview?.bit_rates) ? track.preview.bit_rates : []),
  ];
  const size = bitRates.reduce((max: number, item: any) => Math.max(max, asNumber(item?.size || 0)), 0);
  const duration = Math.round(asNumber(track.duration || track.preview?.duration || 0) / (asNumber(track.duration || 0) > 1000 ? 1000 : 1));
  const bitrate = duration > 0 && size > 0 ? Math.round(size * 8 / 1000 / duration) : 0;
  return {
    id,
    source: 'soda',
    name,
    artist: artists,
    album: firstText(album.name, album.Name),
    album_id: firstText(album.id, album.ID),
    duration,
    size,
    bitrate,
    cover,
    link: `https://www.qishui.com/track/${id}`,
    extra: {
      id,
      track_id: id,
      ...(firstText(album.id, album.ID) ? { album_id: firstText(album.id, album.ID) } : {}),
    },
  };
}

async function fetchSodaPlaylistDetail(id: string, page: number, limit: number): Promise<{ playlist: GoMusicPlaylist; songs: GoMusicSong[]; total: number }> {
  const cookies = await getCookies();
  const cookie = String(cookies.soda || '').trim();
  const headers: Record<string, string> = {
    'User-Agent': 'LunaPC/3.3.0(359450208)',
    'x-luna-background-type': 'foreground',
    'x-luna-is-background-req': '0',
    'x-luna-is-local-user': '1',
  };
  if (cookie) headers.Cookie = cookie;

  const requestedPageSize = Math.min(Math.max(Math.floor(limit || 100), 1), 100);
  const fetchPageSize = Math.min(Math.max(requestedPageSize, 20), 100);
  let cursor = '';
  const seenCursors = new Set<string>();
  const seenTracks = new Set<string>();
  let playlist: GoMusicPlaylist | null = null;
  const songs: GoMusicSong[] = [];

  for (let requestPage = 0; requestPage < 20 && songs.length < page * requestedPageSize; requestPage++) {
    const res = await httpJson(`https://api.qishui.com/luna/pc/playlist/detail?${sodaPCParams({ playlist_id: id, cursor, count: String(fetchPageSize) })}`, { headers }, 20000);
    const body = res?.body || {};
    if (Number(body?.status_code || 0) !== 0) {
      throw new Error(firstText(body?.status_info?.status_msg, `汽水接口请求失败: HTTP ${res?.status || ''}`));
    }
    if (!playlist) {
      const rawPlaylist = body.playlist || {};
      playlist = normalizeUserPlaylist({
        id: firstText(rawPlaylist.id, id),
        title: firstText(rawPlaylist.title, rawPlaylist.public_title, id),
        url_cover: rawPlaylist.url_cover,
        count_tracks: rawPlaylist.count_tracks,
        owner: rawPlaylist.owner,
        desc: rawPlaylist.desc,
        link: `https://www.qishui.com/playlist/${id}`,
      }, 'soda');
    }
    const mediaResources = Array.isArray(body.media_resources) ? body.media_resources : [];
    for (const item of mediaResources) {
      if (firstText(item?.type) !== 'track') continue;
      const track = item?.entity?.track_wrapper?.track;
      const song = normalizeQishuiTrackSong(track, playlist?.cover || '');
      if (!song || seenTracks.has(song.id)) continue;
      seenTracks.add(song.id);
      songs.push(song);
    }
    const nextCursor = firstText(body.next_cursor);
    if (!nextCursor || nextCursor === cursor || seenCursors.has(nextCursor)) break;
    if (!body.has_more && mediaResources.length < fetchPageSize) break;
    seenCursors.add(nextCursor);
    cursor = nextCursor;
  }

  if (!playlist) {
    playlist = {
      id,
      source: 'soda',
      name: id,
      creator: '',
      cover: '',
      description: '',
      track_count: songs.length,
      link: `https://www.qishui.com/playlist/${id}`,
      detail_url: buildQueryUrl('/playlist', { id, source: 'soda', type: 'playlist' }),
      content_type: 'playlist',
    };
  }

  const start = Math.max(0, (page - 1) * requestedPageSize);
  const pageSongs = songs.slice(start, start + requestedPageSize);
  return { playlist, songs: pageSongs, total: Math.max(asNumber(playlist.track_count || 0), songs.length) };
}

function responseHeader(response: Response, name: string): string {
  const headers = response.headers as any;
  if (!headers) return '';
  const lower = name.toLowerCase();
  if (typeof headers.get === 'function') {
    const value = firstText(headers.get(name), headers.get(lower));
    if (value) return value;
  }
  if (typeof headers.raw === 'function') {
    const raw = headers.raw();
    const value = raw?.[lower] || raw?.[name];
    return Array.isArray(value) ? value.join(',') : firstText(value);
  }
  if (typeof headers.forEach === 'function') {
    let found = '';
    headers.forEach((value: string, key: string) => {
      if (!found && String(key || '').toLowerCase() === lower) found = firstText(value);
    });
    if (found) return found;
  }
  if (typeof headers.entries === 'function') {
    for (const [key, value] of headers.entries()) {
      if (String(key || '').toLowerCase() === lower) return firstText(value);
    }
  }
  if (Array.isArray(headers)) {
    const found = headers.find((item) => Array.isArray(item) && String(item[0] || '').toLowerCase() === lower);
    return found ? firstText(found[1]) : '';
  }
  if (typeof headers === 'object') {
    for (const key of Object.keys(headers)) {
      if (String(key || '').toLowerCase() === lower) return firstText(headers[key]);
    }
    return firstText(headers[lower], headers[name]);
  }
  return '';
}

function responseSetCookieHeaders(response: Response): string[] {
  const headers = response.headers as any;
  if (!headers) return [];
  if (typeof headers.getSetCookie === 'function') return headers.getSetCookie();
  if (typeof headers.raw === 'function') {
    const raw = headers.raw();
    const values = raw?.['set-cookie'] || raw?.['Set-Cookie'];
    if (Array.isArray(values)) return values;
  }
  const collected: string[] = [];
  if (typeof headers.forEach === 'function') {
    headers.forEach((value: string, key: string) => {
      if (String(key || '').toLowerCase() === 'set-cookie' && value) collected.push(String(value));
    });
    if (collected.length) return collected;
  }
  if (typeof headers.entries === 'function') {
    for (const [key, value] of headers.entries()) {
      if (String(key || '').toLowerCase() === 'set-cookie' && value) collected.push(String(value));
    }
    if (collected.length) return collected;
  }
  if (typeof headers === 'object') {
    for (const key of Object.keys(headers)) {
      const value = headers[key];
      if (String(key || '').toLowerCase() === 'set-cookie' && value) {
        if (Array.isArray(value)) collected.push(...value.map(String));
        else collected.push(String(value));
      }
    }
    if (collected.length) return collected;
  }
  const direct = responseHeader(response, 'set-cookie');
  return direct ? direct.split(/,(?=\s*[^;,]+=)/) : [];
}

function splitSetCookieHeader(raw: string): string[] {
  const text = String(raw || '').trim();
  if (!text) return [];
  return text.split(/,(?=\s*[A-Za-z0-9_.$-]+=)/).flatMap((part) => {
    const clean = part.trim();
    if (!clean) return [];
    const marker = clean.match(/(?:^|,\s*)([A-Za-z0-9_.$-]+)=/);
    return marker ? [clean] : [];
  });
}

function responseCookieMap(response: Response): Record<string, string> {
  const result: Record<string, string> = {};
  const rawCookies = responseSetCookieHeaders(response);
  for (const raw of rawCookies) {
    for (const item of splitSetCookieHeader(raw)) {
      const first = String(item || '').split(';')[0] || '';
      const eq = first.indexOf('=');
      if (eq <= 0) continue;
      result[first.slice(0, eq).trim()] = first.slice(eq + 1).trim();
    }
  }
  return result;
}

function cookieMapFromUrl(url: string, allowedNames?: string[]): Record<string, string> {
  const result: Record<string, string> = {};
  const text = String(url || '').trim();
  if (!text) return result;
  const allow = allowedNames?.length ? new Set(allowedNames) : null;
  const query = text.includes('?') ? text.slice(text.indexOf('?') + 1) : text;
  for (const part of query.split('&')) {
    const eq = part.indexOf('=');
    if (eq <= 0) continue;
    const key = decodeURIComponent(part.slice(0, eq).replace(/\+/g, ' '));
    const value = decodeURIComponent(part.slice(eq + 1).replace(/\+/g, ' '));
    if (!key || !value) continue;
    if (allow && !allow.has(key)) continue;
    result[key] = value;
  }
  return result;
}

function cookieDebugInfo(cookies: Record<string, string>, extra: Record<string, string> = {}): Record<string, string> {
  const names = Object.keys(cookies || {}).filter(Boolean).sort();
  return {
    cookie_names: names.join(','),
    cookie_count: String(names.length),
    cookie_length: String(joinCookieMap(cookies || {}).length),
    ...extra,
  };
}

function cookieNamesFromCookieString(cookie: string): string {
  return Object.keys(parseCookieString(cookie)).filter(Boolean).sort().join(',');
}

function joinCookieMap(cookies: Record<string, string>): string {
  return Object.keys(cookies)
    .filter((key) => key && cookies[key])
    .sort()
    .map((key) => `${key}=${cookies[key]}`)
    .join('; ');
}

function qrLoginCookieSource(source: string): string {
  return QR_LOGIN_COOKIE_SOURCE[source] || source;
}

function qrLoginSessionKey(source: string, key: string): string {
  return `${source}:${key}`;
}

function cleanupQRLoginSessions(): void {
  const maxAge = 10 * 60 * 1000;
  const now = Date.now();
  for (const [sessionKey, session] of qrLoginSessions.entries()) {
    if (now - session.createdAt > maxAge) qrLoginSessions.delete(sessionKey);
  }
}

function saveQRLoginSession(source: string, key: string, cookies: Record<string, string>): void {
  cleanupQRLoginSessions();
  qrLoginSessions.set(qrLoginSessionKey(source, key), {
    source,
    cookies: { ...cookies },
    createdAt: Date.now(),
  });
}

function qrLoginSessionCookies(source: string, key: string): Record<string, string> {
  cleanupQRLoginSessions();
  const session = qrLoginSessions.get(qrLoginSessionKey(source, key));
  return session ? { ...session.cookies } : {};
}

function qrLoginCookieString(result: Record<string, unknown>): string {
  const direct = firstText(result.cookie as string);
  if (direct) return direct;
  const cookies = result.cookies;
  if (!cookies || typeof cookies !== 'object' || Array.isArray(cookies)) return '';
  return joinCookieMap(cookies as Record<string, string>);
}

function hasNeteaseLoginCookie(cookie: string): boolean {
  const parsed = parseCookieString(cookie);
  return Boolean(firstText(parsed.MUSIC_U, parsed.MUSIC_A));
}

function hasFullQQLoginCookie(cookie: string): boolean {
  const parsed = normalizeQQMusicCookies(parseCookieString(cookie));
  return Boolean(firstText(parsed.uin) && firstText(parsed.qqmusic_key, parsed.qm_keyst, parsed.p_skey, parsed.skey, parsed.musickey));
}

function hasQQLoginCookie(cookie: string): boolean {
  const parsed = normalizeQQMusicCookies(parseCookieString(cookie));
  return Boolean(firstText(parsed.uin, parsed.pt2gguin, parsed.musicid, parsed.userid, parsed.wxuin));
}

function hasKugouLoginCookie(cookie: string): boolean {
  const parsed = parseCookieString(cookie);
  return Boolean(firstText(parsed.userid, parsed.KugooID) && firstText(parsed.token));
}

function qrLoginCookieStatus(source: string, cookie: string): string {
  const normalized = normalizeSourceId(source);
  const parsed = parseCookieString(cookie);
  if (!String(cookie || '').trim()) return 'empty';
  if (normalized === 'wy') {
    if (firstText(parsed.MUSIC_U, parsed.MUSIC_A, parsed.__csrf)) return 'full';
    if (firstText(parsed.MUSIC_R_T, parsed.MUSIC_A_T, parsed.NMTID)) return 'partial';
  }
  if (normalized === 'tx') {
    if (hasFullQQLoginCookie(cookie)) return 'full';
    if (hasQQLoginCookie(cookie)) return 'partial';
  }
  return 'full';
}

function hasUsableLoginCookie(source: string, cookie: string): boolean {
  const normalized = normalizeSourceId(source);
  const text = String(cookie || '').trim();
  if (!text) return false;
  if (normalized === 'wy') return hasNeteaseLoginCookie(text);
  if (normalized === 'tx') return hasQQLoginCookie(text);
  if (normalized === 'kg') {
    return hasKugouLoginCookie(text);
  }
  return true;
}

function qrLoginHasUsableCookie(source: string, cookie: string): boolean {
  const normalized = normalizeSourceId(source);
  const text = String(cookie || '').trim();
  if (!text) return false;
  if (normalized === 'wy') return hasNeteaseLoginCookie(text);
  if (normalized === 'tx') return hasQQLoginCookie(text);
  if (normalized === 'kg') return hasKugouLoginCookie(text);
  return true;
}

async function persistQRLoginResult(source: string, result: Record<string, unknown>): Promise<Record<string, unknown>> {
  if (String(result.status || '') !== 'success') return result;
  const cookie = qrLoginCookieString(result);
  const extra = result.extra && typeof result.extra === 'object' && !Array.isArray(result.extra)
    ? { ...(result.extra as Record<string, string>) }
    : {};
  if (!cookie || !qrLoginHasUsableCookie(source, cookie)) {
    extra.cookie_saved = 'false';
    extra.cookie_source = qrLoginCookieSource(source);
    extra.cookie_reason = cookie ? 'incomplete_login_cookie' : 'empty_cookie';
    return { ...result, cookie: '', extra };
  }

  const cookieSource = qrLoginCookieSource(source);
  const cookieStatus = qrLoginCookieStatus(source, cookie);
  const stored = await getCookies();
  stored[cookieSource] = cookie;
  await saveCookies(stored);

  extra.cookie_saved = 'true';
  extra.cookie_source = cookieSource;
  extra.cookie_length = String(cookie.length);
  extra.cookie_status = cookieStatus;
  extra.cookie_complete = cookieStatus === 'full' ? 'true' : 'false';

  return { ...result, cookie, extra };
}

function firstNonEmpty(values: Array<string | undefined | null>): string {
  for (const value of values) {
    const clean = String(value || '').trim();
    if (clean) return clean;
  }
  return '';
}

function normalizeQQMusicCookies(cookies: Record<string, string>): Record<string, string> {
  const result: Record<string, string> = { ...cookies };
  if (!result.uin) {
    result.uin = firstNonEmpty([
      result.ptui_loginuin,
      result.luin,
      result.pt2gguin,
      result.superuin,
      result.p_uin,
      result.musicid,
      result.userid,
      result.wxuin,
    ]);
  }
  if (!result.qqmusic_key) {
    result.qqmusic_key = firstNonEmpty([result.p_skey, result.skey, result.musickey, result.qqmusic_key]);
  }
  if (!result.qm_keyst) result.qm_keyst = result.qqmusic_key || '';
  return result;
}

async function fetchQQRedirectCookies(redirectURL: string, cookies: Record<string, string>): Promise<Record<string, string>> {
  const collected: Record<string, string> = { ...cookies };
  let currentURL = redirectURL.trim();
  let referer = 'https://y.qq.com/';

  for (let i = 0; i < 8 && currentURL; i++) {
    const response = await fetchWithTimeout(currentURL, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
        Referer: referer,
        Cookie: joinCookieMap(collected),
      },
      redirect: 'manual',
    } as RequestInit, 15000);
    Object.assign(collected, responseCookieMap(response));

    const location = responseHeader(response, 'location');
    if (!location || response.status < 300 || response.status >= 400) break;
    const nextURL = new URL(location, currentURL);
    referer = currentURL;
    currentURL = nextURL.toString();
  }

  return collected;
}

function arrayBufferBase64(buffer: ArrayBuffer): string {
  const anyGlobal = globalThis as any;
  if (anyGlobal.Buffer) return anyGlobal.Buffer.from(buffer).toString('base64');
  let binary = '';
  const bytes = new Uint8Array(buffer);
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return anyGlobal.btoa ? anyGlobal.btoa(binary) : '';
}

function bytesBase64(bytes: Uint8Array): string {
  const anyGlobal = globalThis as any;
  if (anyGlobal.Buffer) return anyGlobal.Buffer.from(bytes).toString('base64');
  let binary = '';
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return anyGlobal.btoa ? anyGlobal.btoa(binary) : '';
}

function mapNeteaseQRStatus(code: number): string {
  if (code === 803) return 'success';
  if (code === 802) return 'scanned';
  if (code === 801) return 'waiting';
  if (code === 800) return 'expired';
  return 'failed';
}

function hash33(text: string): number {
  let hash = 0;
  for (let i = 0; i < text.length; i++) {
    hash += (hash << 5) + text.charCodeAt(i);
  }
  return hash & 0x7fffffff;
}

function parseQQQRCheck(raw: string): { code: string; message: string; redirectURL: string } {
  const matches = Array.from(String(raw || '').matchAll(/'([^']*)'/g)).map((match) => match[1] || '');
  if (matches.length >= 5) return { code: matches[0] || '', redirectURL: matches[2] || '', message: matches[4] || '' };
  return { code: '999', message: 'QQ扫码响应解析失败', redirectURL: '' };
}

function mapQQQRStatus(code: string): string {
  if (code === '0') return 'success';
  if (code === '66') return 'waiting';
  if (code === '65') return 'expired';
  if (code === '67') return 'scanned';
  return 'failed';
}

function mapQQWXQRStatus(code: string): string {
  if (code === '405') return 'success';
  if (code === '408') return 'waiting';
  if (code === '402') return 'expired';
  if (code === '404') return 'scanned';
  return 'failed';
}

function qqWXQRMessage(code: string, raw: string): string {
  if (code === '405') return '登录成功';
  if (code === '402') return '二维码已过期';
  if (code === '404') return '已扫码，请在微信中确认';
  if (code === '408') return '等待扫码中';
  return firstText(raw, 'QQ 微信扫码状态未知');
}

function parseQQWXQRUUID(raw: string): string {
  const text = String(raw || '');
  const patterns = [
    /connect\/l\/qrconnect\?uuid=([A-Za-z0-9_-]+)/,
    /window\.QRLogin\.uuid\s*=\s*"([^"]+)"/,
    /\/connect\/qrcode\/([A-Za-z0-9_-]+)/,
  ];
  for (const pattern of patterns) {
    const match = text.match(pattern);
    if (match?.[1]) return match[1].trim();
  }
  return '';
}

function parseQQWXQRCheck(raw: string): { code: string; wxCode: string } {
  const text = String(raw || '');
  const code = firstText(text.match(/wx_errcode\s*=\s*'?([0-9]+)'?/)?.[1]);
  const wxCode = firstText(text.match(/wx_code\s*=\s*["']([^"']*)["']/)?.[1]);
  return { code, wxCode };
}

function randomChinaIP(): string {
  const prefixes = [
    [116, 255],
    [116, 228],
    [218, 192],
    [124, 0],
    [14, 132],
    [183, 14],
    [58, 14],
    [113, 116],
    [120, 230],
  ];
  const prefix = prefixes[Math.floor(Math.random() * prefixes.length)] || [116, 255];
  const part = () => String(Math.floor(Math.random() * 254) + 1);
  return `${prefix[0]}.${prefix[1]}.${part()}.${part()}`;
}

function neteaseQRHeaders(extra: Record<string, string> = {}): Record<string, string> {
  const ip = randomChinaIP();
  return {
    'Content-Type': 'application/x-www-form-urlencoded',
    Referer: 'http://music.163.com/',
    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; WOW64) AppleWebKit/537.36 (KHTML, like Gecko) Safari/537.36 Chrome/91.0.4472.164 NeteaseMusicDesktop/3.0.18.203152',
    'X-Forwarded-For': ip,
    'X-Real-IP': ip,
    ...extra,
  };
}

const KUGOU_SIGN_KEY = 'NVPh5oo715z5DIWAeQlhMDsWXXQV4hwt';
const KUGOU_LITE_SIGN = 'LnT6xpN3khm36zse0QzvmgTZ3waWdRSA';
const KUGOU_LITE_APP_ID = '3116';
const KUGOU_LITE_VER = '11440';

function md5Hex(input: string): string {
  const bytes = new TextEncoder().encode(input);
  const paddedLength = ((((bytes.length + 8) >>> 6) + 1) << 6);
  const buffer = new Uint8Array(paddedLength);
  buffer.set(bytes);
  buffer[bytes.length] = 0x80;
  const view = new DataView(buffer.buffer);
  const bitLength = bytes.length * 8;
  view.setUint32(paddedLength - 8, bitLength >>> 0, true);
  view.setUint32(paddedLength - 4, Math.floor(bitLength / 0x100000000), true);

  let a0 = 0x67452301;
  let b0 = 0xefcdab89;
  let c0 = 0x98badcfe;
  let d0 = 0x10325476;
  const shifts = [
    7, 12, 17, 22, 7, 12, 17, 22, 7, 12, 17, 22, 7, 12, 17, 22,
    5, 9, 14, 20, 5, 9, 14, 20, 5, 9, 14, 20, 5, 9, 14, 20,
    4, 11, 16, 23, 4, 11, 16, 23, 4, 11, 16, 23, 4, 11, 16, 23,
    6, 10, 15, 21, 6, 10, 15, 21, 6, 10, 15, 21, 6, 10, 15, 21,
  ];
  const constants = Array.from({ length: 64 }, (_, i) => Math.floor(Math.abs(Math.sin(i + 1)) * 0x100000000) >>> 0);

  for (let offset = 0; offset < paddedLength; offset += 64) {
    const words = Array.from({ length: 16 }, (_, i) => view.getUint32(offset + i * 4, true));
    let a = a0;
    let b = b0;
    let c = c0;
    let d = d0;
    for (let i = 0; i < 64; i++) {
      let f = 0;
      let g = 0;
      if (i < 16) {
        f = (b & c) | (~b & d);
        g = i;
      } else if (i < 32) {
        f = (d & b) | (~d & c);
        g = (5 * i + 1) % 16;
      } else if (i < 48) {
        f = b ^ c ^ d;
        g = (3 * i + 5) % 16;
      } else {
        f = c ^ (b | ~d);
        g = (7 * i) % 16;
      }
      const sum = (a + f + constants[i] + words[g]) >>> 0;
      a = d;
      d = c;
      c = b;
      b = (b + ((sum << shifts[i]) | (sum >>> (32 - shifts[i])))) >>> 0;
    }
    a0 = (a0 + a) >>> 0;
    b0 = (b0 + b) >>> 0;
    c0 = (c0 + c) >>> 0;
    d0 = (d0 + d) >>> 0;
  }

  return [a0, b0, c0, d0].map((word) => {
    let out = '';
    for (let i = 0; i < 4; i++) out += ((word >>> (i * 8)) & 0xff).toString(16).padStart(2, '0');
    return out;
  }).join('');
}

function kugouRandomString(length: number): string {
  const chars = '1234567890ABCDEFGHIJKLMNOPQRSTUVWXYZ';
  const bytes = new Uint8Array(length);
  const cryptoApi = (globalThis as any).crypto;
  if (cryptoApi && typeof cryptoApi.getRandomValues === 'function') cryptoApi.getRandomValues(bytes);
  else for (let i = 0; i < bytes.length; i++) bytes[i] = Math.floor(Math.random() * 256);
  return Array.from(bytes, (byte) => chars[byte % chars.length]).join('');
}

function kugouRandomGUID(): string {
  const bytes = new Uint8Array(16);
  const cryptoApi = (globalThis as any).crypto;
  if (cryptoApi && typeof cryptoApi.getRandomValues === 'function') cryptoApi.getRandomValues(bytes);
  else for (let i = 0; i < bytes.length; i++) bytes[i] = Math.floor(Math.random() * 256);
  bytes[6] = (bytes[6] & 0x0f) | 0x40;
  bytes[8] = (bytes[8] & 0x3f) | 0x80;
  const hex = Array.from(bytes, (byte) => byte.toString(16).padStart(2, '0')).join('');
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
}

function kugouMID(seed: string): string {
  const hex = md5Hex(seed);
  let value = 0n;
  for (const char of hex) value = value * 16n + BigInt(parseInt(char, 16));
  return value.toString(10);
}

function initKugouLoginDevice(cookies: Record<string, string> = {}): Record<string, string> {
  const guid = firstText(cookies.KUGOU_API_GUID) || kugouRandomGUID();
  return {
    ...cookies,
    KUGOU_API_GUID: guid,
    KUGOU_API_MID: firstText(cookies.KUGOU_API_MID) || kugouMID(guid),
    KUGOU_API_MAC: firstText(cookies.KUGOU_API_MAC) || kugouRandomString(12),
    KUGOU_API_DEV: firstText(cookies.KUGOU_API_DEV) || kugouRandomString(16),
  };
}

function kugouSignedURL(apiURL: string, params: Record<string, string>): string {
  const query = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) query.set(key, value);
  const pairs = Object.keys(params).sort().map((key) => `${key}=${params[key]}`).join('');
  query.set('signature', md5Hex(KUGOU_SIGN_KEY + pairs + KUGOU_SIGN_KEY));
  return `${apiURL}?${query.toString()}`;
}

function kugouAndroidSignedURL(apiURL: string, params: Record<string, string>, data: string): string {
  const query = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) query.set(key, value);
  const pairs = Object.keys(params).sort().map((key) => `${key}=${params[key]}`).join('');
  query.set('signature', md5Hex(KUGOU_LITE_SIGN + pairs + data + KUGOU_LITE_SIGN));
  return `${apiURL}?${query.toString()}`;
}

async function kugouLoginWebGet(apiURL: string, params: Record<string, string>, cookies: Record<string, string>): Promise<any> {
  const clienttime = String(Math.floor(Date.now() / 1000));
  const finalParams: Record<string, string> = {
    dfid: firstText(cookies.dfid) || '-',
    mid: firstText(cookies.KUGOU_API_MID) || '-',
    uuid: '-',
    appid: KUGOU_LITE_APP_ID,
    clientver: KUGOU_LITE_VER,
    clienttime,
    ...params,
  };
  const ip = randomChinaIP();
  const response = await fetchWithTimeout(kugouSignedURL(apiURL, finalParams), {
    headers: {
      'User-Agent': 'Android15-1070-11083-46-0-DiscoveryDRADProtocol-wifi',
      dfid: finalParams.dfid,
      clienttime,
      mid: finalParams.mid,
      'kg-rc': '1',
      'kg-thash': '5d816a0',
      'kg-rec': '1',
      'kg-rf': 'B9EDA08A64250DEFFBCADDEE00F8F25F',
      Cookie: joinCookieMap(cookies),
      'X-Forwarded-For': ip,
      'X-Real-IP': ip,
    },
  }, 15000);
  const body = await responseJsonBody(response);
  if (!response.ok) throw new Error(`kugou qr HTTP ${response.status}`);
  return body;
}

function kugouUserId(value: unknown): string {
  if (typeof value === 'number' && Number.isFinite(value)) return String(Math.trunc(value));
  return firstText(value).replace(/\.0$/, '');
}

function mapKugouQRStatus(status: number): string {
  if (status === 4) return 'success';
  if (status === 2 || status === 3) return 'scanned';
  if (status === -1 || status === 5 || status === 6) return 'expired';
  if (status === 0 || status === 1) return 'waiting';
  return 'failed';
}

async function createKugouQRLogin(): Promise<Record<string, unknown>> {
  const cookies = initKugouLoginDevice();
  const body = await kugouLoginWebGet('https://login-user.kugou.com/v2/qrcode', {
    appid: '1001',
    type: '1',
    plat: '4',
    qrcode_txt: `https://h5.kugou.com/apps/loginQRCode/html/index.html?appid=${KUGOU_LITE_APP_ID}&`,
    srcappid: '2919',
  }, cookies);
  const key = firstText(body?.data?.qrcode);
  if (Number(body?.status) !== 1 || !key) {
    throw new Error(firstText(body?.error, body?.msg, `kugou qr create failed: status=${body?.status || ''}`));
  }
  saveQRLoginSession('kugou', key, cookies);
  return {
    source: 'kugou',
    key,
    url: `https://h5.kugou.com/apps/loginQRCode/html/index.html?qrcode=${encodeURIComponent(key)}`,
    expires_at: Math.floor(Date.now() / 1000) + 300,
  };
}

async function checkKugouQRLogin(key: string): Promise<Record<string, unknown>> {
  const cookies = initKugouLoginDevice(qrLoginSessionCookies('kugou', key));
  const body = await kugouLoginWebGet('https://login-user.kugou.com/v2/get_userinfo_qrcode', {
    plat: '4',
    appid: KUGOU_LITE_APP_ID,
    srcappid: '2919',
    qrcode: key,
  }, cookies);
  const data = body?.data || {};
  const rawStatus = Number(data?.status || 0);
  const status = mapKugouQRStatus(rawStatus);
  const resultCookies = { ...cookies };
  const token = firstText(data?.token);
  const userID = kugouUserId(data?.userid);
  if (status === 'success') {
    if (token) resultCookies.token = token;
    if (userID && userID !== '0') resultCookies.userid = userID;
  }
  const cookie = joinCookieMap(resultCookies);
  return {
    source: 'kugou',
    key,
    status: status === 'success' && (!token || !userID || userID === '0') ? 'failed' : status,
    message: firstText(body?.error, body?.message, `status=${rawStatus}`),
    cookie,
    cookies: resultCookies,
    extra: {
      status: String(rawStatus),
      error_code: String(body?.error_code || ''),
      has_token: token ? 'true' : 'false',
      has_userid: userID ? 'true' : 'false',
      ...cookieDebugInfo(resultCookies),
    },
  };
}

async function createNeteaseQRLogin(): Promise<Record<string, unknown>> {
  const form = new URLSearchParams({ type: '3' });
  const response = await fetchWithTimeout('https://interface.music.163.com/api/login/qrcode/unikey', {
    method: 'POST',
    headers: neteaseQRHeaders(),
    body: form.toString(),
  }, 15000);
  const body = await responseJsonBody(response);
  const key = firstText(body?.unikey);
  if (Number(body?.code) !== 200 || !key) throw new Error('网易云二维码创建失败');
  return {
    source: 'netease',
    key,
    url: `https://music.163.com/login?codekey=${encodeURIComponent(key)}`,
    expires_at: Math.floor(Date.now() / 1000) + 300,
  };
}

async function checkNeteaseQRLogin(key: string): Promise<Record<string, unknown>> {
  const form = new URLSearchParams({ key, type: '3' });
  const response = await fetchWithTimeout('https://interface.music.163.com/api/login/qrcode/client/login', {
    method: 'POST',
    headers: neteaseQRHeaders(),
    body: form.toString(),
  }, 15000);
  const body = await responseJsonBody(response);
  const status = mapNeteaseQRStatus(Number(body?.code || 0));
  const headerCookies = responseCookieMap(response);
  const bodyCookie = firstText(body?.cookie);
  const bodyCookies = bodyCookie ? parseCookieString(bodyCookie) : {};
  const cookies = { ...headerCookies, ...bodyCookies };
  saveQRLoginSession('netease', key, cookies);
  const cookie = firstText(bodyCookie, joinCookieMap(cookies));
  if (status === 'success' && !cookie) throw new Error('网易云扫码已确认，但未获取到登录 Cookie');
  return {
    source: 'netease',
    key,
    status,
    message: firstText(body?.message),
    cookie,
    cookies,
    extra: cookieDebugInfo(cookies, {
      code: String(body?.code || ''),
      body_cookie_names: cookieNamesFromCookieString(bodyCookie),
      body_cookie_length: String(bodyCookie.length),
      header_cookie_names: Object.keys(headerCookies).filter(Boolean).sort().join(','),
      request_cookie: 'none',
    }),
  };
}

async function createQQQRLogin(): Promise<Record<string, unknown>> {
  const params = new URLSearchParams({
    appid: '716027609',
    e: '2',
    l: 'M',
    s: '3',
    d: '72',
    v: '4',
    t: (Date.now() / 1000).toFixed(17),
    daid: '383',
    pt_3rd_aid: '100497308',
  });
  const response = await fetchWithTimeout(`https://ssl.ptlogin2.qq.com/ptqrshow?${params.toString()}`, {
    headers: {
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
      Referer: 'https://y.qq.com/',
    },
  }, 15000);
  if (!response.ok) throw new Error('QQ二维码创建失败: HTTP ' + response.status);
  const cookies = responseCookieMap(response);
  const qrsig = firstText(cookies.qrsig);
  if (!qrsig) throw new Error('QQ二维码创建失败：未获取到 qrsig Cookie');
  const image = await response.arrayBuffer();
  return {
    source: 'qq',
    key: new URLSearchParams({ qrsig }).toString(),
    image_url: `data:image/png;base64,${arrayBufferBase64(image)}`,
    expires_at: Math.floor(Date.now() / 1000) + 120,
  };
}

async function checkQQQRLogin(key: string): Promise<Record<string, unknown>> {
  const values = new URLSearchParams(key);
  const qrsig = values.get('qrsig') || '';
  if (!qrsig) throw new Error('QQ二维码创建失败：未获取到 qrsig Cookie');
  const params = new URLSearchParams({
    u1: 'https://graph.qq.com/oauth2.0/login_jump',
    ptqrtoken: String(hash33(qrsig)),
    ptredirect: '100',
    h: '1',
    t: '1',
    g: '1',
    from_ui: '1',
    ptlang: '2052',
    action: `0-0-${Date.now()}`,
    js_ver: '21072115',
    js_type: '1',
    login_sig: '',
    pt_uistyle: '40',
    aid: '716027609',
    daid: '383',
    pt_3rd_aid: '100497308',
    has_onekey: '1',
    pttype: '1',
    service: 'ptqrlogin',
    nodirect: '0',
  });
  const response = await fetchWithTimeout(`https://ssl.ptlogin2.qq.com/ptqrlogin?${params.toString()}`, {
    headers: {
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
      Referer: 'https://xui.ptlogin2.qq.com/',
      Cookie: `qrsig=${qrsig}`,
    },
  }, 15000);
  const raw = await response.text();
  const parsed = parseQQQRCheck(raw);
  const status = mapQQQRStatus(parsed.code);
  let cookies = { qrsig, ...responseCookieMap(response) };
  let redirectError = '';
  if (status === 'success' && parsed.redirectURL) {
    try {
      cookies = await fetchQQRedirectCookies(parsed.redirectURL, cookies);
    } catch (error: any) {
      redirectError = error?.message || String(error);
    }
  }
  cookies = normalizeQQMusicCookies(cookies);
  const cookie = joinCookieMap(cookies);
  return {
    source: 'qq',
    key,
    status,
    message: parsed.message,
    cookie,
    cookies,
    extra: {
      code: parsed.code,
      redirect_url: parsed.redirectURL,
      ...cookieDebugInfo(cookies),
      ...(redirectError ? { redirect_error: redirectError } : {}),
    },
  };
}

const QQ_WX_QR_CONNECT_API = 'https://open.weixin.qq.com/connect/qrconnect';
const QQ_WX_QR_CHECK_API = 'https://lp.open.weixin.qq.com/connect/l/qrconnect';
const QQ_WX_REDIRECT_URI = 'https://y.qq.com/portal/wx_redirect.html?login_type=2&surl=https://y.qq.com/';
const QQ_WX_APP_ID = 'wx48db31d50e334801';

async function createQQWXQRLogin(): Promise<Record<string, unknown>> {
  const state = `music-lib-${Date.now()}`;
  const params = new URLSearchParams({
    appid: QQ_WX_APP_ID,
    redirect_uri: QQ_WX_REDIRECT_URI,
    response_type: 'code',
    scope: 'snsapi_login',
    state,
    href: 'https://y.qq.com/mediastyle/music_v17/src/css/popup_wechat.css#wechat_redirect',
  });
  const loginURL = `${QQ_WX_QR_CONNECT_API}?${params.toString()}`;
  const response = await fetchWithTimeout(loginURL, {
    headers: {
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
      Referer: 'https://y.qq.com/',
    },
  }, 15000);
  if (!response.ok) throw new Error(`QQ 微信二维码创建失败：HTTP ${response.status}`);
  const raw = await response.text();
  const uuid = parseQQWXQRUUID(raw);
  if (!uuid) throw new Error('QQ 微信二维码创建失败：未获取到 uuid');
  const key = new URLSearchParams({ type: 'wx', uuid, state }).toString();
  return {
    source: 'qq_wx',
    key,
    url: loginURL,
    image_url: `https://open.weixin.qq.com/connect/qrcode/${encodeURIComponent(uuid)}`,
    expires_at: Math.floor(Date.now() / 1000) + 300,
    extra: { login_type: 'wx', uuid },
  };
}

function qqWXLoginDataCookies(data: Record<string, unknown>): Record<string, string> {
  const value = (...keys: string[]) => {
    for (const key of keys) {
      const raw = data?.[key];
      if (typeof raw === 'string' && raw.trim()) return raw.trim();
      if (typeof raw === 'number' && raw > 0) return String(Math.trunc(raw));
    }
    return '';
  };
  const result: Record<string, string> = {};
  const musicID = value('musicid', 'musicId', 'userid', 'user_id', 'uin');
  if (musicID) result.musicid = musicID;
  const musicKey = value('musickey', 'music_key', 'qqmusic_key', 'qm_keyst', 'strMusicKey');
  if (musicKey) {
    result.musickey = musicKey;
    result.qqmusic_key = musicKey;
    result.qm_keyst = musicKey;
  }
  const refreshKey = value('refresh_key', 'refreshKey');
  if (refreshKey) result.refresh_key = refreshKey;
  const refreshToken = value('refresh_token', 'refreshToken');
  if (refreshToken) result.refresh_token = refreshToken;
  const openID = value('openid', 'openId', 'wxopenid', 'strOpenid');
  if (openID) {
    result.openid = openID;
    result.wxopenid = openID;
  }
  const unionID = value('unionid', 'unionId', 'wxunionid', 'strUnionid');
  if (unionID) {
    result.unionid = unionID;
    result.wxunionid = unionID;
  }
  const accessToken = value('access_token', 'accessToken', 'wxaccess_token');
  if (accessToken) result.wxaccess_token = accessToken;
  return result;
}

async function fetchQQWXLoginCookies(wxCode: string): Promise<{ cookies: Record<string, string>; extra: Record<string, string> }> {
  const payload = {
    comm: {
      tmeAppID: 'qqmusic',
      tmeLoginType: '1',
      g_tk: 5381,
      platform: 'yqq',
      ct: 24,
      cv: 0,
    },
    req: {
      module: 'music.login.LoginServer',
      method: 'Login',
      param: {
        strAppid: QQ_WX_APP_ID,
        code: wxCode,
      },
    },
  };
  const endpoints = [
    'https://u.y.qq.com/cgi-bin/musicu.fcg',
    'https://szu.y.qq.com/cgi-bin/musicu.fcg',
    'https://shu.y.qq.com/cgi-bin/musicu.fcg',
  ];
  let lastError = '';
  for (const apiURL of endpoints) {
    try {
      const response = await fetchWithTimeout(apiURL, {
        method: 'POST',
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
          Referer: QQ_WX_REDIRECT_URI,
          Origin: 'https://y.qq.com',
          Accept: '*/*',
          'Content-Type': 'application/x-www-form-urlencoded',
          Cookie: 'login_type=2',
        },
        body: JSON.stringify(payload),
      }, 15000);
      const cookies = responseCookieMap(response);
      const body = await responseJsonBody(response);
      if (!response.ok) {
        lastError = `QQ 微信登录 HTTP ${response.status}`;
        continue;
      }
      const code = Number(body?.code ?? -1);
      const reqCode = Number(body?.req?.code ?? -1);
      if (code !== 0 || reqCode !== 0) {
        lastError = firstText(body?.req?.message, body?.req?.msg, body?.message, body?.msg, `QQ 微信登录失败 code=${code} req=${reqCode}`);
        continue;
      }
      Object.assign(cookies, qqWXLoginDataCookies(body?.req?.data || {}));
      return { cookies, extra: { endpoint: apiURL } };
    } catch (error: any) {
      lastError = error?.message || String(error);
    }
  }
  throw new Error(lastError || 'QQ 微信登录失败');
}

async function checkQQWXQRLogin(key: string): Promise<Record<string, unknown>> {
  const values = new URLSearchParams(key);
  const uuid = values.get('uuid') || '';
  const state = values.get('state') || 'STATE';
  if (!uuid) throw new Error('QQ 微信扫码缺少 uuid');
  const params = new URLSearchParams({ uuid, _: String(Date.now()) });
  const response = await fetchWithTimeout(`${QQ_WX_QR_CHECK_API}?${params.toString()}`, {
    headers: {
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
      Referer: QQ_WX_QR_CONNECT_API,
    },
  }, 15000);
  const raw = await response.text();
  const parsed = parseQQWXQRCheck(raw);
  const status = mapQQWXQRStatus(parsed.code);
  const result: Record<string, unknown> = {
    source: 'qq_wx',
    key,
    status,
    message: qqWXQRMessage(parsed.code, raw),
    extra: { code: parsed.code, login_type: 'wx', state },
  };
  if (status !== 'success') return result;
  if (!parsed.wxCode) return { ...result, status: 'failed', message: '微信授权 code 缺失' };
  const login = await fetchQQWXLoginCookies(parsed.wxCode);
  const cookies = normalizeQQMusicCookies(login.cookies);
  const cookie = joinCookieMap(cookies);
  return {
    ...result,
    cookie,
    cookies,
    extra: {
      ...(result.extra as Record<string, string>),
      ...login.extra,
      ...cookieDebugInfo(cookies),
    },
  };
}

async function createBilibiliQRLogin(): Promise<Record<string, unknown>> {
  const res = await httpJson('https://passport.bilibili.com/x/passport-login/web/qrcode/generate', {
    headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36' },
  }, 15000);
  const data = res?.body?.data || {};
  const key = firstText(data.qrcode_key);
  const url = firstText(data.url);
  if (Number(res?.body?.code) !== 0 || !key || !url) throw new Error('Bilibili 二维码创建失败');
  return { source: 'bilibili', key, url, expires_at: Math.floor(Date.now() / 1000) + 180 };
}

const BILIBILI_LOGIN_COOKIE_NAMES = ['SESSDATA', 'bili_jct', 'DedeUserID', 'DedeUserID__ckMd5', 'sid'];

async function checkBilibiliQRLogin(key: string): Promise<Record<string, unknown>> {
  const response = await fetchWithTimeout(`https://passport.bilibili.com/x/passport-login/web/qrcode/poll?qrcode_key=${encodeURIComponent(key)}`, {
    headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36' },
  }, 15000);
  const body = await responseJsonBody(response);
  const code = Number(body?.data?.code);
  const status = code === 0 ? 'success' : code === 86090 ? 'scanned' : code === 86101 ? 'waiting' : code === 86038 ? 'expired' : 'failed';
  const urlCookies = cookieMapFromUrl(firstText(body?.data?.url), BILIBILI_LOGIN_COOKIE_NAMES);
  const cookies = { ...urlCookies, ...responseCookieMap(response) };
  const cookie = joinCookieMap(cookies);
  return {
    source: 'bilibili',
    key,
    status,
    message: firstText(body?.data?.message, body?.message),
    cookie,
    cookies,
    extra: cookieDebugInfo(cookies, { code: String(code), login_url_cookie_count: String(Object.keys(urlCookies).length) }),
  };
}

async function handleCreateQRLogin(req: HTTPRequest): Promise<HTTPResponse> {
  const body = parseBody(req);
  const query = parseQuery(req.query || '');
  const source = String(body.source || query.source || '').trim();
  if (!source) return apiErrorPayload(400, '缺少扫码平台');
  try {
    if (source === 'netease') return successResponse(await createNeteaseQRLogin());
    if (source === 'qq') return successResponse(await createQQQRLogin());
    if (source === 'qq_wx') return successResponse(await createQQWXQRLogin());
    if (source === 'kugou') return successResponse(await createKugouQRLogin());
    if (source === 'bilibili') return successResponse(await createBilibiliQRLogin());
    return apiErrorPayload(400, source + ' 暂不支持扫码登录');
  } catch (error: any) {
    return apiErrorPayload(500, error?.message || String(error));
  }
}

async function handleCheckQRLogin(req: HTTPRequest): Promise<HTTPResponse> {
  const query = parseQuery(req.query || '');
  const source = String(query.source || '').trim();
  const key = String(query.key || '').trim();
  if (!source || !key) return apiErrorPayload(400, '缺少扫码平台或 key');
  try {
    if (source === 'netease') return successResponse(await persistQRLoginResult(source, await checkNeteaseQRLogin(key)));
    if (source === 'qq') return successResponse(await persistQRLoginResult(source, await checkQQQRLogin(key)));
    if (source === 'qq_wx') return successResponse(await persistQRLoginResult(source, await checkQQWXQRLogin(key)));
    if (source === 'kugou') return successResponse(await persistQRLoginResult(source, await checkKugouQRLogin(key)));
    if (source === 'bilibili') return successResponse(await persistQRLoginResult(source, await checkBilibiliQRLogin(key)));
    return apiErrorPayload(400, source + ' 暂不支持扫码登录');
  } catch (error: any) {
    return apiErrorPayload(500, error?.message || String(error));
  }
}

function normalizeCollectionItem(item: any): GoMusicPlaylist | null {
  if (!item || typeof item !== 'object') return null;
  const id = asString(item.id || item.ID || '');
  const name = asString(item.name || item.Name || '');
  if (!id || !name) return null;
  const embeddedSongs = Array.isArray(item.songs)
    ? item.songs
    : Array.isArray(item.tracks)
      ? item.tracks
      : Array.isArray(item.items)
        ? item.items
        : [];
  return {
    id,
    source: 'local',
    name,
    creator: asString(item.creator || item.author || item.user_name || ''),
    cover: asString(item.cover || item.cover_url || ''),
    description: asString(item.description || item.desc || ''),
    track_count: asNumber(
      item.track_count ||
      item.trackCount ||
      item.song_count ||
      item.songCount ||
      item.song_cnt ||
      item.songCnt ||
      item.song_num ||
      item.songNum ||
      item.songnum ||
      item.count_tracks ||
      item.countTracks ||
      item.total ||
      item.count ||
      embeddedSongs.length ||
      0
    ),
    link: asString(item.link || item.url || ''),
    detail_url: buildQueryUrl('/playlist', { id, source: 'local', type: 'playlist' }),
    content_type: 'playlist',
  };
}

function normalizeHostSong(item: any): GoMusicSong | null {
  if (!item || typeof item !== 'object') return null;
  const sourceData = sourceDataFromAny(item.source_data || item.sourceData || item.raw_source_data || item.sourceDataJson || item);
  const extra = parseExtra(sourceData?.extra) || {};
  const source = publicSourceId(asString(sourceData?.source || item.source || item.platform || 'local'));
  const hostSongId = asString(item.id || item.song_id || item.songId || item.ID || '');
  const id = source === 'local'
    ? asString(hostSongId || sourceData?.id || '')
    : asString(sourceData?.id || hostSongId || '');
  const name = firstText(sourceData?.name, pickSongName(item), item.name, item.title);
  if (!id || !name) return null;
  const duration = asNumber(sourceData?.duration || item.duration || 0);
  const metricSource = {
    ...item,
    ...sourceData,
    ...(extra || {}),
  } as Record<string, unknown>;
  const bitrate = normalizeSongBitrate(metricSource);
  const sourceDataAny = (sourceData || {}) as Record<string, unknown>;
  const embeddedLyric = extractEmbeddedLyricFromAny(sourceDataAny, item, item.metadata, item.tags);
  const hostCover = pickCover(item, source);
  return {
    id,
    source,
    name,
    artist: firstText(sourceData?.artist, pickArtist(item)),
    album: firstText(sourceData?.album, pickAlbum(item)),
    album_id: firstText(sourceData?.album_id, pickAlbumId(item)),
    duration,
    size: normalizeSongSize(metricSource, duration, bitrate),
    bitrate,
    cover: firstText(normalizeCoverUrl(source, sourceData?.cover), hostCover),
    link: asString(sourceData?.link || item.link || item.url || item.audio_url || item.audioUrl || ''),
    is_invalid: !!(item.is_invalid || item.invalid || item.isInvalid || sourceDataAny.is_invalid || sourceDataAny.invalid || sourceDataAny.isInvalid),
    extra: {
      ...extra,
      ...(hostSongId ? { hostSongId } : {}),
      ...(asString(item.url || item.audio_url || item.audioUrl || item.stream_url || item.streamUrl) ? { url: asString(item.url || item.audio_url || item.audioUrl || item.stream_url || item.streamUrl) } : {}),
      ...(asString(item.file_path || item.filePath || item.path || item.local_path || item.localPath) ? { path: asString(item.file_path || item.filePath || item.path || item.local_path || item.localPath) } : {}),
      ...(hostCover ? { cover: hostCover } : {}),
      ...(embeddedLyric ? { lyric: embeddedLyric } : {}),
    },
  };
}

type QishuiPlayInfo = {
  main_play_url?: string;
  backup_play_url?: string;
  play_auth?: string;
  size?: number | string;
  format?: string;
  bitrate?: number | string;
  quality?: string;
  duration?: number | string;
};

function qishuiNormalizeBitrate(bitrate: unknown): number {
  const br = asNumber(bitrate);
  return br > 1000 ? Math.round(br / 1000) : br;
}

function qishuiQualityRank(quality: string, format = '', bitrate: unknown = 0): number {
  const q = String(quality || '').toLowerCase().replace(/[-_\s]/g, '');
  const f = String(format || '').toLowerCase();
  const br = qishuiNormalizeBitrate(bitrate);
  const isLosslessFormat = f.includes('flac') || f.includes('alac') || f.includes('wav');
  const isLosslessLabel = q.includes('lossless') || q.includes('flac') || q.includes('sq') || q.includes('svip');
  const isHiResLabel = q.includes('hires') || q.includes('master');
  if (isHiResLabel && (isLosslessFormat || br >= 900)) return 110;
  if (isLosslessLabel || isLosslessFormat || br >= 900) return 100;
  if (isHiResLabel) return 90;
  if (q.includes('atmos') || q.includes('dolby') || q.includes('spatial')) return 88;
  if (q.includes('highest') || q.includes('excellent') || q.includes('superhigh') || q.includes('hq')) return 80;
  if (q.includes('higher') || q === 'high' || q.includes('320')) return 70;
  if (q.includes('standard') || q.includes('medium') || q.includes('normal') || q.includes('128')) return 50;
  if (q.includes('low') || q.includes('preview')) return 10;
  if (br >= 900) return 100;
  if (br >= 320) return 70;
  if (br >= 256) return 65;
  if (br >= 192) return 55;
  if (br >= 128) return 50;
  if (br > 0) return 20;
  return 0;
}

function qishuiBetterPlayInfo(candidate: QishuiPlayInfo, current: QishuiPlayInfo | null): boolean {
  if (!current) return true;
  const aDuration = qishuiDurationSeconds(candidate.duration);
  const bDuration = qishuiDurationSeconds(current.duration);
  if (aDuration > 0 || bDuration > 0) {
    if (aDuration > bDuration + 1) return true;
    if (bDuration > aDuration + 1) return false;
  }
  const aRank = qishuiQualityRank(asString(candidate.quality), asString(candidate.format), candidate.bitrate);
  const bRank = qishuiQualityRank(asString(current.quality), asString(current.format), current.bitrate);
  if (aRank !== bRank) return aRank > bRank;
  const aBR = qishuiNormalizeBitrate(candidate.bitrate);
  const bBR = qishuiNormalizeBitrate(current.bitrate);
  if (aBR !== bBR) return aBR > bBR;
  const aSize = asNumber(candidate.size);
  const bSize = asNumber(current.size);
  if (aSize !== bSize) return aSize > bSize;
  return asString(candidate.quality) > asString(current.quality);
}

function qishuiDurationSeconds(value: unknown): number {
  const duration = asNumber(value);
  return duration > 1000 ? duration / 1000 : duration;
}

function qishuiFirstStringFromArray(value: unknown): string {
  if (!Array.isArray(value)) return '';
  for (const item of value) {
    const text = asString(item).trim();
    if (text) return text;
  }
  return '';
}

function qishuiPlayAuthFromMap(item: any): string {
  const encryptInfo = item?.encrypt_info || item?.EncryptInfo || item?.encryptInfo || {};
  return asString(encryptInfo?.spade_a || encryptInfo?.SpadeA || encryptInfo?.spadeA || encryptInfo?.play_auth || encryptInfo?.PlayAuth || item?.play_auth || item?.PlayAuth || '');
}

function qishuiQualityHint(key: string): string {
  const normalized = String(key || '').toLowerCase().replace(/[-_\s]/g, '');
  for (const token of ['hires', 'lossless', 'sq', 'flac', 'highest', 'higher', 'standard', 'normal']) {
    if (normalized.includes(token)) return token;
  }
  return '';
}

function qishuiPlayInfoFromVideoItem(item: any, keyHint = '', inheritedAuth = '', inheritedDuration = 0): QishuiPlayInfo | null {
  if (!item || typeof item !== 'object') return null;
  const meta = item?.video_meta || item?.videoMeta || {};
  const url = asString(
    item?.main_play_url || item?.MainPlayUrl || item?.main_url || item?.MainUrl ||
    item?.url || item?.URL || item?.play_url || item?.PlayURL ||
    item?.backup_play_url || item?.BackupPlayUrl || item?.backup_url || item?.BackupUrl ||
    qishuiFirstStringFromArray(item?.backup_urls || item?.backupUrls || item?.url_list || item?.UrlList) ||
    ''
  );
  if (!url) return null;
  return {
    main_play_url: asString(item?.main_play_url || item?.MainPlayUrl || item?.main_url || item?.MainUrl || item?.url || item?.URL || item?.play_url || item?.PlayURL || ''),
    backup_play_url: asString(item?.backup_play_url || item?.BackupPlayUrl || item?.backup_url || item?.BackupUrl || qishuiFirstStringFromArray(item?.backup_urls || item?.backupUrls || item?.url_list || item?.UrlList) || ''),
    play_auth: qishuiPlayAuthFromMap(item) || inheritedAuth,
    size: asNumber(meta?.size || meta?.Size || meta?.file_size || item?.size || item?.Size || item?.file_size || item?.FileSize || item?.data_size || item?.DataSize),
    format: asString(meta?.vtype || meta?.VType || meta?.format || item?.format || item?.Format || item?.vtype || item?.VType || item?.file_format || item?.FileFormat || ''),
    bitrate: asNumber(meta?.bitrate || meta?.Bitrate || meta?.real_bitrate || meta?.RealBitrate || item?.bitrate || item?.Bitrate || item?.br || item?.BR || item?.bit_rate || item?.BitRate),
    quality: asString(meta?.quality || meta?.Quality || item?.quality || item?.Quality || item?.definition || item?.Definition || item?.quality_type || item?.QualityType || qishuiQualityHint(asString(item?.gear_des_key || item?.GearDesKey || keyHint))),
    duration: qishuiDurationSeconds(item?.duration || item?.Duration || meta?.duration || meta?.Duration || inheritedDuration),
  };
}

async function qishuiResolveQualityUrl(item: QishuiPlayInfo, requestedQuality: string): Promise<string> {
  const baseUrl = asString(item?.main_play_url || item?.backup_play_url || '');
  if (!baseUrl) return '';
  const playAuth = asString(item?.play_auth || '');
  if (!playAuth) return baseUrl;
  return qishuiProxyPlayURL(baseUrl, playAuth, asString(item?.format || 'mp4'), requestedQuality);
}

function qishuiProxyPlayURL(url: string, playAuth: string, format = 'mp4', quality = ''): string {
  const params = new URLSearchParams({
    url,
    auth: playAuth,
    format: format || 'mp4',
  });
  if (quality) params.set('quality', quality);
  return `./api/soda/play?${params.toString()}`;
}

async function qishuiDecryptToDataURL(targetURL: string, playAuth: string): Promise<string> {
  const cookies = await getCookies();
  const cookie = String(cookies.soda || '').trim();
  const headers: Record<string, string> = {
    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/134.0.0.0 Safari/537.36',
  };
  if (cookie) headers.Cookie = cookie;
  const response = await fetchWithTimeout(targetURL, { headers }, 60000);
  if (!response.ok) throw new Error(`qishui audio HTTP ${response.status}`);
  const encrypted = await responseBytes(response);
  const decrypted = await qishuiDecryptAudio(encrypted, playAuth);
  const mime = audioMimeByExt(qishuiDetectAudioExt(decrypted));
  return `data:${mime};base64,${bytesBase64(decrypted)}`;
}

function base64Bytes(value: string): Uint8Array {
  const anyGlobal = globalThis as any;
  if (anyGlobal.Buffer) return new Uint8Array(anyGlobal.Buffer.from(value, 'base64'));
  const binary = anyGlobal.atob ? anyGlobal.atob(value) : '';
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return bytes;
}

function hexToBytes(value: string): Uint8Array {
  const clean = String(value || '').trim();
  const bytes = new Uint8Array(Math.floor(clean.length / 2));
  for (let i = 0; i < bytes.length; i++) bytes[i] = parseInt(clean.slice(i * 2, i * 2 + 2), 16);
  return bytes;
}

function bytesToAscii(bytes: Uint8Array): string {
  let text = '';
  for (let i = 0; i < bytes.length; i++) text += String.fromCharCode(bytes[i]);
  return text;
}

function qishuiBitCount(n: number): number {
  let value = n >>> 0;
  value = value - ((value >>> 1) & 0x55555555);
  value = (value & 0x33333333) + ((value >>> 2) & 0x33333333);
  return ((((value + (value >>> 4)) & 0x0f0f0f0f) * 0x01010101) >>> 24);
}

function qishuiDecodeBase36(code: number): number {
  if (code >= 48 && code <= 57) return code - 48;
  if (code >= 97 && code <= 122) return code - 97 + 10;
  if (code >= 65 && code <= 90) return code - 65 + 10;
  return 0xff;
}

function qishuiDecryptSpadeInner(input: Uint8Array): Uint8Array {
  const result = new Uint8Array(input.length);
  const prefix = [0xfa, 0x55];
  for (let i = 0; i < input.length; i++) {
    const buff = i < 2 ? prefix[i] : input[i - 2];
    let value = (input[i] ^ buff) - qishuiBitCount(i) - 21;
    while (value < 0) value += 255;
    result[i] = value & 0xff;
  }
  return result;
}

function qishuiExtractKey(playAuth: string): Uint8Array {
  const data = base64Bytes(playAuth);
  if (data.length < 3) throw new Error('qishui auth data too short');
  const paddingLen = (data[0] ^ data[1] ^ data[2]) - 48;
  if (paddingLen < 0 || data.length < paddingLen + 2) throw new Error('qishui invalid padding length');
  const innerInput = data.slice(1, data.length - paddingLen);
  const tmp = qishuiDecryptSpadeInner(innerInput);
  if (!tmp.length) throw new Error('qishui auth decryption failed');
  const skipBytes = qishuiDecodeBase36(tmp[0]);
  const endIndex = 1 + (data.length - paddingLen - 2) - skipBytes;
  if (endIndex > tmp.length || endIndex < 1) throw new Error('qishui auth index out of bounds');
  return hexToBytes(bytesToAscii(tmp.slice(1, endIndex)));
}

type QishuiBox = { offset: number; size: number; data: Uint8Array };

function readU32(data: Uint8Array, offset: number): number {
  return ((data[offset] << 24) | (data[offset + 1] << 16) | (data[offset + 2] << 8) | data[offset + 3]) >>> 0;
}

function readU16(data: Uint8Array, offset: number): number {
  return ((data[offset] << 8) | data[offset + 1]) >>> 0;
}

function boxType(data: Uint8Array, offset: number): string {
  return String.fromCharCode(data[offset + 4], data[offset + 5], data[offset + 6], data[offset + 7]);
}

function qishuiFindBox(data: Uint8Array, type: string, start: number, end: number): QishuiBox | null {
  const limit = Math.min(end, data.length);
  let pos = start;
  while (pos + 8 <= limit) {
    const size = readU32(data, pos);
    if (size < 8 || pos + size > limit) break;
    if (boxType(data, pos) === type) return { offset: pos, size, data: data.slice(pos + 8, pos + size) };
    pos += size;
  }
  return null;
}

function qishuiBoxChildStart(type: string, offset: number, headerSize: number): number {
  if (['moov', 'trak', 'mdia', 'minf', 'stbl', 'sinf', 'schi'].includes(type)) return offset + headerSize;
  if (type === 'stsd') return offset + headerSize + 8;
  if (['enca', 'mp4a', 'alac', 'fLaC'].includes(type)) return offset + headerSize + 28;
  return -1;
}

function qishuiFindBoxDeep(data: Uint8Array, type: string, start: number, end: number): QishuiBox | null {
  const limit = Math.min(end, data.length);
  let pos = start;
  while (pos + 8 <= limit) {
    let size = readU32(data, pos);
    let headerSize = 8;
    if (size === 1) {
      if (pos + 16 > limit) break;
      const hi = readU32(data, pos + 8);
      const lo = readU32(data, pos + 12);
      const size64 = hi * 0x100000000 + lo;
      if (size64 > limit - pos) break;
      size = size64;
      headerSize = 16;
    }
    if (size < headerSize || pos + size > limit) break;
    const current = boxType(data, pos);
    if (current === type) return { offset: pos, size, data: data.slice(pos + headerSize, pos + size) };
    const childStart = qishuiBoxChildStart(current, pos, headerSize);
    if (childStart >= 0 && childStart < pos + size) {
      const found = qishuiFindBoxDeep(data, type, childStart, pos + size);
      if (found) return found;
    }
    pos += size;
  }
  return null;
}

function qishuiParseStsz(data: Uint8Array): number[] {
  if (data.length < 12) return [];
  const fixedSize = readU32(data, 4);
  const count = readU32(data, 8);
  const sizes: number[] = [];
  for (let i = 0; i < count; i++) {
    sizes.push(fixedSize || (12 + i * 4 + 4 <= data.length ? readU32(data, 12 + i * 4) : 0));
  }
  return sizes;
}

type QishuiSencSample = { iv: Uint8Array; subsamples: Array<{ clear: number; encrypted: number }> };

function qishuiDefaultIVSize(data: Uint8Array, start: number, end: number): number {
  const tenc = qishuiFindBoxDeep(data, 'tenc', start, end);
  if (!tenc || tenc.data.length < 8) return 8;
  const ivSize = tenc.data[7];
  return ivSize === 8 || ivSize === 16 ? ivSize : 8;
}

function qishuiParseSenc(data: Uint8Array, ivSize: number): QishuiSencSample[] {
  if (data.length < 8) return [];
  const flags = readU32(data, 0) & 0x00ffffff;
  const count = readU32(data, 4);
  const hasSubsamples = (flags & 0x02) !== 0;
  const samples: QishuiSencSample[] = [];
  let ptr = 8;
  for (let i = 0; i < count; i++) {
    if (ptr + ivSize > data.length) break;
    const sample: QishuiSencSample = { iv: data.slice(ptr, ptr + ivSize), subsamples: [] };
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

async function qishuiAesCtr(data: Uint8Array, key: CryptoKey, iv: Uint8Array): Promise<Uint8Array> {
  const counter = new Uint8Array(16);
  counter.set(iv.slice(0, 16));
  const decrypted = await crypto.subtle.decrypt({ name: 'AES-CTR', counter, length: 128 }, key, data);
  return new Uint8Array(decrypted);
}

async function qishuiDecryptSencSample(key: CryptoKey, chunk: Uint8Array, sample: QishuiSencSample): Promise<Uint8Array> {
  if (!sample.subsamples.length) return qishuiAesCtr(chunk, key, sample.iv);
  const encryptedTotal = sample.subsamples.reduce((sum, item) => sum + Math.max(0, item.encrypted), 0);
  const encrypted = new Uint8Array(encryptedTotal);
  let readPos = 0;
  let writePos = 0;
  for (const sub of sample.subsamples) {
    readPos += Math.min(sub.clear, Math.max(0, chunk.length - readPos));
    const encryptedBytes = Math.min(sub.encrypted, Math.max(0, chunk.length - readPos));
    encrypted.set(chunk.slice(readPos, readPos + encryptedBytes), writePos);
    readPos += encryptedBytes;
    writePos += encryptedBytes;
  }
  const decryptedEncrypted = await qishuiAesCtr(encrypted.slice(0, writePos), key, sample.iv);
  const output = new Uint8Array(chunk);
  readPos = 0;
  writePos = 0;
  for (const sub of sample.subsamples) {
    readPos += Math.min(sub.clear, Math.max(0, chunk.length - readPos));
    const encryptedBytes = Math.min(sub.encrypted, Math.max(0, chunk.length - readPos));
    output.set(decryptedEncrypted.slice(writePos, writePos + encryptedBytes), readPos);
    readPos += encryptedBytes;
    writePos += encryptedBytes;
  }
  return output;
}

function qishuiOriginalSampleFormat(stsdData: Uint8Array): Uint8Array {
  for (let i = 0; i + 4 <= stsdData.length; i++) {
    if (String.fromCharCode(stsdData[i], stsdData[i + 1], stsdData[i + 2], stsdData[i + 3]) !== 'frma') continue;
    if (i < 4 || i + 8 > stsdData.length) break;
    const size = readU32(stsdData, i - 4);
    if (size < 12 || i - 4 + size > stsdData.length) break;
    return stsdData.slice(i + 4, i + 8);
  }
  return new Uint8Array([0x6d, 0x70, 0x34, 0x61]);
}

async function qishuiDecryptAudio(fileData: Uint8Array, playAuth: string): Promise<Uint8Array> {
  if (!crypto?.subtle) throw new Error('qishui decrypt requires WebCrypto');
  const keyBytes = qishuiExtractKey(playAuth);
  const key = await crypto.subtle.importKey('raw', keyBytes, 'AES-CTR', false, ['decrypt']);
  const moov = qishuiFindBox(fileData, 'moov', 0, fileData.length);
  if (!moov) throw new Error('qishui moov box not found');
  let stbl = qishuiFindBox(fileData, 'stbl', moov.offset, moov.offset + moov.size);
  if (!stbl) {
    const trak = qishuiFindBox(fileData, 'trak', moov.offset + 8, moov.offset + moov.size);
    const mdia = trak ? qishuiFindBox(fileData, 'mdia', trak.offset + 8, trak.offset + trak.size) : null;
    const minf = mdia ? qishuiFindBox(fileData, 'minf', mdia.offset + 8, mdia.offset + mdia.size) : null;
    stbl = minf ? qishuiFindBox(fileData, 'stbl', minf.offset + 8, minf.offset + minf.size) : null;
  }
  if (!stbl) throw new Error('qishui stbl box not found');
  const stsz = qishuiFindBox(fileData, 'stsz', stbl.offset + 8, stbl.offset + stbl.size);
  if (!stsz) throw new Error('qishui stsz box not found');
  const sampleSizes = qishuiParseStsz(stsz.data);
  let senc = qishuiFindBox(fileData, 'senc', moov.offset + 8, moov.offset + moov.size);
  if (!senc) senc = qishuiFindBox(fileData, 'senc', stbl.offset + 8, stbl.offset + stbl.size);
  if (!senc) throw new Error('qishui senc box not found');
  const samples = qishuiParseSenc(senc.data, qishuiDefaultIVSize(fileData, stbl.offset, stbl.offset + stbl.size));
  const mdat = qishuiFindBox(fileData, 'mdat', 0, fileData.length);
  if (!mdat) throw new Error('qishui mdat box not found');

  const output = new Uint8Array(fileData);
  let readPtr = mdat.offset + 8;
  let writePtr = mdat.offset + 8;
  for (let i = 0; i < sampleSizes.length; i++) {
    const size = sampleSizes[i];
    if (!size || readPtr + size > output.length) break;
    const chunk = output.slice(readPtr, readPtr + size);
    const decrypted = i < samples.length ? await qishuiDecryptSencSample(key, chunk, samples[i]) : chunk;
    output.set(decrypted, writePtr);
    readPtr += size;
    writePtr += size;
  }
  if (writePtr !== mdat.offset + mdat.size) throw new Error('qishui decrypted size mismatch');

  const stsd = qishuiFindBox(output, 'stsd', stbl.offset + 8, stbl.offset + stbl.size);
  if (stsd) {
    const stsdData = output.slice(stsd.offset, stsd.offset + stsd.size);
    for (let i = 0; i + 4 <= stsdData.length; i++) {
      if (String.fromCharCode(stsdData[i], stsdData[i + 1], stsdData[i + 2], stsdData[i + 3]) === 'enca') {
        output.set(qishuiOriginalSampleFormat(stsdData), stsd.offset + i);
        break;
      }
    }
  }
  return output;
}

function qishuiDetectAudioExt(data: Uint8Array): string {
  if (data.length >= 4 && bytesToAscii(data.slice(0, 4)) === 'fLaC') return 'flac';
  if (data.length >= 3 && bytesToAscii(data.slice(0, 3)) === 'ID3') return 'mp3';
  if (data.length >= 2 && data[0] === 0xff && (data[1] & 0xe0) === 0xe0) return 'mp3';
  if (data.length >= 4 && bytesToAscii(data.slice(0, 4)) === 'OggS') return 'ogg';
  if (data.length >= 12 && bytesToAscii(data.slice(4, 8)) === 'ftyp') return 'm4a';
  return 'mp3';
}

function audioMimeByExt(ext: string): string {
  switch (String(ext || '').toLowerCase()) {
    case 'flac':
      return 'audio/flac';
    case 'ogg':
      return 'audio/ogg';
    case 'm4a':
    case 'mp4':
      return 'audio/mp4';
    default:
      return 'audio/mpeg';
  }
}

function qishuiTrackV2Params(trackId: string): Record<string, string> {
  return {
    track_id: trackId,
    media_type: 'track',
    aid: '386088',
    device_platform: 'web',
    channel: 'pc_web',
  };
}

function qishuiTrackV2Payload(response: any): any {
  if (!response || typeof response !== 'object') return response;
  if (response.track || response.track_info || response.track_player) return response;
  if (response.data && typeof response.data === 'object') return response.data;
  return response;
}

function qishuiBestPlayInfo(list: QishuiPlayInfo[]): QishuiPlayInfo | null {
  let best: QishuiPlayInfo | null = null;
  for (const item of list) {
    const url = asString(item?.main_play_url || item?.backup_play_url || '');
    if (!url) continue;
    if (qishuiBetterPlayInfo(item, best)) best = item;
  }
  return best;
}

function qishuiTrackDuration(payload: any): number {
  const track = payload?.track || payload?.track_info || payload?.trackInfo || {};
  return qishuiDurationSeconds(track?.duration || track?.Duration || 0);
}

function qishuiDownloadInfoIsPreview(info: QishuiPlayInfo | null, fullDuration: number): boolean {
  if (!info || !fullDuration) return false;
  const duration = qishuiDurationSeconds(info.duration);
  return duration > 0 && duration + 5 < fullDuration;
}

function qishuiDownloadInfoIsLossless(info: QishuiPlayInfo | null): boolean {
  if (!info) return false;
  const format = asString(info.format).toLowerCase();
  const bitrate = qishuiNormalizeBitrate(info.bitrate);
  return qishuiQualityRank(asString(info.quality), format, bitrate) >= 100;
}

function qishuiPayloadIsVIP(payload: any, songInfo: Record<string, unknown>): boolean {
  const extra = parseExtra(songInfo.extra) || {};
  if (String(extra.is_vip || '').toLowerCase() === 'true') return true;
  if (extra.only_vip_download || extra.only_vip_playable || extra.vip_download_qualities || extra.vip_play_qualities) return true;
  const label = payload?.track?.label_info || payload?.track?.labelInfo || payload?.track_info?.label_info || payload?.trackInfo?.labelInfo || {};
  if (label?.only_vip_download || label?.onlyVIPDownload || label?.only_vip_playable || label?.onlyVIPPlayable) return true;
  const vipDownload = label?.quality_only_vip_can_download || label?.qualityOnlyVIPCanDownload;
  const vipPlay = label?.quality_only_vip_can_play || label?.qualityOnlyVIPCanPlay;
  if ((Array.isArray(vipDownload) && vipDownload.length) || (Array.isArray(vipPlay) && vipPlay.length)) return true;
  const qualityMap = label?.quality_map || label?.qualityMap || {};
  if (qualityMap && typeof qualityMap === 'object') {
    for (const policy of Object.values(qualityMap as Record<string, any>)) {
      if (policy?.play_detail?.need_vip || policy?.playDetail?.needVIP || policy?.download_detail?.need_vip || policy?.downloadDetail?.needVIP) return true;
    }
  }
  return false;
}

function qishuiPlayerInfoList(response: any): QishuiPlayInfo[] {
  const list = Array.isArray(response?.Result?.Data?.PlayInfoList)
    ? response.Result.Data.PlayInfoList
    : Array.isArray(response?.result?.data?.play_info_list)
      ? response.result.data.play_info_list
      : Array.isArray(response?.result?.data?.playInfoList)
        ? response.result.data.playInfoList
        : [];
  return list.map((item: any) => qishuiPlayInfoFromVideoItem(item)).filter(Boolean) as QishuiPlayInfo[];
}

function qishuiCollectVideoModelEntries(value: unknown, keyHint = '', inheritedAuth = '', inheritedDuration = 0, result: QishuiPlayInfo[] = []): QishuiPlayInfo[] {
  if (!value) return result;
  if (typeof value === 'string') {
    let text = value.trim();
    for (let i = 0; i < 3 && text.startsWith('"'); i++) {
      try {
        const nested = JSON.parse(text);
        if (typeof nested !== 'string') break;
        text = nested.trim();
      } catch {
        break;
      }
    }
    if (!text || text === 'null') return result;
    try {
      qishuiCollectVideoModelEntries(JSON.parse(text), keyHint, inheritedAuth, inheritedDuration, result);
    } catch {
      // Some responses carry a non-JSON placeholder. Ignore it and fall back to player_info.
    }
    return result;
  }
  if (Array.isArray(value)) {
    for (const child of value) qishuiCollectVideoModelEntries(child, keyHint, inheritedAuth, inheritedDuration, result);
    return result;
  }
  if (typeof value !== 'object') return result;
  const item = value as Record<string, unknown>;
  const auth = qishuiPlayAuthFromMap(item) || inheritedAuth;
  const duration = qishuiDurationSeconds(item.video_duration || item.duration || item.Duration || inheritedDuration);
  const entry = qishuiPlayInfoFromVideoItem(item, keyHint, auth, duration);
  if (entry) result.push(entry);
  for (const [key, child] of Object.entries(item)) {
    qishuiCollectVideoModelEntries(child, key, auth, duration, result);
  }
  return result;
}

function qishuiCollectPlayInfoList(response: any): QishuiPlayInfo[] {
  const payload = qishuiTrackV2Payload(response);
  const lists: unknown[] = [
    payload?.track?.video_model?.video_list,
    payload?.track?.videoModel?.videoList,
    payload?.track_info?.video_model?.video_list,
    payload?.track_info?.videoModel?.videoList,
    payload?.video_model?.video_list,
    payload?.videoModel?.videoList,
    payload?.track_player?.video_model?.video_list,
    payload?.track_player?.videoModel?.videoList,
    payload?.track?.audio_info?.play_info_list,
    payload?.track_info?.audio_info?.play_info_list,
    payload?.track?.audioInfo?.playInfoList,
    payload?.track_info?.audioInfo?.playInfoList,
    payload?.audio_info?.play_info_list,
    payload?.audioInfo?.playInfoList,
  ];
  const merged: QishuiPlayInfo[] = [];
  for (const list of lists) {
    if (!Array.isArray(list)) continue;
    for (const item of list) {
      if (!item || typeof item !== 'object') continue;
      const videoInfo = qishuiPlayInfoFromVideoItem(item);
      if (videoInfo) {
        merged.push(videoInfo);
        continue;
      }
      merged.push(item as QishuiPlayInfo);
    }
  }
  qishuiCollectVideoModelEntries(payload?.track_player?.video_model || payload?.trackPlayer?.video_model || payload?.trackPlayer?.videoModel || '', '', '', 0, merged);
  return merged;
}

async function qishuiFetchTrackV2(trackId: string): Promise<any> {
  const cookies = await getCookies();
  const cookie = String(cookies.soda || '').trim();
  const headers: Record<string, string> = {
    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/134.0.0.0 Safari/537.36',
  };
  if (cookie) headers.Cookie = cookie;

  const query = new URLSearchParams(qishuiTrackV2Params(trackId));
  const result = await httpJson(`${QISHUI_API_HTTPS}/track_v2?${query.toString()}`, { method: 'GET', headers }, 20000);
  if (result.status >= 400) throw new Error(`qishui web track_v2 HTTP ${result.status}`);
  return result.body;
}

async function qishuiFetchPCTrackV2(trackId: string): Promise<any> {
  const cookies = await getCookies();
  const cookie = String(cookies.soda || '').trim();
  if (!cookie) throw new Error('qishui pc track_v2 requires cookie');
  const headers: Record<string, string> = {
    'User-Agent': 'LunaPC/3.3.0(359450208)',
    'Content-Type': 'application/json; charset=utf-8',
    'x-luna-background-type': 'foreground',
    'x-luna-is-background-req': '0',
    'x-luna-is-local-user': '1',
    Cookie: cookie,
  };
  const body = JSON.stringify({
    track_id: trackId,
    media_type: 'track',
    queue_type: 'favorite_track_playlist',
    scene_name: 'library',
  });
  const result = await httpJson(`${QISHUI_API_HTTPS}/track_v2?${sodaPCParams()}`, { method: 'POST', headers, body }, 20000);
  if (result.status >= 400) throw new Error(`qishui pc track_v2 HTTP ${result.status}`);
  return result.body;
}

async function qishuiFetchPlayerInfo(playerInfoURL: string): Promise<any> {
  const cookies = await getCookies();
  const cookie = String(cookies.soda || '').trim();
  const headers: Record<string, string> = {
    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/134.0.0.0 Safari/537.36',
  };
  if (cookie) headers.Cookie = cookie;
  const result = await httpJson(playerInfoURL, { method: 'GET', headers }, 20000);
  if (result.status >= 400) throw new Error(`qishui player_info HTTP ${result.status}`);
  return result.body;
}

async function qishuiSearchV2(keyword: string, page = 1, pageSize = 30): Promise<{ list: GoMusicSong[]; total: number; page: number; pageSize: number }> {
  if (!keyword) return { list: [], total: 0, page, pageSize };
  const res = await httpGetWithFallback(`${QISHUI_API_HTTPS}/search/track`, {
    q: keyword,
    cursor: '0',
    search_method: 'input',
    aid: '386088',
    device_platform: 'web',
    channel: 'pc_web',
  }, 15000);
  const rawTracks = Array.isArray(res?.result_groups?.[0]?.data)
    ? res.result_groups[0].data.map((item: any) => item?.entity?.track).filter(Boolean)
    : [];
  const list = rawTracks.map((item: any) => normalizeQishuiSong({
    id: item?.id || item?.vid,
    vid: item?.vid,
    name: item?.name,
    artists: Array.isArray(item?.artists) ? item.artists.map((artist: any) => artist?.name).filter(Boolean).join(' / ') : asString(item?.artists),
    albumName: item?.album?.name,
    duration: item?.duration,
    pic: item?.url_cover?.urls?.[0] || item?.album?.url_cover?.urls?.[0] || item?.cover,
    cover: item?.cover,
  }));
  const total = asNumber(res?.total || res?.result_groups?.[0]?.total || list.length);
  return { list, total, page, pageSize };
}

async function qishuiGetUrlV2(songInfo: Record<string, unknown>, quality: string): Promise<string> {
  const songId = qishuiSongId(songInfo);
  if (!songId) throw new Error('缺少歌曲 ID');

  const res = await qishuiFetchTrackV2(songId);
  let payload = qishuiTrackV2Payload(res);
  const statusCode = Number(payload?.status_code ?? payload?.statusCode ?? 0);
  if (statusCode !== 0 && !Number.isNaN(statusCode)) {
    throw new Error(asString(payload?.status_info?.status_msg || payload?.status_info?.StatusMsg || 'qishui track lookup failed'));
  }

  let fullDuration = qishuiTrackDuration(payload);
  const isVIPTrack = qishuiPayloadIsVIP(payload, songInfo);
  let lastError: Error | null = null;
  let best = qishuiBestPlayInfo(qishuiCollectPlayInfoList(payload));
  const playerInfoURL = asString(payload?.track_player?.url_player_info || payload?.trackPlayer?.url_player_info || '');
  if ((!best || qishuiDownloadInfoIsPreview(best, fullDuration)) && playerInfoURL) {
    try {
      const playerInfo = await qishuiFetchPlayerInfo(playerInfoURL);
      const playerBest = qishuiBestPlayInfo(qishuiPlayerInfoList(playerInfo));
      if (playerBest) best = playerBest;
    } catch (error: any) {
      lastError = error instanceof Error ? error : new Error(String(error));
    }
  }

  const webIsPreview = qishuiDownloadInfoIsPreview(best, fullDuration);
  const cookies = await getCookies();
  const hasCookie = Boolean(String(cookies.soda || '').trim());
  if (hasCookie && (isVIPTrack || webIsPreview || !qishuiDownloadInfoIsLossless(best))) {
    try {
      const pcRes = await qishuiFetchPCTrackV2(songId);
      payload = qishuiTrackV2Payload(pcRes);
      if (!fullDuration) fullDuration = qishuiTrackDuration(payload);
      const pcBest = qishuiBestPlayInfo(qishuiCollectPlayInfoList(payload));
      if (pcBest && !qishuiDownloadInfoIsPreview(pcBest, fullDuration)) {
        best = pcBest;
      } else {
        const pcPlayerInfoURL = asString(payload?.track_player?.url_player_info || payload?.trackPlayer?.url_player_info || '');
        if (pcPlayerInfoURL) {
          const pcPlayerInfo = await qishuiFetchPlayerInfo(pcPlayerInfoURL);
          const pcPlayerBest = qishuiBestPlayInfo(qishuiPlayerInfoList(pcPlayerInfo));
          if (pcPlayerBest && !qishuiDownloadInfoIsPreview(pcPlayerBest, fullDuration)) {
            best = pcPlayerBest;
          } else if (pcPlayerBest) {
            lastError = new Error('qishui pc player_info returned preview stream');
          }
        } else if (pcBest) {
          lastError = new Error('qishui pc track_v2 returned preview stream');
        } else {
          lastError = new Error('qishui pc track_v2 missing player info url');
        }
      }
    } catch (error: any) {
      lastError = error instanceof Error ? error : new Error(String(error));
    }
  }

  if (isVIPTrack && qishuiDownloadInfoIsPreview(best, fullDuration)) {
    if (lastError) throw new Error(`qishui vip full stream unavailable: ${lastError.message}`);
    if (!hasCookie) throw new Error('qishui vip playback requires cookie');
    throw new Error('source_data is required');
  }

  const downloadURL = await qishuiResolveQualityUrl(best as QishuiPlayInfo, quality);
  if (!downloadURL) {
    if (lastError) throw lastError;
    throw new Error('source_data is required');
  }
  return downloadURL;
}

async function qishuiGetLyricV2(songInfo: Record<string, unknown>): Promise<string> {
  const songId = qishuiSongId(songInfo);
  if (!songId) return '';
  const res = await qishuiFetchTrackV2(songId);
  const payload = qishuiTrackV2Payload(res);
  return cleanLyricText(asString(
    payload?.lyric?.content ||
    payload?.lyric?.Content ||
    payload?.track?.lyric?.content ||
    payload?.track_info?.lyric?.content ||
    ''
  ));
}

function cleanLyricText(value: string): string {
  const formatMs = (ms: number): string => {
    const totalSeconds = Math.max(0, ms) / 1000;
    const minute = Math.floor(totalSeconds / 60);
    const second = totalSeconds - minute * 60;
    return `[${String(minute).padStart(2, '0')}:${second.toFixed(2).padStart(5, '0')}]`;
  };
  return String(value || '')
    .replace(/<\d+,\d+,\d+>/g, '')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&amp;/g, '&')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .split(/\r?\n/)
    .map((line) => line.replace(/^\[(\d+),\d+\]/, (_match, ms) => formatMs(Number(ms))))
    .join('\n');
}

function pickQuality(requestedQuality: string, supportedQualities: string[]): string {
  const normalized = String(requestedQuality || '128k').toLowerCase();
  const support = supportedQualities.map((item) => item.toLowerCase());
  if (support.includes(normalized)) return normalized;
  const order = ['flac24bit', 'flac', '320k', '192k', '128k'];
  for (const candidate of order) {
    if (support.includes(candidate)) return candidate;
  }
  return support[0] || '128k';
}

const EXTENDED_SEARCH_SOURCES = new Set(['bilibili', 'joox', 'apple', 'qianqian', 'fivesing', 'jamendo']);
const QIANQIAN_APP_ID = '16073360';
const QIANQIAN_SECRET = '0b50b02fd0d73a9c4c8c3a781c30845f';
const QIANQIAN_REFERER = 'https://music.91q.com/player';
const JOOX_COOKIE = 'wmid=142420656; user_type=1; country=id; session_key=2a5d97d05dc8fe238150184eaf3519ad;';
const JOOX_XFF = '36.73.34.109';
const APPLE_HOME = 'https://music.apple.com';
const APPLE_AMP = 'https://amp-api.music.apple.com';
const JAMENDO_HOME = 'https://www.jamendo.com';
const JAMENDO_VERSION = '4gvfvv';
let appleBearerToken = '';

function stripSearchHtml(value: unknown): string {
  return String(value || '')
    .replace(/<em[^>]*>/gi, '')
    .replace(/<\/em>/gi, '')
    .replace(/<[^>]+>/g, '')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&amp;/g, '&')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .trim();
}

function md5HexExtendedUnused(input: string): string {
  function add32(a: number, b: number) { return (a + b) & 0xffffffff; }
  function cmn(q: number, a: number, b: number, x: number, s: number, t: number) {
    a = add32(add32(a, q), add32(x, t));
    return add32((a << s) | (a >>> (32 - s)), b);
  }
  function ff(a: number, b: number, c: number, d: number, x: number, s: number, t: number) { return cmn((b & c) | (~b & d), a, b, x, s, t); }
  function gg(a: number, b: number, c: number, d: number, x: number, s: number, t: number) { return cmn((b & d) | (c & ~d), a, b, x, s, t); }
  function hh(a: number, b: number, c: number, d: number, x: number, s: number, t: number) { return cmn(b ^ c ^ d, a, b, x, s, t); }
  function ii(a: number, b: number, c: number, d: number, x: number, s: number, t: number) { return cmn(c ^ (b | ~d), a, b, x, s, t); }
  function md5cycle(state: number[], k: number[]) {
    let [a, b, c, d] = state;
    a = ff(a, b, c, d, k[0], 7, -680876936); d = ff(d, a, b, c, k[1], 12, -389564586); c = ff(c, d, a, b, k[2], 17, 606105819); b = ff(b, c, d, a, k[3], 22, -1044525330);
    a = ff(a, b, c, d, k[4], 7, -176418897); d = ff(d, a, b, c, k[5], 12, 1200080426); c = ff(c, d, a, b, k[6], 17, -1473231341); b = ff(b, c, d, a, k[7], 22, -45705983);
    a = ff(a, b, c, d, k[8], 7, 1770035416); d = ff(d, a, b, c, k[9], 12, -1958414417); c = ff(c, d, a, b, k[10], 17, -42063); b = ff(b, c, d, a, k[11], 22, -1990404162);
    a = ff(a, b, c, d, k[12], 7, 1804603682); d = ff(d, a, b, c, k[13], 12, -40341101); c = ff(c, d, a, b, k[14], 17, -1502002290); b = ff(b, c, d, a, k[15], 22, 1236535329);
    a = gg(a, b, c, d, k[1], 5, -165796510); d = gg(d, a, b, c, k[6], 9, -1069501632); c = gg(c, d, a, b, k[11], 14, 643717713); b = gg(b, c, d, a, k[0], 20, -373897302);
    a = gg(a, b, c, d, k[5], 5, -701558691); d = gg(d, a, b, c, k[10], 9, 38016083); c = gg(c, d, a, b, k[15], 14, -660478335); b = gg(b, c, d, a, k[4], 20, -405537848);
    a = gg(a, b, c, d, k[9], 5, 568446438); d = gg(d, a, b, c, k[14], 9, -1019803690); c = gg(c, d, a, b, k[3], 14, -187363961); b = gg(b, c, d, a, k[8], 20, 1163531501);
    a = gg(a, b, c, d, k[13], 5, -1444681467); d = gg(d, a, b, c, k[2], 9, -51403784); c = gg(c, d, a, b, k[7], 14, 1735328473); b = gg(b, c, d, a, k[12], 20, -1926607734);
    a = hh(a, b, c, d, k[5], 4, -378558); d = hh(d, a, b, c, k[8], 11, -2022574463); c = hh(c, d, a, b, k[11], 16, 1839030562); b = hh(b, c, d, a, k[14], 23, -35309556);
    a = hh(a, b, c, d, k[1], 4, -1530992060); d = hh(d, a, b, c, k[4], 11, 1272893353); c = hh(c, d, a, b, k[7], 16, -155497632); b = hh(b, c, d, a, k[10], 23, -1094730640);
    a = hh(a, b, c, d, k[13], 4, 681279174); d = hh(d, a, b, c, k[0], 11, -358537222); c = hh(c, d, a, b, k[3], 16, -722521979); b = hh(b, c, d, a, k[6], 23, 76029189);
    a = hh(a, b, c, d, k[9], 4, -640364487); d = hh(d, a, b, c, k[12], 11, -421815835); c = hh(c, d, a, b, k[15], 16, 530742520); b = hh(b, c, d, a, k[2], 23, -995338651);
    a = ii(a, b, c, d, k[0], 6, -198630844); d = ii(d, a, b, c, k[7], 10, 1126891415); c = ii(c, d, a, b, k[14], 15, -1416354905); b = ii(b, c, d, a, k[5], 21, -57434055);
    a = ii(a, b, c, d, k[12], 6, 1700485571); d = ii(d, a, b, c, k[3], 10, -1894986606); c = ii(c, d, a, b, k[10], 15, -1051523); b = ii(b, c, d, a, k[1], 21, -2054922799);
    a = ii(a, b, c, d, k[8], 6, 1873313359); d = ii(d, a, b, c, k[15], 10, -30611744); c = ii(c, d, a, b, k[6], 15, -1560198380); b = ii(b, c, d, a, k[13], 21, 1309151649);
    a = ii(a, b, c, d, k[4], 6, -145523070); d = ii(d, a, b, c, k[11], 10, -1120210379); c = ii(c, d, a, b, k[2], 15, 718787259); b = ii(b, c, d, a, k[9], 21, -343485551);
    state[0] = add32(state[0], a); state[1] = add32(state[1], b); state[2] = add32(state[2], c); state[3] = add32(state[3], d);
  }
  const bytes = Array.from(unescape(encodeURIComponent(input)), (c) => c.charCodeAt(0));
  const state = [1732584193, -271733879, -1732584194, 271733878];
  let i = 0;
  for (; i + 63 < bytes.length; i += 64) {
    const block = Array(16).fill(0);
    for (let j = 0; j < 64; j++) block[j >> 2] |= bytes[i + j] << ((j % 4) << 3);
    md5cycle(state, block);
  }
  const tail = Array(16).fill(0);
  for (let j = 0; i + j < bytes.length; j++) tail[j >> 2] |= bytes[i + j] << ((j % 4) << 3);
  tail[(bytes.length % 64) >> 2] |= 0x80 << ((bytes.length % 4) << 3);
  if (bytes.length % 64 > 55) {
    md5cycle(state, tail);
    tail.fill(0);
  }
  tail[14] = bytes.length * 8;
  md5cycle(state, tail);
  return state.map((n) => {
    let out = '';
    for (let j = 0; j < 4; j++) out += ((n >> (j * 8)) & 0xff).toString(16).padStart(2, '0');
    return out;
  }).join('');
}

function qianqianSignedParams(params: Record<string, string>): URLSearchParams {
  const all: Record<string, string> = { ...params, appid: QIANQIAN_APP_ID, timestamp: String(Math.floor(Date.now() / 1000)) };
  const signing = Object.keys(all).sort().map((key) => `${key}=${all[key]}`).join('&') + QIANQIAN_SECRET;
  all.sign = md5Hex(signing);
  const out = new URLSearchParams();
  Object.keys(all).forEach((key) => out.set(key, all[key]));
  return out;
}

function extSong(source: string, raw: Partial<GoMusicSong> & { extra?: Record<string, string> }): GoMusicSong {
  return {
    id: String(raw.id || raw.extra?.songid || raw.extra?.track_id || ''),
    name: String(raw.name || ''),
    artist: String(raw.artist || ''),
    album: String(raw.album || ''),
    album_id: raw.album_id || raw.extra?.album_id || '',
    duration: asNumber(raw.duration || 0),
    size: asNumber(raw.size || 0),
    bitrate: asNumber(raw.bitrate || 0),
    source,
    url: raw.url || '',
    ext: raw.ext || '',
    cover: normalizeCoverUrl(source, raw.cover || ''),
    link: raw.link || '',
    extra: raw.extra,
  };
}

function buildDirectPlayURL(source: string, targetURL: string): string {
  const params = new URLSearchParams({ source: publicSourceId(source), url: targetURL });
  return `./api/direct/play?${params.toString()}`;
}

async function sha1Hex(input: string): Promise<string> {
  const subtle = (globalThis as any).crypto?.subtle;
  if (!subtle) throw new Error('当前环境缺少 SHA-1 签名能力');
  const digest = await subtle.digest('SHA-1', new TextEncoder().encode(input));
  return Array.from(new Uint8Array(digest)).map((byte) => byte.toString(16).padStart(2, '0')).join('');
}

async function jamendoHeaders(path: string): Promise<Record<string, string>> {
  const random = String(Math.random());
  return {
    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/143.0.0.0 Safari/537.36',
    Referer: 'https://www.jamendo.com/search?q=musicdl',
    'x-jam-call': `$${await sha1Hex(path + random)}*${random}~`,
    'x-jam-version': JAMENDO_VERSION,
    'x-requested-with': 'XMLHttpRequest',
  };
}

async function extendedSearchBilibili(keyword: string, page: number, pageSize: number): Promise<{ songs: GoMusicSong[]; total: number }> {
  const cookies = await getCookies().catch(() => ({} as Record<string, string>));
  const cookie = cookieForSource(cookies, 'bilibili');
  const params = new URLSearchParams({ search_type: 'video', keyword, page: String(page), page_size: String(pageSize) });
  const res = await httpJson(`https://api.bilibili.com/x/web-interface/wbi/search/type?${params.toString()}`, {
    headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36', Referer: 'https://www.bilibili.com/', ...(cookie ? { Cookie: cookie } : {}) },
  }, 15000);
  const list = Array.isArray(res?.body?.data?.result) ? res.body.data.result : [];
  const songs: GoMusicSong[] = [];
  for (const item of list) {
    const bvid = firstText(item?.bvid);
    if (!bvid) continue;
    const view = await httpJson(`https://api.bilibili.com/x/web-interface/view?bvid=${encodeURIComponent(bvid)}`, {
      headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36', Referer: 'https://www.bilibili.com/', ...(cookie ? { Cookie: cookie } : {}) },
    }, 10000).catch(() => null);
    const pages = Array.isArray(view?.body?.data?.pages) ? view.body.data.pages : [];
    const firstPage = pages[0] || {};
    const cid = firstText(firstPage.cid);
    if (!cid) continue;
    const rootTitle = stripSearchHtml(item.title || view?.body?.data?.title);
    const part = stripSearchHtml(firstPage.part);
    songs.push(extSong('bilibili', {
      id: `${bvid}|${cid}`,
      name: part && part !== rootTitle ? `${rootTitle} - ${part}` : rootTitle,
      artist: firstText(item.author, view?.body?.data?.owner?.name),
      album: bvid,
      duration: asNumber(firstPage.duration || 0),
      cover: normalizeCoverUrl('bilibili', firstText(item.pic, view?.body?.data?.pic)),
      link: `https://www.bilibili.com/video/${bvid}?p=1`,
      extra: { bvid, cid },
    }));
  }
  return { songs, total: asNumber(res?.body?.data?.numResults || songs.length) || songs.length };
}

async function resolveBilibiliUrl(songInfo: Record<string, unknown>): Promise<string> {
  const extra = parseExtra(songInfo.extra) || {};
  const id = firstText(songInfo.id, songInfo.musicId);
  const parts = id.split('|');
  const bvid = firstText(extra.bvid, parts[0]);
  const cid = firstText(extra.cid, parts[1]);
  if (!bvid || !cid) throw new Error('bilibili bvid/cid is required');
  const cookies = await getCookies().catch(() => ({} as Record<string, string>));
  const cookie = cookieForSource(cookies, 'bilibili');
  const res = await httpJson(`https://api.bilibili.com/x/player/playurl?fnval=4048&qn=127&bvid=${encodeURIComponent(bvid)}&cid=${encodeURIComponent(cid)}`, {
    headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36', Referer: 'https://www.bilibili.com/', ...(cookie ? { Cookie: cookie } : {}) },
  }, 15000);
  const dash = res?.body?.data?.dash || {};
  const candidates = [
    dash?.flac?.audio?.baseUrl,
    ...(Array.isArray(dash?.dolby?.audio) ? dash.dolby.audio.map((a: any) => a.baseUrl) : []),
    ...(Array.isArray(dash?.audio) ? dash.audio.sort((a: any, b: any) => asNumber(b.id) - asNumber(a.id)).map((a: any) => a.baseUrl) : []),
    ...(Array.isArray(res?.body?.data?.durl) ? res.body.data.durl.map((a: any) => a.url) : []),
  ].map((value) => firstText(value)).filter(Boolean);
  if (!candidates.length) throw new Error('bilibili audio url not found');
  return buildDirectPlayURL('bilibili', candidates[0]);
}

async function extendedSearchJoox(keyword: string, page: number, pageSize: number): Promise<{ songs: GoMusicSong[]; total: number }> {
  void page;
  void pageSize;
  const params = new URLSearchParams({ country: 'sg', lang: 'zh_cn', keyword });
  const res = await httpJson(`https://cache.api.joox.com/openjoox/v3/search?${params.toString()}`, {
    headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36', Cookie: JOOX_COOKIE, 'X-Forwarded-For': JOOX_XFF },
  }, 15000);
  const songs: GoMusicSong[] = [];
  for (const section of Array.isArray(res?.body?.section_list) ? res.body.section_list : []) {
    for (const item of Array.isArray(section?.item_list) ? section.item_list : []) {
      for (const wrapper of Array.isArray(item?.song) ? item.song : []) {
        const info = wrapper?.song_info || {};
        const id = firstText(info.id);
        if (!id) continue;
        const artists = (Array.isArray(info.artist_list) ? info.artist_list : []).map((a: any) => firstText(a?.name)).filter(Boolean).join(' / ');
        const images = Array.isArray(info.images) ? info.images : [];
        const cover = firstText(images.find((img: any) => asNumber(img.width) === 300)?.url, images[0]?.url);
        songs.push(extSong('joox', {
          id,
          name: firstText(info.name),
          artist: artists,
          album: firstText(info.album_name),
          duration: asNumber(info.play_duration || 0),
          cover,
          link: `https://www.joox.com/hk/single/${encodeURIComponent(id)}`,
          extra: { songid: id },
        }));
      }
    }
  }
  return { songs, total: songs.length };
}

async function fetchJooxSongInfo(songId: string): Promise<Record<string, string>> {
  const params = new URLSearchParams({ songid: songId, lang: 'zh_cn', country: 'sg' });
  const raw = await fetchText(`https://api.joox.com/web-fcgi-bin/web_get_songinfo?${params.toString()}`, {
    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
    Cookie: JOOX_COOKIE,
    'X-Forwarded-For': JOOX_XFF,
  });
  const text = raw.startsWith('MusicInfoCallback(') ? raw.replace(/^MusicInfoCallback\(/, '').replace(/\)$/, '') : raw;
  const data = JSON.parse(text);
  const kbps = typeof data.kbps_map === 'string' ? JSON.parse(data.kbps_map || '{}') : (data.kbps_map || {});
  const candidates = [{ key: '320', url: data.r320Url }, { key: '192', url: data.r192Url }, { key: '128', url: data.mp3Url }, { key: '96', url: data.m4aUrl }];
  const selected = candidates.find((item) => item.url && kbps?.[item.key] && String(kbps[item.key]) !== '0') || candidates.find((item) => item.url);
  return { url: firstText(selected?.url), name: firstText(data.msong), artist: firstText(data.msinger), album: firstText(data.malbum), cover: firstText(data.img) };
}

async function extendedSearchQianqian(keyword: string, page: number, pageSize: number): Promise<{ songs: GoMusicSong[]; total: number }> {
  const params = qianqianSignedParams({ word: keyword, type: '1', pageNo: String(page), pageSize: String(Math.min(pageSize, 30)) });
  const res = await httpJson(`https://music.91q.com/v1/search?${params.toString()}`, {
    headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36', Referer: QIANQIAN_REFERER },
  }, 15000);
  const list = Array.isArray(res?.body?.data?.typeTrack) ? res.body.data.typeTrack : [];
  const songs = list
    .filter((item: any) => asNumber(item?.isVip || 0) === 0)
    .map((item: any) => {
      const tsid = firstText(item?.TSID);
      const artists = (Array.isArray(item?.artist) ? item.artist : []).map((a: any) => firstText(a?.name)).filter(Boolean).join(' / ');
      return extSong('qianqian', {
        id: tsid,
        name: firstText(item?.title),
        artist: artists,
        album: firstText(item?.albumTitle),
        album_id: firstText(item?.albumAssetCode),
        duration: asNumber(item?.duration || 0),
        cover: firstText(item?.pic),
        link: `https://music.91q.com/song/${tsid}`,
        extra: { tsid, album_id: firstText(item?.albumAssetCode), lyric: firstText(item?.lyric) },
      });
    })
    .filter((song: GoMusicSong) => !!song.id && !!song.name);
  return { songs, total: asNumber(res?.body?.data?.total || songs.length) || songs.length };
}

async function qianqianSongInfo(tsid: string): Promise<any> {
  const params = qianqianSignedParams({ TSID: tsid });
  const res = await httpJson(`https://music.91q.com/v1/song/info?${params.toString()}`, {
    headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36', Referer: QIANQIAN_REFERER },
  }, 15000);
  return Array.isArray(res?.body?.data) ? res.body.data[0] : null;
}

async function resolveQianqianUrl(songInfo: Record<string, unknown>): Promise<string> {
  const extra = parseExtra(songInfo.extra) || {};
  const tsid = firstText(extra.tsid, songInfo.id, songInfo.musicId);
  if (!tsid) throw new Error('qianqian tsid is required');
  for (const rate of ['3000', '320', '128', '64']) {
    const params = qianqianSignedParams({ TSID: tsid, rate });
    const res = await httpJson(`https://music.91q.com/v1/song/tracklink?${params.toString()}`, {
      headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36', Referer: QIANQIAN_REFERER },
    }, 12000).catch(() => null);
    const url = firstText(res?.body?.data?.path, res?.body?.data?.trail_audio_info?.path);
    if (url) return url;
  }
  throw new Error('qianqian audio url not found');
}

async function extendedSearchFivesing(keyword: string, page: number, pageSize: number): Promise<{ songs: GoMusicSong[]; total: number }> {
  void pageSize;
  const params = new URLSearchParams({ keyword, sort: '1', page: String(page), filter: '0', type: '0' });
  const res = await httpJson(`http://search.5sing.kugou.com/home/json?${params.toString()}`, {
    headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36' },
  }, 15000);
  const list = Array.isArray(res?.body?.list) ? res.body.list : [];
  const songs = list.map((item: any) => {
    const songid = firstText(item?.songId);
    const songtype = firstText(item?.typeEname);
    return extSong('fivesing', {
      id: `${songid}|${songtype}`,
      name: stripSearchHtml(item?.songName),
      artist: stripSearchHtml(item?.singer),
      duration: asNumber(item?.songSize || 0) > 0 ? Math.round(asNumber(item.songSize) * 8 / 320000) : 0,
      size: asNumber(item?.songSize || 0),
      link: `http://5sing.kugou.com/${songtype}/${songid}.html`,
      extra: { songid, songtype },
    });
  }).filter((song: GoMusicSong) => !!song.id && !!song.name);
  return { songs, total: songs.length };
}

async function resolveFivesingUrl(songInfo: Record<string, unknown>): Promise<string> {
  const extra = parseExtra(songInfo.extra) || {};
  const parts = firstText(songInfo.id, songInfo.musicId).split('|');
  const songid = firstText(extra.songid, parts[0]);
  const songtype = firstText(extra.songtype, parts[1]);
  if (!songid || !songtype) throw new Error('5sing songid/songtype is required');
  const params = new URLSearchParams({ songid, songtype });
  const res = await httpJson(`http://mobileapi.5sing.kugou.com/song/getSongUrl?${params.toString()}`, {
    headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36' },
  }, 15000);
  const data = res?.body?.data || {};
  const url = firstText(data.squrl, data.squrl_backup, data.hqurl, data.hqurl_backup, data.lqurl, data.lqurl_backup);
  if (!url) throw new Error('5sing audio url not found');
  return url;
}

async function extendedSearchJamendo(keyword: string, page: number, pageSize: number): Promise<{ songs: GoMusicSong[]; total: number }> {
  void page;
  const params = new URLSearchParams({ query: keyword, type: 'track', limit: String(Math.min(pageSize, 50)), identities: 'www' });
  const res = await httpJson(`${JAMENDO_HOME}/api/search?${params.toString()}`, {
    headers: await jamendoHeaders('/api/search'),
  }, 15000);
  const list = Array.isArray(res?.body) ? res.body : [];
  const songs = list.map((item: any) => {
    const streams = item?.download && Object.keys(item.download).length ? item.download : (item?.stream || {});
    let url = '';
    let ext = '';
    for (const key of ['flac', 'mp33', 'mp32', 'mp3', 'ogg']) {
      if (!streams?.[key]) continue;
      url = firstText(streams[key]);
      ext = key === 'mp33' || key === 'mp32' ? 'mp3' : key;
      break;
    }
    const id = firstText(item?.id);
    const albumId = firstText(item?.albumId, item?.album?.id);
    return extSong('jamendo', {
      id,
      name: firstText(item?.name),
      artist: firstText(item?.artist?.name),
      album: firstText(item?.album?.name),
      album_id: albumId,
      duration: asNumber(item?.duration || 0),
      cover: firstText(item?.cover?.big?.size300),
      url,
      ext,
      link: `https://www.jamendo.com/track/${id}`,
      extra: { track_id: id, album_id: albumId, url },
    });
  }).filter((song: GoMusicSong) => !!song.id && !!song.name && !!song.url);
  return { songs, total: songs.length };
}

async function appleToken(): Promise<string> {
  if (appleBearerToken) return appleBearerToken;
  const home = await fetchText(APPLE_HOME, { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36' });
  const scriptPath = firstText(home.match(/\/(assets\/index-legacy[~\-][^/"']+\.js)/)?.[1]);
  if (!scriptPath) throw new Error('apple token script not found');
  const js = await fetchText(`${APPLE_HOME}/${scriptPath}`, { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36' });
  const token = firstText(js.match(/=["'](eyJh[^"']+)/)?.[1]);
  if (!token) throw new Error('apple token not found');
  appleBearerToken = token;
  return token;
}

function appleCover(artwork: any, size = 600): string {
  return String(artwork?.url || '').replace(/\{w\}/g, String(size)).replace(/\{h\}/g, String(size));
}

async function appleApi(path: string, params: URLSearchParams): Promise<any> {
  const token = await appleToken();
  const url = `${APPLE_AMP}${path}?${params.toString()}`;
  const res = await httpJson(url, {
    headers: { Authorization: `Bearer ${token}`, Origin: APPLE_HOME, 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36' },
  }, 15000);
  return res.body;
}

async function extendedSearchApple(keyword: string, page: number, pageSize: number): Promise<{ songs: GoMusicSong[]; total: number }> {
  void page;
  const body = await appleApi('/v1/catalog/us/search', new URLSearchParams({ term: keyword, types: 'songs', limit: String(Math.min(pageSize, 30)) }));
  const list = Array.isArray(body?.results?.songs?.data) ? body.results.songs.data : [];
  const songs = list.map((item: any) => {
    const attr = item?.attributes || {};
    const url = firstText(Array.isArray(attr.previews) ? attr.previews[0]?.url : '');
    return extSong('apple', {
      id: firstText(item?.id),
      name: firstText(attr.name),
      artist: firstText(attr.artistName),
      album: firstText(attr.albumName),
      duration: Math.round(asNumber(attr.durationInMillis || 0) / 1000),
      cover: appleCover(attr.artwork, 600),
      url,
      ext: 'm4a',
      link: firstText(attr.url),
      extra: { isrc: firstText(attr.isrc), url },
    });
  }).filter((song: GoMusicSong) => !!song.id && !!song.name);
  return { songs, total: songs.length };
}

async function extendedSearchSource(source: string, keyword: string, page: number, pageSize: number): Promise<{ songs: GoMusicSong[]; total: number }> {
  if (source === 'bilibili') return extendedSearchBilibili(keyword, page, pageSize);
  if (source === 'joox') return extendedSearchJoox(keyword, page, pageSize);
  if (source === 'qianqian') return extendedSearchQianqian(keyword, page, pageSize);
  if (source === 'fivesing') return extendedSearchFivesing(keyword, page, pageSize);
  if (source === 'jamendo') return extendedSearchJamendo(keyword, page, pageSize);
  if (source === 'apple') return extendedSearchApple(keyword, page, pageSize);
  throw new Error(`unsupported extended source ${source}`);
}

async function resolveExtendedUrl(source: string, songInfo: Record<string, unknown>): Promise<string> {
  const extra = parseExtra(songInfo.extra) || {};
  const direct = firstText(songInfo.url, extra.url, extra.audio, extra.audiodownload);
  if (source === 'bilibili') return resolveBilibiliUrl(songInfo);
  if (source === 'joox') {
    const id = firstText(extra.songid, songInfo.id, songInfo.musicId);
    const info = await fetchJooxSongInfo(id);
    if (info.url) return info.url;
  }
  if (source === 'qianqian') return resolveQianqianUrl(songInfo);
  if (source === 'fivesing') return resolveFivesingUrl(songInfo);
  if (source === 'jamendo' && direct) return direct;
  if (source === 'apple' && direct) return direct;
  throw new Error(`${source} audio url not found`);
}

function resolveSongId(songInfo: Record<string, unknown>): string {
  return asString(
    songInfo.songmid ||
    songInfo.musicId ||
    songInfo.hash ||
    songInfo.copyrightId ||
    songInfo.strMediaMid ||
    songInfo.albumMid ||
    songInfo.id ||
    ''
  );
}

async function resolveHuibqUrl(source: string, songInfo: Record<string, unknown>, quality: string): Promise<string> {
  const songId = resolveSongId(songInfo);
  if (!songId) throw new Error('缺少歌曲 ID');
  const finalQuality = pickQuality(quality, ['128k', '320k']);
  const request = await httpJson(`${HUIBQ_API_URL}/url/${normalizeSourceId(source)}/${encodeURIComponent(songId)}/${encodeURIComponent(finalQuality)}`, {
    method: 'GET',
    headers: {
      'Content-Type': 'application/json',
      'User-Agent': `Songloft-GoMusicJS/${PLUGIN_VERSION}`,
      'X-Request-Key': HUIBQ_API_KEY,
    },
  }, 20000);
  const body = request.body;
  if (!body || isNaN(Number(body.code))) throw new Error('unknow error');
  switch (Number(body.code)) {
    case 0:
      return body.url;
    case 1:
      throw new Error('block ip');
    case 2:
      throw new Error('get music url failed');
    case 4:
      throw new Error('internal server error');
    case 5:
      throw new Error('too many requests');
    case 6:
      throw new Error('param error');
    default:
      throw new Error(body.msg ?? 'unknow error');
  }
}

async function resolveNeteaseNativeUrl(songInfo: Record<string, unknown>, quality: string): Promise<string> {
  const songId = firstText(songInfo.id, songInfo.musicId, songInfo.songmid);
  if (!songId) throw new Error('缺少歌曲 ID');
  const br = String(quality || '').includes('128') ? '128000' : '320000';
  const cookies = await getCookies().catch(() => ({} as Record<string, string>));
  const cookie = firstText(cookies.netease, cookies.wy);
  const raw = await fetchText(`https://music.163.com/api/song/enhance/player/url?id=${encodeURIComponent(songId)}&ids=%5B${encodeURIComponent(songId)}%5D&br=${br}`, {
    Referer: 'https://music.163.com',
    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
    ...(cookie ? { Cookie: cookie } : {}),
  });
  const data = JSON.parse(raw);
  const item = Array.isArray(data?.data) ? data.data[0] : null;
  const url = firstText(item?.url);
  if (url && Number(item?.code || 0) === 200) return url;
  throw new Error(firstText(item?.freeTrialInfo?.message, item?.message, `netease url unavailable (${item?.code || 'empty'})`));
}

async function resolveQQNativeUrl(songInfo: Record<string, unknown>, quality: string): Promise<string> {
  const songmid = firstText(songInfo.songmid, songInfo.id);
  if (!songmid) throw new Error('qq songmid is required');
  const guid = String(Math.floor(Math.random() * 9000000000) + 1000000000);
  const high = !String(quality || '').includes('128');
  const prefixes = high ? ['M800', 'M500'] : ['M500', 'M800'];
  const exts = prefixes.map(() => 'mp3');
  const filenames = prefixes.map((prefix, index) => `${prefix}${songmid}${songmid}.${exts[index]}`);
  const reqData = {
    comm: {
      cv: 4747474,
      ct: 24,
      format: 'json',
      inCharset: 'utf-8',
      outCharset: 'utf-8',
      notice: 0,
      platform: 'yqq.json',
      needNewCode: 1,
      uin: 0,
    },
    req_1: {
      module: 'music.vkey.GetVkey',
      method: 'UrlGetVkey',
      param: {
        guid,
        songmid: prefixes.map(() => songmid),
        songtype: prefixes.map(() => 0),
        uin: '0',
        loginflag: 1,
        platform: '20',
        filename: filenames,
      },
    },
  };
  const cookies = await getCookies().catch(() => ({} as Record<string, string>));
  const cookie = firstText(cookies.qq, cookies.tx);
  const request = await httpJson('https://u.y.qq.com/cgi-bin/musicu.fcg', {
    method: 'POST',
    headers: {
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
      Referer: 'http://y.qq.com',
      'Content-Type': 'application/json',
      ...(cookie ? { Cookie: cookie } : {}),
    },
    body: JSON.stringify(reqData),
  }, 15000);
  const infos = Array.isArray(request.body?.req_1?.data?.midurlinfo) ? request.body.req_1.data.midurlinfo : [];
  for (const filename of filenames) {
    const item = infos.find((info: any) => info?.filename === filename && info?.purl);
    if (item?.purl) return `https://ws.stream.qqmusic.qq.com/${item.purl}`;
  }
  const first = infos[0] || {};
  throw new Error(firstText(first.tips, first.errtype, `qq url unavailable (${first.result || first.subcode || 'empty'})`));
}

async function resolveKugouNativeUrl(songInfo: Record<string, unknown>): Promise<string> {
  const hash = firstText(songInfo.hash, songInfo.id);
  if (!hash) throw new Error('kugou hash is required');
  const raw = await fetchText(`http://m.kugou.com/app/i/getSongInfo.php?cmd=playInfo&hash=${encodeURIComponent(hash)}`, {
    'User-Agent': 'Mozilla/5.0 (iPhone; CPU iPhone OS 13_2_3 like Mac OS X) AppleWebKit/605.1.15 Mobile/15E148 Safari/604.1',
    Referer: 'http://m.kugou.com',
  });
  const data = JSON.parse(raw);
  const url = firstText(data?.url, Array.isArray(data?.backup_url) ? data.backup_url[0] : '');
  if (url) return String(url).replace(/\\\//g, '/');
  throw new Error(firstText(data?.error, `kugou url unavailable (${data?.errcode ?? data?.status ?? 'empty'})`));
}

async function resolveNativeUrl(source: string, songInfo: Record<string, unknown>, quality: string): Promise<string> {
  if (source === 'wy') return resolveNeteaseNativeUrl(songInfo, quality);
  if (source === 'tx') return resolveQQNativeUrl(songInfo, quality);
  if (source === 'kg') return resolveKugouNativeUrl(songInfo);
  if (source === 'kw') return resolveKwNativeUrl(songInfo, quality);
  throw new Error(`native resolver unavailable for ${source}`);
}

function kuwoQualityOrder(requestedQuality: string): string[] {
  const q = String(requestedQuality || '').toLowerCase();
  if (q.includes('flac') || q.includes('lossless')) return ['2000kflac', 'flac', '320kmp3', '128kmp3'];
  if (q.includes('128')) return ['128kmp3', '320kmp3'];
  return ['320kmp3', '128kmp3', 'flac', '2000kflac'];
}

async function resolveKwNativeUrl(songInfo: Record<string, unknown>, quality: string): Promise<string> {
  const extra = parseExtra(songInfo.extra) || {};
  const songId = firstText(extra.rid, resolveSongId(songInfo)).replace(/^MUSIC_/i, '');
  if (!songId) throw new Error('缺少歌曲 ID');

  let lastError: Error | null = null;
  for (const br of kuwoQualityOrder(quality)) {
    const randomId = `C_APK_guanwang_${Date.now()}${Math.floor(Math.random() * 1000000)}`;
    const params = new URLSearchParams({
      f: 'web',
      source: 'kwplayercar_ar_6.0.0.9_B_jiakong_vh.apk',
      from: 'PC',
      type: 'convert_url_with_sign',
      br,
      rid: songId,
      user: randomId,
    });
    try {
      const request = await httpJson(`https://mobi.kuwo.cn/mobi.s?${params.toString()}`, {
        method: 'GET',
        headers: {
          'User-Agent': 'Mozilla/5.0 (Linux; Android 9; Pixel) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/134.0.0.0 Mobile Safari/537.36',
          'X-Forwarded-For': `223.104.${Math.floor(Math.random() * 200) + 1}.${Math.floor(Math.random() * 200) + 1}`,
          'Client-IP': `223.104.${Math.floor(Math.random() * 200) + 1}.${Math.floor(Math.random() * 200) + 1}`,
        },
      }, 15000);
      const body = request.body;
      const url = firstText(body?.data?.url, body?.url);
      if (url && /^https?:\/\//i.test(url)) return url;
      lastError = new Error(firstText(body?.msg, body?.message, `kuwo native url missing for ${br}`));
    } catch (error: any) {
      lastError = error instanceof Error ? error : new Error(String(error));
    }
  }
  throw lastError || new Error('kuwo native url missing');
}

function buildSongInfoFromSong(song: GoMusicSong): Record<string, unknown> {
  const extra = song.extra || {};
  const id = song.id || '';
  return {
    name: song.name || '',
    singer: song.artist || '',
    album: song.album || '',
    source: song.source || '',
    musicId: id,
    songmid: extra.songmid || id,
    hash: extra.hash || id,
    copyrightId: extra.copyrightId || id,
    strMediaMid: extra.strMediaMid || '',
    albumMid: extra.albumMid || '',
    albumId: song.album_id || extra.albumId || '',
    duration: song.duration || 0,
    cover: song.cover || '',
    extra,
  };
}

function sourceDataToSongInfo(sourceData: SourceData): Record<string, unknown> {
  const extra = parseExtra(sourceData.extra) || {};
  const id = asString(sourceData.id);
  return {
    name: sourceData.name || '',
    singer: sourceData.artist || '',
    album: sourceData.album || '',
    source: sourceData.source || '',
    musicId: id,
    songmid: extra.songmid || id,
    hash: extra.hash || id,
    copyrightId: extra.copyrightId || id,
    strMediaMid: extra.strMediaMid || '',
    albumMid: extra.albumMid || '',
    albumId: sourceData.album_id || extra.albumId || '',
    duration: sourceData.duration || 0,
    cover: sourceData.cover || '',
    extra,
  };
}

function localPlayableURL(sourceData: SourceData): string {
  const extra = parseExtra(sourceData.extra) || {};
  return firstText(
    sourceData.link,
    extra.url,
    extra.audio_url,
    extra.audioUrl,
    extra.stream_url,
    extra.streamUrl,
    extra.file_url,
    extra.fileUrl,
    extra.path,
    extra.file_path,
    extra.filePath
  );
}

function localHostSongId(sourceData: SourceData): string {
  const extra = parseExtra(sourceData.extra) || {};
  return firstText(
    extra.hostSongId,
    extra.host_song_id,
    extra.songId,
    extra.song_id,
    sourceData.id
  );
}

async function hostAssetURL(path: string, existingToken = ''): Promise<string> {
  const token = existingToken || await songloft.plugin.getToken();
  if (!token) return '';
  const sep = path.includes('?') ? '&' : '?';
  return `${path}${sep}access_token=${encodeURIComponent(token)}`;
}

async function hostSongPlayURL(songId: string, token = ''): Promise<string> {
  const id = String(songId || '').trim();
  if (!id || !/^\d+$/.test(id)) return '';
  return hostAssetURL(`/api/v1/songs/${encodeURIComponent(id)}/play`, token);
}

async function hostSongCoverURL(songId: string, token = ''): Promise<string> {
  const id = String(songId || '').trim();
  if (!id || !/^\d+$/.test(id)) return '';
  return hostAssetURL(`/api/v1/songs/${encodeURIComponent(id)}/cover`, token);
}

async function hostPlaylistCoverURL(playlistId: string, token = ''): Promise<string> {
  const id = String(playlistId || '').trim();
  if (!id || !/^\d+$/.test(id)) return '';
  return hostAssetURL(`/api/v1/playlists/${encodeURIComponent(id)}/cover`, token);
}

async function attachLocalSongAssets(songs: GoMusicSong[]): Promise<GoMusicSong[]> {
  const token = await songloft.plugin.getToken();
  const prepared: GoMusicSong[] = [];
  for (const song of songs) {
    if (publicSourceId(song.source) !== 'local') {
      prepared.push(song);
      continue;
    }
    const sourceData = sourceDataFromSong(song);
    const hostSongId = localHostSongId(sourceData);
    const playURL = await hostSongPlayURL(hostSongId, token);
    const coverURL = await hostSongCoverURL(hostSongId, token);
    prepared.push({
      ...song,
      link: playURL || song.link || '',
      cover: coverURL || song.cover || '',
      extra: {
        ...(song.extra || {}),
        ...(hostSongId ? { hostSongId } : {}),
      },
    });
  }
  return prepared;
}

async function attachLocalPlaylistAssets(playlists: GoMusicPlaylist[]): Promise<GoMusicPlaylist[]> {
  const token = await songloft.plugin.getToken();
  const prepared: GoMusicPlaylist[] = [];
  for (const playlist of playlists) {
    if (publicSourceId(playlist.source) !== 'local') {
      prepared.push(playlist);
      continue;
    }
    const coverURL = await hostPlaylistCoverURL(playlist.id, token);
    let trackCount = asNumber(playlist.track_count || 0);
    if (!trackCount) {
      const songs = await bridgePlaylistSongs(playlist.id, 100000).catch(() => null);
      if (Array.isArray(songs)) trackCount = songs.length;
    }
    prepared.push({
      ...playlist,
      cover: coverURL || playlist.cover || '',
      track_count: trackCount,
    });
  }
  return prepared;
}

async function bridgeSongsList(options: Record<string, unknown>): Promise<any[] | null> {
  const bridge = (songloft as any).songs;
  if (!bridge || typeof bridge.list !== 'function') return null;
  const songs = await bridge.list(options);
  return Array.isArray(songs) ? songs : null;
}

async function bridgePlaylistById(id: string): Promise<any | null> {
  const bridge = (songloft as any).playlists;
  if (!bridge || typeof bridge.getById !== 'function') return null;
  return await bridge.getById(Number(id));
}

async function bridgePlaylistSongs(id: string, limit = 100000, offset = 0): Promise<any[] | null> {
  const bridge = (songloft as any).playlists;
  if (!bridge || typeof bridge.getSongs !== 'function') return null;
  const songs = await bridge.getSongs(Number(id), { limit, offset });
  return Array.isArray(songs) ? songs : null;
}

function sourceDataFromSong(song: GoMusicSong): SourceData {
  const source = publicSourceId(song.source);
  const rawExtra = parseExtra(song.extra) || {};
  const embeddedLyric = extractEmbeddedLyricFromAny(song as unknown as Record<string, unknown>, rawExtra);
  const cover = firstText(normalizeCoverUrl(source, song.cover), pickCover(rawExtra, source));
  return {
    provider: 'go-music-js',
    source,
    id: song.id,
    name: song.name,
    artist: song.artist || '',
    album: song.album || '',
    album_id: song.album_id || '',
    cover,
    duration: song.duration || 0,
    size: song.size || 0,
    bitrate: song.bitrate || 0,
    ext: song.ext || '',
    link: song.link || '',
    extra: {
      ...rawExtra,
      ...(cover && !rawExtra.cover ? { cover } : {}),
      ...(embeddedLyric ? { lyric: embeddedLyric } : {}),
    },
  };
}

function sourceDataFromAny(value: unknown): SourceData | null {
  if (!value) return null;
  try {
    const parsed = typeof value === 'string' ? JSON.parse(value) : value;
    const data = parsed as Partial<SourceData> & { source?: string; id?: string; provider?: string };
    if (!data || typeof data !== 'object') return null;
    const dataAny = data as Record<string, unknown>;
    if (!data.source || !data.id) return null;
    const rawExtra = parseExtra(data.extra) || {};
    const source = publicSourceId(data.source);
    const embeddedLyric = extractEmbeddedLyricFromAny(dataAny, rawExtra);
    return {
      provider: data.provider || 'go-music-js',
      source,
      id: firstText(data.id, pickSongId(dataAny)),
      name: firstText(data.name, pickSongName(dataAny)),
      artist: firstText(data.artist, pickArtist(dataAny)),
      album: firstText(data.album, pickAlbum(dataAny)),
      album_id: firstText(data.album_id, pickAlbumId(dataAny)),
      cover: firstText(normalizeCoverUrl(source, data.cover), pickCover(dataAny, source), pickCover(rawExtra, source)),
      duration: data.duration || 0,
      size: data.size || 0,
      bitrate: data.bitrate || 0,
      ext: data.ext || '',
      link: data.link || '',
      extra: {
        ...rawExtra,
        ...(embeddedLyric ? { lyric: embeddedLyric } : {}),
      },
    };
  } catch {
    return null;
  }
}

function buildLyricProxyURL(data: SourceData): string {
  const query: string[] = [];
  for (const [key, value] of Object.entries({
    source: data.source,
    id: data.id,
    name: data.name,
    artist: data.artist,
    album: data.album,
    duration: data.duration,
    extra: data.extra ? JSON.stringify(data.extra) : '',
  })) {
    if (value !== undefined && value !== null && value !== '') {
      query.push(`${encodeURIComponent(key)}=${encodeURIComponent(String(value))}`);
    }
  }
  return `/api/v1/jsplugin/${ENTRY_PATH}/api/direct/lyric?${query.join('&')}`;
}

async function callHostAPI<T = unknown>(method: string, path: string, body?: unknown): Promise<T> {
  const hostUrl = await songloft.plugin.getHostUrl();
  if (!hostUrl) throw new Error('Host URL not available');

  const token = await songloft.plugin.getToken();
  if (!token) throw new Error('Plugin token not available');

  const headers: Record<string, string> = { Authorization: `Bearer ${token}`, Accept: 'application/json' };
  let bodyText: string | undefined;
  if (body !== undefined) {
    headers['Content-Type'] = 'application/json';
    bodyText = JSON.stringify(body);
  }

  const response = await fetch(hostUrl + path, { method, headers, body: bodyText });
  const text = await response.text();
  if (!response.ok) throw new Error(`Host API ${response.status}: ${text}`);
  return text ? (JSON.parse(text) as T) : (undefined as T);
}

function hostListFromResponse(response: any): any[] {
  if (Array.isArray(response)) return response;
  for (const key of ['songs', 'tracks', 'items', 'data', 'results']) {
    if (Array.isArray(response?.[key])) return response[key];
  }
  return [];
}

function hostTotalFromResponse(response: any, fallback: number): number {
  return asNumber(response?.total || response?.count || response?.total_count || response?.totalCount || fallback);
}

async function callHostPaged(path: string, pageSize = 500): Promise<{ items: any[]; total: number }> {
  const firstSep = path.includes('?') ? '&' : '?';
  const first = await callHostAPI<any>('GET', `${path}${firstSep}page=1&page_size=${pageSize}&limit=${pageSize}`);
  const firstItems = hostListFromResponse(first);
  const total = hostTotalFromResponse(first, firstItems.length);
  const items = [...firstItems];
  const totalPages = total > pageSize ? Math.ceil(total / pageSize) : 1;
  for (let page = 2; page <= totalPages && page <= 20; page++) {
    const sep = path.includes('?') ? '&' : '?';
    const next = await callHostAPI<any>('GET', `${path}${sep}page=${page}&page_size=${pageSize}&limit=${pageSize}`);
    const nextItems = hostListFromResponse(next);
    if (!nextItems.length) break;
    items.push(...nextItems);
  }
  return { items, total: total || items.length };
}

async function resolveImportLyric(sourceData: SourceData): Promise<{ lyric_source: string; lyric: string; lyric_remote_url?: string }> {
  const remoteURL = buildLyricProxyURL(sourceData);
  const sourceId = normalizeSourceId(sourceData.source);
  const sourceExtra = parseExtra(sourceData.extra) || {};
  const embeddedLyric = extractEmbeddedLyricFromAny(sourceData as unknown as Record<string, unknown>, sourceExtra);
  if (embeddedLyric) return { lyric_source: 'embedded', lyric: repairUtf8Mojibake(embeddedLyric) };
  const songInfo: Record<string, unknown> = {
    ...sourceExtra,
    source: sourceData.source,
    id: sourceData.id,
    name: sourceData.name,
    artist: sourceData.artist,
    album: sourceData.album,
    duration: sourceData.duration,
  };
  const id = firstText(songInfo.id, sourceData.id);
  if (id) {
    if (!songInfo.musicId) songInfo.musicId = id;
    if (!songInfo.songmid) songInfo.songmid = id;
    if (!songInfo.hash) songInfo.hash = id;
    if (!songInfo.copyrightId) songInfo.copyrightId = id;
  }

  try {
    let result: Record<string, string> = { lyric: '' };
    if (sourceId === 'soda') {
      result = { lyric: await qishuiGetLyricV2(songInfo) };
    } else {
      result = await directPlatformLyric(sourceId, songInfo);
      if (!result.lyric && !['wy', 'tx', 'kg', 'kw', 'mg'].includes(sourceId)) {
        const fetcher = registry.getLyricFetcher(sourceId);
        if (fetcher) result = await fetcher.getLyric(songInfo);
      }
    }
    const lyric = firstText(result.lyric, result.lxlyric, result.tlyric, result.rlyric);
    if (lyric) return { lyric_source: 'embedded', lyric };
  } catch {
    // Lyric lookup should never prevent adding a song to Songloft.
  }

  return { lyric_source: 'url', lyric: remoteURL, lyric_remote_url: remoteURL };
}

async function resolveImportCover(sourceData: SourceData): Promise<string> {
  const source = publicSourceId(sourceData.source);
  const extra = parseExtra(sourceData.extra) || {};
  const existing = firstText(normalizeCoverUrl(source, sourceData.cover), pickCover(extra, source));
  if (existing) return existing;

  const id = firstText(sourceData.id, extra.musicId, extra.songmid, extra.hash, extra.copyrightId);
  const cacheKey = `${source}:${id || sourceData.name}:${sourceData.artist || ''}`;
  const cached = getTimedCache(importCoverCache, cacheKey);
  if (cached !== undefined) return cached;
  if (source === 'kuwo' && id) {
    const directCover = await fetchKuwoSongCoverById(id).catch(() => '');
    if (directCover) {
      setTimedCache(importCoverCache, cacheKey, directCover, COVER_CACHE_TTL_MS);
      return directCover;
    }
  }

  const keyword = sourceData.artist ? `${sourceData.name} ${sourceData.artist}` : sourceData.name;
  if (!keyword) return '';
  try {
    const searched = await searchOneSource(source, keyword, 1, 8);
    const sameId = searched.songs.find((candidate) => String(candidate.id) === String(sourceData.id) && candidate.cover);
    if (sameId?.cover) return sameId.cover;
    const songInfo = sourceDataToSongInfo(sourceData);
    const ranked = searched.songs
      .map((candidate) => ({ candidate, score: scoreLyricCandidate(songInfo, candidate) }))
      .filter((item) => item.candidate.cover && item.score >= 85)
      .sort((a, b) => b.score - a.score)[0]?.candidate;
    const cover = firstText(ranked?.cover, searched.songs.find((candidate) => !!candidate.cover)?.cover);
    setTimedCache(importCoverCache, cacheKey, cover, COVER_CACHE_TTL_MS);
    return cover;
  } catch {
    setTimedCache(importCoverCache, cacheKey, '', 60 * 1000);
    return '';
  }
}

async function importSongs(request: ImportSongsRequest): Promise<Record<string, unknown>> {
  if (!Array.isArray(request.songs) || request.songs.length === 0) {
    throw new Error('source_data is required');
  }

  const batch: any[] = [];
  for (const rawSong of request.songs) {
    if (!rawSong?.id || !rawSong?.source || !rawSong?.name) continue;
    const song = rawSong;
    const sourceData = sourceDataFromSong(song);
    const coverURL = await resolveImportCover(sourceData);
    const completedExtra = parseExtra(sourceData.extra) || {};
    if (coverURL && !completedExtra.cover) completedExtra.cover = coverURL;
    let completedSourceData: SourceData = {
      ...sourceData,
      cover: coverURL || sourceData.cover || '',
      extra: completedExtra,
    };
    const lyricData = await resolveImportLyric(completedSourceData);
    if (lyricData.lyric_source === 'embedded' && lyricData.lyric && !String(lyricData.lyric).startsWith('/api/')) {
      completedSourceData = {
        ...completedSourceData,
        extra: {
          ...(parseExtra(completedSourceData.extra) || {}),
          lyric: lyricData.lyric,
        },
      };
    }
    batch.push({
      title: song.name,
      artist: song.artist || '',
      album: song.album || '',
      cover_url: coverURL || song.cover || '',
      duration: song.duration || 0,
      plugin_entry_path: ENTRY_PATH,
      source_data: JSON.stringify(completedSourceData),
      dedup_key: `${song.source}:${song.id}`,
      ...lyricData,
    });
  }
  if (batch.length === 0) throw new Error('没有可导入的歌曲');

  const addResp = await callHostAPI<{ songs?: Array<{ id: number }> }>('POST', '/api/v1/songs/remote', batch);
  const importedSongIDs = (addResp.songs || []).map((s) => s.id).filter((id) => id > 0);

  let playlistID = request.playlist_id || 0;
  let playlistName = '';
  let playlistError: Record<string, string> | null = null;

  if (request.new_playlist_name) {
    try {
      const playlist = await callHostAPI<{ id: number; name: string }>('POST', '/api/v1/playlists', {
        name: request.new_playlist_name,
        type: 'normal',
      });
      playlistID = playlist.id;
      playlistName = playlist.name;
    } catch (error: any) {
      const msg = error?.message || String(error);
      playlistError = {
        code: /409/.test(msg) ? 'name_conflict' : 'unknown',
        message: /409/.test(msg) ? '歌单名称已存在' : msg,
      };
    }
  }

  if (playlistID > 0 && importedSongIDs.length > 0) {
    await callHostAPI('POST', `/api/v1/playlists/${playlistID}/songs`, { song_ids: importedSongIDs });
  }

  return {
    total: request.songs.length,
    success: batch.length,
    failed: request.songs.length - batch.length,
    song_ids: importedSongIDs,
    playlist_id: playlistID,
    playlist_name: playlistName,
    playlist_error: playlistError,
  };
}

async function serveIndex(): Promise<HTTPResponse> {
  const pluginApi = songloft.plugin as any;
  return textResponse(await pluginApi.readFile('static/index.html'), 'text/html; charset=utf-8');
}

async function searchOneSource(source: string, keyword: string, page: number, pageSize: number): Promise<{ songs: GoMusicSong[]; total: number }> {
  const publicSource = publicSourceId(source);
  const cacheKey = `${publicSource}:${keyword.trim().toLowerCase()}:${page}:${pageSize}`;
  const cached = getTimedCache(searchResultCache, cacheKey);
  if (cached) return cloneSearchResult(cached);

  const registrySource = normalizeSourceId(source);
  if (registrySource === 'soda') {
    const result = await qishuiSearchV2(keyword, page, pageSize);
    const output = { songs: result.list.map(cloneSong), total: result.total };
    setTimedCache(searchResultCache, cacheKey, cloneSearchResult(output), SEARCH_CACHE_TTL_MS);
    return cloneSearchResult(output);
  }

  if (EXTENDED_SEARCH_SOURCES.has(publicSource)) {
    const result = await extendedSearchSource(publicSource, keyword, page, pageSize);
    const output = { songs: result.songs.map(cloneSong), total: result.total };
    setTimedCache(searchResultCache, cacheKey, cloneSearchResult(output), SEARCH_CACHE_TTL_MS);
    return cloneSearchResult(output);
  }

  const searcher = registry.get(registrySource);
  if (!searcher) throw new Error(`不支持的搜索源: ${source}`);
  const result = await searcher.search(keyword, page, pageSize);
  const rawItems: Record<string, unknown>[] = ((result as any)?.list || (result as any)?.songs || []) as Record<string, unknown>[];
  const songs = rawItems
    .map((item) => normalizeSearchSong(item, publicSource))
    .filter((song) => !!song.name);

  const total = (result as any)?.total ?? rawItems.length;
  const output = { songs, total };
  setTimedCache(searchResultCache, cacheKey, cloneSearchResult(output), SEARCH_CACHE_TTL_MS);
  return cloneSearchResult(output);
}

async function searchManySources(keyword: string, page: number, pageSize: number, sources: string[]): Promise<{ songs: GoMusicSong[]; total: number }> {
  const uniqueSources = Array.from(new Set(sources.filter(Boolean)));
  const settled = await Promise.allSettled(uniqueSources.map((source) => searchOneSource(source, keyword, page, pageSize)));
  const seen = new Set<string>();
  const merged: GoMusicSong[] = [];
  let total = 0;
  const errors: string[] = [];
  let hadSuccess = false;

  settled.forEach((entry, index) => {
    const source = uniqueSources[index];
    if (entry.status === 'fulfilled') {
      hadSuccess = true;
      total += entry.value.total || 0;
      for (const song of entry.value.songs) {
        const key = `${song.source}:${song.id}`;
        if (seen.has(key)) continue;
        seen.add(key);
        merged.push(song);
      }
    } else {
      errors.push(`${source}: ${entry.reason instanceof Error ? entry.reason.message : String(entry.reason)}`);
    }
  });

  if (!hadSuccess && errors.length) throw new Error(errors.join(' | '));
  return { songs: merged, total: total || merged.length };
}

function summarizePage(total: number, page: number, pageSize: number, count: number): { totalPages: number; pageStart: number; pageEnd: number } {
  const safePage = page > 0 ? page : 1;
  const totalPages = total > 0 ? Math.max(1, Math.ceil(total / Math.max(pageSize, 1))) : 0;
  const pageStart = total > 0 ? (safePage - 1) * pageSize + 1 : 0;
  const pageEnd = total > 0 ? Math.min(total, pageStart + count - 1) : 0;
  return { totalPages, pageStart, pageEnd };
}

async function handleSearch(req: HTTPRequest): Promise<HTTPResponse> {
  const query = parseQuery(req.query || '');
  const body = req.method === 'POST' ? parseBody(req) : {};

  const keyword = String(body.keyword || body.q || query.keyword || query.q || '').trim();
  const searchType = String(body.type || query.type || 'song').trim();
  const page = asNumber(body.page || query.page || 1) || 1;
  const pageSize = asNumber(body.page_size || body.limit || query.page_size || query.limit || 30) || 30;
  const requestedSources = [
    ...getQueryValues(String(req.query || ''), 'sources'),
    ...(Array.isArray(body.sources) ? body.sources.map(String) : []),
    ...(typeof body.sources === 'string' ? String(body.sources).split(',').map((item) => item.trim()).filter(Boolean) : []),
  ];
  const defaultSources = await getSelectedSources();
  const sources = requestedSources.length
    ? requestedSources
    : defaultSources.length
      ? defaultSources
      : SOURCE_META.map((item) => item.id);

  if (!keyword) return errorResponse(400, '缺少 keyword');

  try {
    const result = await searchManySources(keyword, page, pageSize, sources);
    const summary = summarizePage(result.total, page, pageSize, result.songs.length);
    return successResponse({
      type: searchType === 'playlist' || searchType === 'album' ? 'song' : 'song',
      songs: result.songs,
      playlists: [],
      albums: [],
      total: result.total,
      page,
      page_size: pageSize,
      total_pages: summary.totalPages,
      page_start: summary.pageStart,
      page_end: summary.pageEnd,
      results: result.songs.map((song) => ({
        title: song.name,
        artist: song.artist,
        album: song.album,
        duration: song.duration || 0,
        cover_url: song.cover || '',
        source_data: {
          provider: 'go-music-js',
          ...sourceDataFromSong(song),
        },
      })),
    });
  } catch (error: any) {
    return errorResponse(500, error?.message || String(error));
  }
}

async function handleMusicUrl(req: HTTPRequest): Promise<HTTPResponse> {
  const body = parseBody(req);
  const sourceData = sourceDataFromAny(body.source_data) || sourceDataFromAny(body);
  if (!sourceData) return errorResponse(400, 'source_data is required');

  try {
    const songInfo = sourceDataToSongInfo(sourceData);
    const quality = String(body.type || body.quality || '320k');
    const source = normalizeSourceId(sourceData.source);
    const localHostURL = source === 'local' ? await hostSongPlayURL(localHostSongId(sourceData)) : '';
    const rawLocalURL = source === 'local' ? localPlayableURL(sourceData) : '';
    const localURL = localHostURL || (/^https?:\/\//i.test(rawLocalURL) ? rawLocalURL : '');
    const url = localURL
      ? localURL
      : source === 'soda'
      ? await qishuiGetUrlV2(songInfo, quality)
      : EXTENDED_SEARCH_SOURCES.has(publicSourceId(source))
      ? await resolveExtendedUrl(publicSourceId(source), songInfo)
      : ['wy', 'tx', 'kg', 'kw'].includes(source)
      ? await resolveNativeUrl(source, songInfo, quality).catch(() => resolveHuibqUrl(source, songInfo, quality))
      : await resolveHuibqUrl(source, songInfo, quality);
    return jsonResponse({ url, source_data: sourceData, type: quality, source }, 200);
  } catch (error: any) {
    return errorResponse(502, '获取音乐地址失败: ' + (error?.message || String(error)));
  }
}

async function handleSodaPlay(req: HTTPRequest): Promise<HTTPResponse> {
  const query = parseQuery(req.query || '');
  const targetURL = asString(query.url || '').trim();
  const playAuth = asString(query.auth || '').trim();
  if (!targetURL) return errorResponse(400, '缺少代理 URL');
  if (!playAuth) return errorResponse(400, '缺少汽水音频解密参数');

  try {
    const cookies = await getCookies();
    const cookie = String(cookies.soda || '').trim();
    const sourceHeaders: Record<string, string> = {
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/134.0.0.0 Safari/537.36',
    };
    if (cookie) sourceHeaders.Cookie = cookie;
    const response = await fetchWithTimeout(targetURL, {
      headers: sourceHeaders,
    }, 60000);
    if (!response.ok) throw new Error(`qishui audio HTTP ${response.status}`);
    const encrypted = await responseBytes(response);
    const decrypted = await qishuiDecryptAudio(encrypted, playAuth);
    const ext = qishuiDetectAudioExt(decrypted);
    const contentType = audioMimeByExt(ext);
    const requestHeaders = ((req as any).headers || {}) as Record<string, string>;
    const rangeHeader = asString(
      requestHeaders.range ||
      requestHeaders.Range ||
      (typeof (requestHeaders as any).get === 'function' ? (requestHeaders as any).get('range') : '')
    );
    const total = decrypted.byteLength;
    const match = /^bytes=(\d*)-(\d*)$/i.exec(rangeHeader.trim());
    if (match) {
      let start = match[1] ? Number(match[1]) : 0;
      let end = match[2] ? Number(match[2]) : total - 1;
      if (!Number.isFinite(start) || start < 0) start = 0;
      if (!Number.isFinite(end) || end >= total) end = total - 1;
      if (start > end || start >= total) {
        return {
          statusCode: 416,
          headers: {
            'Content-Range': `bytes */${total}`,
            'Accept-Ranges': 'bytes',
          },
          body: '',
        };
      }
      const chunk = decrypted.slice(start, end + 1);
      return {
        statusCode: 206,
        headers: {
          'Content-Type': contentType,
          'Content-Length': String(chunk.byteLength),
          'Content-Range': `bytes ${start}-${end}/${total}`,
          'Accept-Ranges': 'bytes',
          'Cache-Control': 'no-store',
        },
        body: chunk as any,
      };
    }
    return {
      statusCode: 200,
      headers: {
        'Content-Type': contentType,
        'Content-Length': String(decrypted.byteLength),
        'Cache-Control': 'no-store',
        'Accept-Ranges': 'bytes',
      },
      body: decrypted as any,
    };
  } catch (error: any) {
    return errorResponse(502, '获取音乐地址失败: ' + (error?.message || String(error)));
  }
}

async function handleSodaRaw(req: HTTPRequest): Promise<HTTPResponse> {
  const query = parseQuery(req.query || '');
  const targetURL = asString(query.url || '').trim();
  if (!targetURL) return errorResponse(400, '缺少代理 URL');
  try {
    const cookies = await getCookies();
    const cookie = String(cookies.soda || '').trim();
    const headers: Record<string, string> = {
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/134.0.0.0 Safari/537.36',
    };
    if (cookie) headers.Cookie = cookie;
    const response = await fetchWithTimeout(targetURL, { headers }, 60000);
    if (!response.ok) throw new Error(`qishui audio HTTP ${response.status}`);
    const encrypted = await responseBytes(response);
    return {
      statusCode: 200,
      headers: {
        'Content-Type': 'application/octet-stream',
        'Content-Length': String(encrypted.byteLength),
        'Cache-Control': 'no-store',
      },
      body: encrypted as any,
    };
  } catch (error: any) {
    return errorResponse(502, '获取音乐地址失败: ' + (error?.message || String(error)));
  }
}

async function handleDirectPlay(req: HTTPRequest): Promise<HTTPResponse> {
  const query = parseQuery(req.query || '');
  const source = publicSourceId(asString(query.source || '').trim());
  const targetURL = asString(query.url || '').trim();
  if (!targetURL || !/^https?:\/\//i.test(targetURL)) return errorResponse(400, '缂哄皯浠ｇ悊 URL');

  try {
    const requestHeaders = ((req as any).headers || {}) as Record<string, string>;
    const rangeHeader = asString(
      requestHeaders.range ||
      requestHeaders.Range ||
      (typeof (requestHeaders as any).get === 'function' ? (requestHeaders as any).get('range') : '')
    );
    const cookies = await getCookies().catch(() => ({} as Record<string, string>));
    const headers: Record<string, string> = {
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
    };
    if (rangeHeader) headers.Range = rangeHeader;
    if (source === 'bilibili') {
      headers.Referer = 'https://www.bilibili.com/';
      const cookie = cookieForSource(cookies, 'bilibili');
      if (cookie) headers.Cookie = cookie;
    } else if (source === 'joox') {
      headers.Cookie = JOOX_COOKIE;
      headers['X-Forwarded-For'] = JOOX_XFF;
    }

    const response = await fetchWithTimeout(targetURL, { headers }, 60000);
    if (!response.ok && response.status !== 206) throw new Error(`direct audio HTTP ${response.status}`);
    const bytes = await responseBytes(response);
    const outHeaders: Record<string, string> = {
      'Content-Type': response.headers.get('content-type') || 'application/octet-stream',
      'Content-Length': response.headers.get('content-length') || String(bytes.byteLength),
      'Cache-Control': 'no-store',
      'Accept-Ranges': response.headers.get('accept-ranges') || 'bytes',
    };
    const contentRange = response.headers.get('content-range');
    if (contentRange) outHeaders['Content-Range'] = contentRange;
    return {
      statusCode: response.status === 206 ? 206 : 200,
      headers: outHeaders,
      body: bytes as any,
    };
  } catch (error: any) {
    return errorResponse(502, '鑾峰彇闊充箰鍦板潃澶辫触: ' + (error?.message || String(error)));
  }
}

function decodeBase64Text(value: unknown): string {
  const text = firstText(value);
  if (!text) return '';
  try {
    return __go_buffer_to_string(__go_buffer_from(text, 'base64'), 'utf8');
  } catch {
    return '';
  }
}

function cjkCharCount(value: string): number {
  let count = 0;
  for (let i = 0; i < value.length; i += 1) {
    const code = value.charCodeAt(i);
    if (code >= 0x3400 && code <= 0x9fff) count += 1;
  }
  return count;
}

function decodeUtf8Bytes(bytes: number[]): string {
  let output = '';
  for (let i = 0; i < bytes.length;) {
    const b0 = bytes[i++] || 0;
    if (b0 < 0x80) {
      output += String.fromCharCode(b0);
      continue;
    }
    if ((b0 & 0xe0) === 0xc0 && i < bytes.length) {
      const b1 = bytes[i++] || 0;
      output += String.fromCharCode(((b0 & 0x1f) << 6) | (b1 & 0x3f));
      continue;
    }
    if ((b0 & 0xf0) === 0xe0 && i + 1 < bytes.length) {
      const b1 = bytes[i++] || 0;
      const b2 = bytes[i++] || 0;
      output += String.fromCharCode(((b0 & 0x0f) << 12) | ((b1 & 0x3f) << 6) | (b2 & 0x3f));
      continue;
    }
    if ((b0 & 0xf8) === 0xf0 && i + 2 < bytes.length) {
      const b1 = bytes[i++] || 0;
      const b2 = bytes[i++] || 0;
      const b3 = bytes[i++] || 0;
      const codePoint = ((b0 & 0x07) << 18) | ((b1 & 0x3f) << 12) | ((b2 & 0x3f) << 6) | (b3 & 0x3f);
      output += String.fromCodePoint(codePoint);
      continue;
    }
    output += String.fromCharCode(b0);
  }
  return output;
}

function stringToLowBytes(value: string): number[] {
  const bytes: number[] = [];
  for (let i = 0; i < value.length; i += 1) bytes.push(value.charCodeAt(i) & 0xff);
  return bytes;
}

function uint8ArrayToNumbers(value: Uint8Array): number[] {
  const bytes: number[] = [];
  for (let i = 0; i < value.length; i += 1) bytes.push(value[i] || 0);
  return bytes;
}

function repairUtf8Mojibake(value: string): string {
  if (!value) return value;
  try {
    let best = value;
    let bestScore = cjkCharCount(value);
    let current = value;
    for (let i = 0; i < 3; i += 1) {
      current = decodeUtf8Bytes(stringToLowBytes(current));
      const score = cjkCharCount(current);
      if (score > bestScore) {
        best = current;
        bestScore = score;
      }
      if (!/[\u00c0-\u00ff][\u0080-\u00bf]/.test(current)) break;
    }
    return best;
  } catch {
    return value;
  }
}

function repairLyricResult<T extends Record<string, string>>(result: T): T {
  return {
    ...result,
    lyric: repairUtf8Mojibake(result.lyric || ''),
    tlyric: repairUtf8Mojibake(result.tlyric || ''),
    rlyric: repairUtf8Mojibake(result.rlyric || ''),
    lxlyric: repairUtf8Mojibake(result.lxlyric || ''),
  };
}

async function fetchText(url: string, headers: Record<string, string> = {}): Promise<string> {
  const mergedHeaders = Object.assign({ 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36' }, headers || {});
  const response = await fetch(url, { method: 'GET', headers: mergedHeaders });
  const text = await response.text();
  if (!response.ok) throw new Error(`HTTP ${response.status}: ${text.slice(0, 300)}`);
  return text;
}

async function fetchUtf8Text(url: string, headers: Record<string, string> = {}): Promise<string> {
  const mergedHeaders = Object.assign({ 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36' }, headers || {});
  const response = await fetch(url, { method: 'GET', headers: mergedHeaders });
  const bytes = await responseBytes(response);
  const text = decodeUtf8Bytes(uint8ArrayToNumbers(bytes));
  if (!response.ok) throw new Error(`HTTP ${response.status}: ${text.slice(0, 300)}`);
  return text;
}

async function postFormText(url: string, data: Record<string, string>, headers: Record<string, string> = {}): Promise<string> {
  const mergedHeaders = Object.assign({
    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
    'Content-Type': 'application/x-www-form-urlencoded',
  }, headers || {});
  const body = Object.keys(data).map((key) => `${encodeURIComponent(key)}=${encodeURIComponent(data[key] || '')}`).join('&');
  const response = await fetch(url, { method: 'POST', headers: mergedHeaders, body });
  const text = await response.text();
  if (!response.ok) throw new Error(`HTTP ${response.status}: ${text.slice(0, 300)}`);
  return text;
}

async function directWyLyric(songInfo: Record<string, unknown>): Promise<Record<string, string>> {
  const musicId = firstText(songInfo.musicId, songInfo.id, songInfo.songmid);
  if (!musicId) return { lyric: '' };
  const raw = await fetchText(`https://music.163.com/api/song/lyric?id=${encodeURIComponent(musicId)}&lv=-1&kv=-1&tv=-1`, {
    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
    Referer: 'https://music.163.com',
  });
  const data = JSON.parse(raw);
  return {
    lyric: firstText(data?.lrc?.lyric),
    tlyric: firstText(data?.tlyric?.lyric),
    rlyric: firstText(data?.romalrc?.lyric),
  };
}

async function directTxLyric(songInfo: Record<string, unknown>): Promise<Record<string, string>> {
  const songmid = firstText(songInfo.songmid, songInfo.id);
  if (!songmid) return { lyric: '' };
  const raw = await fetchText(`https://c.y.qq.com/lyric/fcgi-bin/fcg_query_lyric_new.fcg?songmid=${encodeURIComponent(songmid)}&g_tk=5381&loginUin=0&hostUin=0&format=json&inCharset=utf8&outCharset=utf-8&platform=yqq`, {
    Referer: 'https://y.qq.com/portal/player.html',
  });
  const data = JSON.parse(raw);
  return {
    lyric: decodeBase64Text(data?.lyric),
    tlyric: decodeBase64Text(data?.trans),
  };
}

async function directKgLyric(songInfo: Record<string, unknown>): Promise<Record<string, string>> {
  const hash = firstText(songInfo.hash, songInfo.id);
  if (!hash) return { lyric: '' };
  const name = firstText(songInfo.name);
  const singer = firstText(songInfo.singer, songInfo.artist);
  const duration = asNumber(songInfo.duration) > 0 ? Math.floor(asNumber(songInfo.duration) * 1000) : 0;
  const searchParams = new URLSearchParams({
    ver: '1',
    man: 'yes',
    client: 'pc',
    keyword: singer ? `${name}-${singer}` : name,
    hash,
    timelength: String(duration),
    lrctxt: '1',
  });
  const headers = {
    'KG-RC': '1',
    'KG-THash': 'expand_search_manager.cpp:852736169:451',
    'User-Agent': 'KuGou2012-9020-ExpandSearchManager',
  };
  const searchRaw = await fetchText(`http://lyrics.kugou.com/search?${searchParams.toString()}`, headers);
  const search = JSON.parse(searchRaw);
  const candidate = Array.isArray(search?.candidates) ? search.candidates[0] : null;
  if (!candidate?.id || !candidate?.accesskey) return { lyric: '' };
  const downloadParams = new URLSearchParams({
    ver: '1',
    client: 'pc',
    id: String(candidate.id),
    accesskey: String(candidate.accesskey),
    fmt: 'lrc',
    charset: 'utf8',
  });
  const downloadRaw = await fetchText(`http://lyrics.kugou.com/download?${downloadParams.toString()}`, headers);
  const download = JSON.parse(downloadRaw);
  return { lyric: decodeBase64Text(download?.content) };
}

async function directKwLyric(songInfo: Record<string, unknown>): Promise<Record<string, string>> {
  const musicId = firstText(songInfo.id, songInfo.musicId, songInfo.songmid);
  if (!musicId) return { lyric: '' };
  const raw = await fetchText(`http://m.kuwo.cn/newh5/singles/songinfoandlrc?musicId=${encodeURIComponent(musicId)}&httpsStatus=1`);
  const data = JSON.parse(raw);
  const list = Array.isArray(data?.data?.lrclist) ? data.data.lrclist : [];
  const lyric = list
    .map((item: any) => {
      const time = Number(item?.time || 0);
      const minute = Math.floor(time / 60);
      const second = time - minute * 60;
      return `[${String(minute).padStart(2, '0')}:${second.toFixed(2).padStart(5, '0')}]${repairUtf8Mojibake(firstText(item?.lineLyric))}`;
    })
    .join('\n');
  return { lyric };
}

async function directMgLyric(songInfo: Record<string, unknown>): Promise<Record<string, string>> {
  let lrcUrl = firstText(songInfo.lrcUrl);
  let mrcUrl = firstText(songInfo.mrcUrl);
  const trcUrl = firstText(songInfo.trcUrl);
  const copyrightId = firstText(songInfo.copyrightId, songInfo.id);
  const headers = {
    Referer: 'https://app.c.nf.migu.cn/',
    'User-Agent': 'Mozilla/5.0 (Linux; Android 5.1.1; Nexus 6 Build/LYZ28E) AppleWebKit/537.36 Chrome/59.0.3071.115 Mobile Safari/537.36',
    channel: '0146921',
  };
  if (!lrcUrl && !mrcUrl && copyrightId) {
    const raw = await postFormText('https://c.musicapp.migu.cn/MIGUM2.0/v1.0/content/resourceinfo.do?resourceType=2', { resourceId: copyrightId }, headers);
    const data = JSON.parse(raw);
    const resource = Array.isArray(data?.resource) ? data.resource[0] : null;
    lrcUrl = firstText(resource?.lrcUrl);
    mrcUrl = firstText(resource?.mrcUrl);
  }
  const lyricUrl = lrcUrl || mrcUrl;
  return {
    lyric: lyricUrl ? await fetchText(lyricUrl, headers) : '',
    tlyric: trcUrl ? await fetchText(trcUrl, headers).catch(() => '') : '',
  };
}

async function directJooxLyric(songInfo: Record<string, unknown>): Promise<Record<string, string>> {
  const extra = parseExtra(songInfo.extra) || {};
  const songId = firstText(extra.songid, songInfo.id, songInfo.musicId);
  if (!songId) return { lyric: '' };
  const params = new URLSearchParams({ musicid: songId, country: 'sg', lang: 'zh_cn' });
  const raw = await fetchText(`https://api.joox.com/web-fcgi-bin/web_lyric?${params.toString()}`, {
    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
    Cookie: JOOX_COOKIE,
    'X-Forwarded-For': JOOX_XFF,
  });
  const text = raw.includes('MusicJsonCallback(') ? raw.replace(/^.*?MusicJsonCallback\(/, '').replace(/\)\s*$/, '') : raw;
  const data = JSON.parse(text);
  return { lyric: decodeBase64Text(data?.lyric) };
}

async function directQianqianLyric(songInfo: Record<string, unknown>): Promise<Record<string, string>> {
  const extra = parseExtra(songInfo.extra) || {};
  const tsid = firstText(extra.tsid, songInfo.id, songInfo.musicId);
  if (!tsid) return { lyric: '' };
  const info = await qianqianSongInfo(tsid);
  const lyricUrl = firstText(info?.lyric, extra.lyric);
  return { lyric: lyricUrl ? await fetchText(lyricUrl, { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36', Referer: QIANQIAN_REFERER }) : '' };
}

async function directFivesingLyric(songInfo: Record<string, unknown>): Promise<Record<string, string>> {
  const extra = parseExtra(songInfo.extra) || {};
  const parts = firstText(songInfo.id, songInfo.musicId).split('|');
  const songid = firstText(extra.songid, parts[0]);
  const songtype = firstText(extra.songtype, parts[1]);
  if (!songid) return { lyric: '' };
  const params = new URLSearchParams({ songid, songtype });
  const res = await httpJson(`http://mobileapi.5sing.kugou.com/song/newget?${params.toString()}`, {
    headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36' },
  }, 15000);
  return { lyric: firstText(res?.body?.data?.dynamicWords) };
}

async function directAppleLyric(songInfo: Record<string, unknown>): Promise<Record<string, string>> {
  const songId = firstText(songInfo.id, songInfo.musicId);
  if (!songId) return { lyric: '' };
  const body = await appleApi(`/v1/catalog/us/songs/${encodeURIComponent(songId)}`, new URLSearchParams({ include: 'lyrics', extend: 'extendedAssetUrls' }));
  const relationships = Array.isArray(body?.data) ? body.data[0]?.relationships : null;
  const list = Array.isArray(relationships?.lyrics?.data) ? relationships.lyrics.data : [];
  const lyric = firstText(...list.map((item: any) => item?.attributes?.text));
  return { lyric };
}

async function directPlatformLyric(source: string, songInfo: Record<string, unknown>): Promise<Record<string, string>> {
  const key = `${source}:${firstText(songInfo.id, songInfo.musicId, songInfo.songmid, songInfo.hash, songInfo.copyrightId)}:${firstText(songInfo.name)}:${firstText(songInfo.artist, songInfo.singer)}`;
  const cached = getTimedCache(lyricCache, key);
  if (cached) return { ...cached };

  let result: Record<string, string>;
  if (source === 'wy') result = await directWyLyric(songInfo);
  else if (source === 'tx') result = await directTxLyric(songInfo);
  else if (source === 'kg') result = await directKgLyric(songInfo);
  else if (source === 'kw') result = await directKwLyric(songInfo);
  else if (source === 'mg') result = await directMgLyric(songInfo);
  else if (source === 'joox') result = await directJooxLyric(songInfo);
  else if (source === 'qianqian') result = await directQianqianLyric(songInfo);
  else if (source === 'fivesing') result = await directFivesingLyric(songInfo);
  else if (source === 'apple') result = await directAppleLyric(songInfo);
  else result = { lyric: '' };

  const repaired = repairLyricResult(result);
  setTimedCache(lyricCache, key, { ...repaired }, lyricResultHasText(repaired) ? LYRIC_CACHE_TTL_MS : 60 * 1000);
  return { ...repaired };
}

function lyricResultHasText(result: Record<string, string>): boolean {
  return !!firstText(result.lyric, result.tlyric, result.rlyric, result.lxlyric);
}

function normalizeLyricMatchText(value: unknown): string {
  return String(value || '')
    .toLowerCase()
    .replace(/\s+/g, '')
    .replace(/[（(].*?[）)]/g, '')
    .replace(/[^\w\u4e00-\u9fff]/g, '');
}

function scoreLyricCandidate(original: Record<string, unknown>, candidate: GoMusicSong): number {
  const originalName = normalizeLyricMatchText(original.name);
  const candidateName = normalizeLyricMatchText(candidate.name);
  const originalArtist = normalizeLyricMatchText(firstText(original.artist, original.singer));
  const candidateArtist = normalizeLyricMatchText(candidate.artist);
  if (!originalName || !candidateName) return -1;
  let score = 0;
  if (candidateName === originalName) score += 100;
  else if (candidateName.includes(originalName) || originalName.includes(candidateName)) score += 55;
  if (originalArtist && candidateArtist) {
    if (candidateArtist === originalArtist) score += 50;
    else if (candidateArtist.includes(originalArtist) || originalArtist.includes(candidateArtist)) score += 25;
  }
  const originalDuration = asNumber(original.duration);
  const candidateDuration = asNumber(candidate.duration);
  if (originalDuration && candidateDuration) {
    const diff = Math.abs(originalDuration - candidateDuration);
    if (diff <= 3) score += 30;
    else if (diff <= 10) score += 15;
    else if (diff > 30) score -= 30;
  }
  return score;
}

async function fallbackLyricBySearch(sourceId: string, songInfo: Record<string, unknown>): Promise<Record<string, string>> {
  const name = firstText(songInfo.name);
  const artist = firstText(songInfo.artist, songInfo.singer);
  if (!name) return { lyric: '' };
  const preferred = [sourceId, 'kw', 'wy', 'tx', 'kg'].filter((source, index, list) => source && list.indexOf(source) === index);
  const publicSources = preferred.map((source) => publicSourceId(source));
  const keyword = artist ? `${name} ${artist}` : name;
  const candidates: GoMusicSong[] = [];
  for (const source of publicSources) {
    try {
      const result = await searchOneSource(source, keyword, 1, 8);
      candidates.push(...result.songs);
    } catch {
      // Try the next platform.
    }
  }
  const ranked = candidates
    .map((candidate) => ({ candidate, score: scoreLyricCandidate(songInfo, candidate) }))
    .filter((item) => item.score >= 90)
    .sort((a, b) => b.score - a.score);
  for (const { candidate } of ranked.slice(0, 8)) {
    try {
      const candidateInfo = sourceDataToSongInfo(sourceDataFromSong(candidate));
      const result = repairLyricResult(await directPlatformLyric(normalizeSourceId(candidate.source), candidateInfo).catch(() => ({ lyric: '' })));
      if (lyricResultHasText(result)) return result;
    } catch {
      // Keep trying matched candidates.
    }
  }
  return { lyric: '' };
}

async function handleLyric(req: HTTPRequest): Promise<HTTPResponse> {
  const query = parseQuery(req.query || '');
  const rawSource = String(query.source || '').trim();
  if (!rawSource) return errorResponse(400, 'source 不能为空');

  try {
    const extra = parseExtra(query.extra) || {};
    const songInfo: Record<string, unknown> = { ...extra, source: rawSource, id: query.id || extra.id || '' };
    for (const key of ['id', 'songmid', 'musicId', 'hash', 'copyrightId', 'name', 'singer', 'artist', 'album', 'strMediaMid', 'albumMid', 'albumId', 'lrcUrl', 'mrcUrl', 'trcUrl']) {
      const value = query[key];
      if (value) songInfo[key] = value;
    }
    const id = firstText(songInfo.id, query.id);
    if (id) {
      if (!songInfo.musicId) songInfo.musicId = id;
      if (!songInfo.songmid) songInfo.songmid = id;
      if (!songInfo.hash) songInfo.hash = id;
      if (!songInfo.copyrightId) songInfo.copyrightId = id;
    }
    if (query.duration) {
      const d = parseFloat(query.duration);
      if (!isNaN(d)) songInfo.duration = d;
    }

    const sourceId = normalizeSourceId(rawSource);
    if (sourceId === 'soda') {
      const sodaResult = repairLyricResult({ lyric: await qishuiGetLyricV2(songInfo) });
      if (lyricResultHasText(sodaResult)) return jsonResponse(sodaResult, 200);
      const fallback = await fallbackLyricBySearch(sourceId, songInfo);
      return jsonResponse(fallback, 200);
    }

    const directSources = new Set(['wy', 'tx', 'kg', 'kw', 'mg', 'joox', 'qianqian', 'fivesing', 'apple', 'bilibili', 'jamendo']);
    const directResult = repairLyricResult(await directPlatformLyric(sourceId, songInfo).catch(() => ({ lyric: '' })));
    if (lyricResultHasText(directResult)) {
      return jsonResponse({
        lyric: directResult.lyric || '',
        tlyric: directResult.tlyric || '',
        rlyric: directResult.rlyric || '',
        lxlyric: directResult.lxlyric || '',
      }, 200);
    }
    const fallback = await fallbackLyricBySearch(sourceId, songInfo);
    if (lyricResultHasText(fallback) || directSources.has(sourceId)) {
      return jsonResponse({
        lyric: fallback.lyric || '',
        tlyric: fallback.tlyric || '',
        rlyric: fallback.rlyric || '',
        lxlyric: fallback.lxlyric || '',
      }, 200);
    }

    const fetcher = registry.getLyricFetcher(sourceId);
    if (!fetcher) return errorResponse(400, '不支持的歌词来源: ' + sourceId);
    const result = repairLyricResult(await fetcher.getLyric(songInfo));
    if (lyricResultHasText(result)) return jsonResponse({ lyric: result.lyric || '', tlyric: result.tlyric || '', rlyric: result.rlyric || '', lxlyric: result.lxlyric || '' }, 200);
    const finalFallback = await fallbackLyricBySearch(sourceId, songInfo);
    return jsonResponse({ lyric: finalFallback.lyric || '', tlyric: finalFallback.tlyric || '', rlyric: finalFallback.rlyric || '', lxlyric: finalFallback.lxlyric || '' }, 200);
  } catch (error: any) {
    return errorResponse(500, '接口处理失败: ' + (error?.message || String(error)));
  }
}

async function handleRecommend(req: HTTPRequest): Promise<HTTPResponse> {
  const query = parseQuery(req.query || '');
  const body = req.method === 'POST' ? parseBody(req) : {};
  void query;
  void body;
  const sources = ['kw', 'wy', 'tx', 'kg'];
  const uniqueSources = Array.from(new Set(sources));
  const page = asNumber(body.page || query.page || 1) || 1;
  const pageSize = asNumber(body.page_size || query.page_size || 30) || 30;

  const playlists: GoMusicPlaylist[] = [];
  const errors: Array<{ source: string; error: string }> = [];
  for (const source of uniqueSources) {
    const provider = registry.getSongListProvider(source);
    if (!provider) {
      errors.push({ source: publicSourceId(source), error: 'source does not support recommend playlists' });
      continue;
    }
    try {
      const sortId = source === 'wy' ? 'hot' : '';
      const tagId = source === 'wy' ? '全部' : '';
      const result = await provider.getList(sortId, tagId, page);
      for (const item of Array.isArray(result?.list) ? result.list : []) {
        const playlist = normalizeSongListItem(item as Record<string, unknown>, publicSourceId(source), 'playlist');
        if (playlist) playlists.push(playlist);
      }
    } catch (error: any) {
      errors.push({ source: publicSourceId(source), error: error?.message || String(error) });
    }
  }

  const total = playlists.length;
  const summary = summarizePage(total, page, pageSize, playlists.length);
  return successResponse({
    type: 'playlist',
    songs: [],
    playlists,
    albums: [],
    total,
    page,
    page_size: pageSize,
    total_pages: summary.totalPages,
    page_start: summary.pageStart,
    page_end: summary.pageEnd,
    errors,
    results: playlists.map((playlist) => ({
      title: playlist.name,
      artist: playlist.creator,
      album: '',
      duration: 0,
      cover_url: playlist.cover || '',
      source_data: {
        provider: 'go-music-js',
        source: playlist.source,
        id: playlist.id,
        name: playlist.name,
        creator: playlist.creator,
        cover: playlist.cover,
        track_count: playlist.track_count,
        detail_url: playlist.detail_url,
      },
    })),
  });
}

async function handleLeaderboards(req: HTTPRequest): Promise<HTTPResponse> {
  const query = parseQuery(req.query || '');
  const requestedSources = getQueryValues(String(req.query || ''), 'sources');
  const leaderboardSources = ['kw', 'wy', 'tx', 'kg'];
  const sources = (requestedSources.length ? requestedSources : leaderboardSources)
    .map((item) => normalizeSourceId(item))
    .filter((item) => leaderboardSources.includes(item));
  const uniqueSources = Array.from(new Set(sources));
  let playlists: GoMusicPlaylist[] = [];
  for (const source of uniqueSources) {
    const provider = registry.getLeaderboardProvider(source);
    if (!provider) continue;
    const publicSource = publicSourceId(source);
    const boards = provider.getBoards(source);
    for (const board of Array.isArray(boards) ? boards : []) {
      const playlist = normalizeLeaderboardBoard(board as Record<string, unknown>, publicSource);
      if (playlist) playlists.push(playlist);
    }
  }
  playlists = await hydrateLeaderboardCovers(playlists);
  return successResponse({
    playlists,
    total: playlists.length,
    page: asNumber(query.page || 1) || 1,
    page_size: playlists.length,
    total_pages: playlists.length > 0 ? 1 : 0,
    page_start: playlists.length > 0 ? 1 : 0,
    page_end: playlists.length,
  });
}

async function handleLeaderboardDetail(req: HTTPRequest): Promise<HTTPResponse> {
  const query = parseQuery(req.query || '');
  const id = String(query.id || '').trim();
  const source = publicSourceId(String(query.source || ''));
  const sourceId = normalizeSourceId(source);
  const sdkSource = normalizeSourceId(source);
  const page = asNumber(query.page || 1) || 1;
  const pageSize = asNumber(query.page_size || 30) || 30;
  if (!id || !source) return errorResponse(400, '缺少排行榜 ID 或平台');
  try {
    const provider = registry.getLeaderboardProvider(sdkSource);
    if (!provider) throw new Error(source + ' 不支持排行榜');
    const boards = provider.getBoards(sdkSource);
    const board = (Array.isArray(boards) ? boards : []).find((item: any) => String(item?.id || item?.boardId || item?.rankId || item?.topId || '') === id) || { id, name: id };
    const result = await provider.getList(sdkSource, id, 1);
    const allSongs = (Array.isArray(result?.list) ? result.list : [])
      .map((item: any) => normalizeLeaderboardSong(item as Record<string, unknown>, source))
      .filter((song: GoMusicSong) => !!song.name);
    const total = allSongs.length;
    const safePageSize = Math.max(1, Math.min(pageSize, 100));
    const safePage = Math.max(1, page);
    const offset = (safePage - 1) * safePageSize;
    let songs = allSongs.slice(offset, offset + safePageSize);
    songs = await hydrateKuwoLeaderboardSongCovers(songs);
    const playlist = normalizeLeaderboardBoard(board as Record<string, unknown>, source) || {
      id,
      source,
      name: id,
      creator: source,
      cover: '',
      description: '',
      track_count: songs.length,
      link: '',
      detail_url: buildQueryUrl('/leaderboard', { id, source, type: 'leaderboard' }),
      content_type: 'leaderboard',
    };
    playlist.track_count = total;
    const summary = summarizePage(total, safePage, safePageSize, songs.length);
    return successResponse({
      playlist,
      songs,
      total,
      page: safePage,
      page_size: safePageSize,
      total_pages: summary.totalPages,
      page_start: summary.pageStart,
      page_end: summary.pageEnd,
    });
  } catch (error: any) {
    return errorResponse(500, error?.message || String(error));
  }
}

async function handleMyCollections(): Promise<HTTPResponse> {
  try {
    const bridge = (songloft as any).playlists;
    const response = bridge && typeof bridge.list === 'function'
      ? await bridge.list()
      : await callHostAPI('GET', '/api/v1/playlists');
    const list = Array.isArray(response) ? response : Array.isArray((response as any)?.playlists) ? (response as any).playlists : [];
    const playlists = await attachLocalPlaylistAssets(list.map((item) => normalizeCollectionItem(item)).filter(Boolean) as GoMusicPlaylist[]);
    return successResponse(playlists);
  } catch (error: any) {
    return errorResponse(500, error?.message || String(error));
  }
}

async function handleUserPlaylists(req: HTTPRequest): Promise<HTTPResponse> {
  const query = parseQuery(req.query || '');
  const body = req.method === 'POST' ? parseBody(req) : {};
  void query;
  void body;
  const sources = ['wy', 'tx', 'kg', 'soda'];
  const uniqueSources = Array.from(new Set(sources));
  const page = asNumber(body.page || query.page || 1) || 1;
  const pageSize = asNumber(body.page_size || query.page_size || 30) || 30;
  const cookies = await getCookies();

  const playlists: GoMusicPlaylist[] = [];
  const errors: Record<string, string>[] = [];
  const loggedSources: string[] = [];
  for (const source of uniqueSources) {
    const publicId = publicSourceId(source);
    try {
      const cookie = cookieForSource(cookies, source);
      if (!hasUsableLoginCookie(source, cookie)) continue;
      loggedSources.push(publicId);
      const sourcePlaylists =
        source === 'wy' ? await fetchNeteaseUserPlaylists(cookie, page, pageSize) :
        source === 'tx' ? await fetchQQUserPlaylists(cookie, page, pageSize) :
        source === 'kg' ? await fetchKugouUserPlaylists(cookie, page, pageSize) :
        source === 'soda' ? await fetchSodaUserPlaylists(cookie, page, pageSize) :
        [];
      playlists.push(...sourcePlaylists);
    } catch (error) {
      void publicId;
      void error;
    }
  }

  const summary = summarizePage(playlists.length, page, pageSize, playlists.length);
  return successResponse({
    playlists,
    total: playlists.length,
    page,
    page_size: pageSize,
    total_pages: summary.totalPages,
    page_start: summary.pageStart,
    page_end: summary.pageEnd,
    errors,
    sources: Array.from(new Set(loggedSources)),
    logged_sources: Array.from(new Set(loggedSources)),
  });
}

async function fetchHostSongsPage(page: number, pageSize: number): Promise<{ items: any[]; total: number }> {
  const offset = Math.max(0, (page - 1) * pageSize);
  try {
    const response = await callHostAPI<any>('GET', `/api/v1/songs?page=${page}&page_size=${pageSize}&limit=${pageSize}&offset=${offset}`);
    const items = hostListFromResponse(response);
    return { items, total: hostTotalFromResponse(response, items.length) };
  } catch {
    const response = await callHostAPI<any>('GET', `/api/v1/local_music?page=${page}&page_size=${pageSize}&limit=${pageSize}&offset=${offset}`);
    const items = hostListFromResponse(response);
    return { items, total: hostTotalFromResponse(response, items.length) };
  }
}

async function handleLocalMusicPage(req: HTTPRequest): Promise<HTTPResponse> {
  try {
    const query = parseQuery(req.query || '');
    const page = Math.max(1, asNumber(query.page || 1) || 1);
    const pageSize = Math.min(Math.max(asNumber(query.page_size || query.limit || 50) || 50, 1), 100);
    const offset = Math.max(0, (page - 1) * pageSize);
    let rawItems = await bridgeSongsList({ limit: pageSize, offset });
    let total = 0;
    if (!rawItems) {
      const paged = await fetchHostSongsPage(page, pageSize);
      rawItems = paged.items;
      total = paged.total || rawItems.length;
    } else {
      const pagedTotal = await fetchHostSongsPage(page, 1).then((paged) => paged.total).catch(() => 0);
      total = pagedTotal || (rawItems.length < pageSize ? offset + rawItems.length : offset + rawItems.length + 1);
    }
    const songs = await attachLocalSongAssets(rawItems.map((item: any) => normalizeHostSong(item)).filter(Boolean) as GoMusicSong[]);
    const summary = summarizePage(total || songs.length, page, pageSize, songs.length);
    return successResponse({
      songs,
      total: total || songs.length,
      exists: songs.length > 0,
      download_dir: '',
      offset,
      has_more: page < summary.totalPages,
      page,
      page_size: pageSize,
      total_pages: summary.totalPages,
      page_start: summary.pageStart,
      page_end: summary.pageEnd,
    });
  } catch (error: any) {
    return successResponse({
      songs: [],
      total: 0,
      exists: false,
      download_dir: '',
      offset: 0,
      has_more: false,
      page: 1,
      page_size: 30,
      page_start: 0,
      page_end: 0,
      error: error?.message || String(error),
    });
  }
}

async function fetchLocalPlaylistDetail(id: string, page: number, pageSize: number): Promise<{ playlist: GoMusicPlaylist; songs: GoMusicSong[]; total: number; pageSize: number }> {
  let playlistRaw: any = null;
  let songsRaw: any = null;
  try {
    playlistRaw = await bridgePlaylistById(id) || await callHostAPI('GET', `/api/v1/playlists/${encodeURIComponent(id)}`);
  } catch {
    playlistRaw = null;
  }
  try {
    const offset = Math.max(0, (page - 1) * pageSize);
    const bridgeSongs = await bridgePlaylistSongs(id, pageSize, offset);
    if (bridgeSongs) {
      songsRaw = { songs: bridgeSongs, total: asNumber(playlistRaw?.track_count || playlistRaw?.song_count || playlistRaw?.songs_count || playlistRaw?.total || 0) || (bridgeSongs.length < pageSize ? offset + bridgeSongs.length : offset + bridgeSongs.length + 1) };
    } else {
      const offset = Math.max(0, (page - 1) * pageSize);
      const response = await callHostAPI<any>('GET', `/api/v1/playlists/${encodeURIComponent(id)}/songs?page=${page}&page_size=${pageSize}&limit=${pageSize}&offset=${offset}`);
      const paged = { items: hostListFromResponse(response), total: hostTotalFromResponse(response, 0) };
      songsRaw = { songs: paged.items, total: paged.total };
    }
  } catch {
    songsRaw = playlistRaw?.songs || playlistRaw?.tracks || [];
  }
  const playlist = normalizeCollectionItem(playlistRaw || { id, name: `歌单 ${id}` }) || {
    id,
    source: 'local',
    name: `歌单 ${id}`,
    creator: '',
    cover: '',
    description: '',
    track_count: 0,
    link: '',
    detail_url: buildQueryUrl('/playlist', { id, source: 'local', type: 'playlist' }),
    content_type: 'playlist',
  };
  const rawList = Array.isArray(songsRaw)
    ? songsRaw
    : Array.isArray(songsRaw?.songs)
      ? songsRaw.songs
      : Array.isArray(songsRaw?.tracks)
        ? songsRaw.tracks
        : [];
  const songs = await attachLocalSongAssets(rawList.map((item: any) => normalizeHostSong(item)).filter(Boolean) as GoMusicSong[]);
  const [playlistWithAssets] = await attachLocalPlaylistAssets([playlist]);
  const playlistCover = playlistWithAssets.cover || songs.find((song) => !!song.cover)?.cover || '';
  return { playlist: { ...playlistWithAssets, cover: playlistCover }, songs, total: asNumber(songsRaw?.total || playlist.track_count || songs.length) || songs.length, pageSize };
}

async function fetchSdkPlaylistDetail(source: string, id: string, page: number): Promise<{ playlist: GoMusicPlaylist; songs: GoMusicSong[]; total: number; pageSize: number }> {
  const sdkSource = normalizeSourceId(source);
  const provider = registry.getSongListProvider(sdkSource);
  if (!provider) throw new Error(source + ' 不支持歌单详情');
  const result = await provider.getListDetail(id, page);
  const info = (result as any)?.info || {};
  const publicSource = publicSourceId(sdkSource);
  const playlist: GoMusicPlaylist = {
    id,
    source: publicSource,
    name: firstText(info.name, id),
    creator: firstText(pickCreator(info), info.author),
    cover: pickCover(info, publicSource),
    description: firstText(info.desc),
    track_count: asNumber(result?.total || info.total || 0),
    link: '',
    detail_url: buildQueryUrl('/playlist', { id, source: publicSource, type: 'playlist' }),
    content_type: 'playlist',
  };
  const songs = (Array.isArray(result?.list) ? result.list : [])
    .map((item: any) => normalizeSearchSong(item, publicSource))
    .filter((song: GoMusicSong) => !!song.name);
  if (!playlist.cover) playlist.cover = songs.find((song) => !!song.cover)?.cover || '';
  return { playlist, songs, total: asNumber(result?.total || songs.length), pageSize: asNumber(result?.limit || songs.length || 30) };
}

async function handlePlaylistDetail(req: HTTPRequest): Promise<HTTPResponse> {
  const query = parseQuery(req.query || '');
  const id = String(query.id || '').trim();
  const source = publicSourceId(String(query.source || ''));
  const sourceId = normalizeSourceId(source);
  const page = asNumber(query.page || 1) || 1;
  const pageSize = Math.min(Math.max(asNumber(query.page_size || query.limit || 30) || 30, 1), 100);
  if (!id) return errorResponse(400, '缺少歌单 ID');
  if (!source) return errorResponse(400, '缺少歌单平台');

  try {
    let detail: { playlist: GoMusicPlaylist; songs: GoMusicSong[]; total: number; pageSize?: number };
    if (source === 'local') {
      detail = await fetchLocalPlaylistDetail(id, page, pageSize);
    } else if (sourceId === 'soda') {
      detail = await fetchSodaPlaylistDetail(id, page, pageSize);
    } else {
      detail = await fetchSdkPlaylistDetail(source, id, page);
    }
    const effectivePageSize = detail.pageSize || pageSize;
    const summary = summarizePage(detail.total || detail.songs.length, page, effectivePageSize, detail.songs.length);
    return successResponse({
      playlist: detail.playlist,
      songs: detail.songs,
      total: detail.total || detail.songs.length,
      page,
      page_size: effectivePageSize,
      total_pages: summary.totalPages,
      page_start: summary.pageStart,
      page_end: summary.pageEnd,
    });
  } catch (error: any) {
    return errorResponse(500, error?.message || String(error));
  }
}

async function handlePlaylistCategories(req: HTTPRequest): Promise<HTTPResponse> {
  const query = parseQuery(req.query || '');
  const body = req.method === 'POST' ? parseBody(req) : {};
  const requestedSources = [
    ...getQueryValues(String(req.query || ''), 'sources'),
    ...(Array.isArray(body.sources) ? body.sources.map(String) : []),
    ...(typeof body.sources === 'string' ? String(body.sources).split(',').map((item) => item.trim()).filter(Boolean) : []),
  ];
  const defaultSources = await getSelectedSources();
  const sources = (requestedSources.length ? requestedSources : defaultSources.length ? defaultSources : SOURCE_META.map((item) => item.id))
    .map((item) => normalizeSourceId(item))
    .filter((item) => ['wy', 'tx', 'kg', 'kw', 'mg', 'qianqian', 'joox', 'apple'].includes(item));
  const uniqueSources = Array.from(new Set(sources));
  const page = asNumber(body.page || query.page || 1) || 1;
  const pageSize = asNumber(body.page_size || query.page_size || 30) || 30;
  const playlists: GoMusicPlaylist[] = [];

  for (const source of uniqueSources) {
    const provider = registry.getSongListProvider(source);
    if (!provider) continue;
    const sortId = provider.getSortList()[0]?.id || '';
    const tags = await provider.getTags();
    const candidates = [
      ...(Array.isArray(tags?.hot) ? tags.hot.slice(0, 4) : []),
      ...((tags?.tags || []).flatMap((group: any) => Array.isArray(group?.list) ? group.list.slice(0, 1) : [])),
    ];
    for (const tag of candidates) {
      if (!sortId || !tag?.id) continue;
      const result = await provider.getList(sortId, String(tag.id), page);
      for (const item of Array.isArray(result?.list) ? result.list : []) {
        const playlist = normalizeSongListItem(item as Record<string, unknown>, publicSourceId(source), 'playlist');
        if (playlist) playlists.push(playlist);
        if (playlists.length >= pageSize) break;
      }
      if (playlists.length >= pageSize) break;
    }
    if (playlists.length >= pageSize) break;
  }

  return successResponse({
    playlists,
    total: playlists.length,
    page,
    page_size: pageSize,
    total_pages: playlists.length > 0 ? 1 : 0,
    page_start: playlists.length > 0 ? 1 : 0,
    page_end: playlists.length,
  });
}

router.get('/', serveIndex);
router.get('/login', serveIndex);
router.get('/recommend', serveIndex);
router.get('/leaderboards', serveIndex);
router.get('/leaderboard', serveIndex);
router.get('/my_collections', serveIndex);
router.get('/local_music_page', serveIndex);
router.get('/playlist_categories', serveIndex);
router.get('/user_playlists', serveIndex);
router.get('/playlist', serveIndex);
router.get('/download', serveIndex);
router.get('/download_lrc', serveIndex);
router.get('/download_cover', serveIndex);
router.get('/player', serveIndex);
router.get('/api/v1/jsplugin/' + ENTRY_PATH, serveIndex);
router.get('/api/v1/jsplugin/' + ENTRY_PATH + '/', serveIndex);
router.get('/api/v1/jsplugin/' + ENTRY_PATH + '/index.html', serveIndex);

router.get('/api/sources', () => successResponse(SOURCE_META));
router.get('/api/platforms', () => successResponse(SOURCE_META));
router.get('/api/recommend', handleRecommend);
router.post('/api/recommend', handleRecommend);
router.get('/api/leaderboards', handleLeaderboards);
router.get('/api/leaderboard/detail', handleLeaderboardDetail);
router.get('/api/my_collections', handleMyCollections);
router.get('/api/local_music_page', handleLocalMusicPage);
router.get('/api/playlist_categories', handlePlaylistCategories);
router.get('/api/playlist/detail', handlePlaylistDetail);
router.get('/api/user_playlists', handleUserPlaylists);
router.post('/api/qr_login', handleCreateQRLogin);
router.get('/api/qr_login', handleCheckQRLogin);
router.get('/api/soda/play', handleSodaPlay);
router.get('/api/soda/raw', handleSodaRaw);

router.get('/api/settings', async () => {
  const settings = await getWebSettings();
  const selectedSources = await getSelectedSources();
  return successResponse({
    ...settings,
    api_mode: 'internal',
    quality: settings.quality || 'auto',
    selected_sources: selectedSources,
    auto_fallback: await getSetting<boolean>(STORAGE_KEYS.webSettings + '_auto_fallback', settings.auto_fallback),
    plugin_version: PLUGIN_VERSION,
    settings_error: '',
    internal_service: { mode: 'internal', running: true, health_ok: true, message: '内置模式运行中' },
  });
});

router.post('/api/settings', async (req) => {
  const body = parseBody(req);
  const current = await getWebSettings();
  const next = {
    ...current,
    ...body,
    selected_sources: Array.isArray(body.selected_sources) ? body.selected_sources.map(String).filter(Boolean) : current.selected_sources,
    auto_fallback: typeof body.auto_fallback === 'boolean' ? body.auto_fallback : current.auto_fallback,
    quality: body.quality || current.quality,
  };
  const saved = await saveWebSettings(next);
  await saveSetting(STORAGE_KEYS.webSettings + '_auto_fallback', !!saved.auto_fallback);
  return successResponse({
    ...saved,
    api_mode: 'internal',
    plugin_version: PLUGIN_VERSION,
    settings_error: '',
    internal_service: { mode: 'internal', running: true, health_ok: true, message: '内置模式运行中' },
  });
});

router.get('/api/health', async () => successResponse({ ok: true, plugin_version: PLUGIN_VERSION, mode: 'internal', running: true, health_ok: true }));

router.get('/api/cookies', async () => successResponse(await getCookies()));
router.post('/api/cookies', async (req) => {
  const body = parseBody(req);
  const cookies = body.cookies && typeof body.cookies === 'object' ? body.cookies : body;
  return successResponse(await saveCookies(cookies));
});

router.get('/api/playlists', async () => {
  try {
    return successResponse(await callHostAPI('GET', '/api/v1/playlists'));
  } catch (error: any) {
    return errorResponse(500, error?.message || String(error));
  }
});

router.get('/api/search', handleSearch);
router.post('/api/search', handleSearch);
router.post('/api/music/url', handleMusicUrl);
router.get('/api/direct/lyric', handleLyric);
router.get('/api/direct/play', handleDirectPlay);

router.get('/api/internal/status', async () => successResponse({ mode: 'internal', running: true, health_ok: true, plugin_version: PLUGIN_VERSION }));
router.post('/api/internal/start', async () => successResponse({ mode: 'internal', running: true, message: '内置模式已启动' }));
router.post('/api/internal/stop', async () => successResponse({ mode: 'internal', running: false, message: '内置模式已停止' }));
router.post('/api/internal/probe', async () => successResponse({ ok: true, status: { mode: 'internal', running: true } }));

router.post('/api/songs/import', async (req) => {
  try {
    return successResponse(await importSongs(parseBody(req) as ImportSongsRequest));
  } catch (error: any) {
    return errorResponse(500, '接口处理失败: ' + (error?.message || String(error)));
  }
});

async function healthBoot(): Promise<void> {
  ensureRegistry();
  try {
    await registry.get('wy');
  } catch {
    // ignore
  }
}

globalThis.onInit = async () => {
  ensureRegistry();
  await healthBoot();
  songloft.log.info('Go Music JS initialized');
};

globalThis.onDeinit = async () => {
  songloft.log.info('Go Music JS deinitialized');
};

globalThis.onHTTPRequest = async (req: HTTPRequest) => {
  try {
    return await router.handle(req);
  } catch (error: any) {
    songloft.log.error('Go Music JS request failed: ' + (error?.message || error));
    return errorResponse(500, error?.message || String(error));
  }
};
