# Go Music JS v0.1.3

对应开发版：`0.0.118`

## 更新内容

- 优化推荐歌单和排行榜识别准确度，扩展歌单 ID、名称、作者、封面、歌曲数量等字段识别。
- 排行榜列表接入封面补全机制，酷我榜单封面也可自动补齐。
- 歌单详情缺少封面时，使用当前页歌曲封面作为兜底。
- 导入 Songloft 时进一步统一 `source_data.extra`，同步写入 `cover` 和内嵌 `lyric`。
- 增加轻量缓存：搜索结果缓存、歌词缓存、导入封面补全缓存，减少重复请求。

## 验证

- `npm run build` 通过。
- `npm run validate` 通过。
- `node --check static/js/app.js` 通过。
- 已验证默认搜索、推荐歌单、酷我排行榜和歌词接口正常。

## 归档

- 插件包：`backups/formal-releases/go-music-js-v0.1.3.jsplugin.zip`
- 源码包：`backups/formal-releases/go-music-js-source-v0.1.3.zip`
